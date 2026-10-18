-- Ranked Classic: server queue, atomic Elo settlement and opt-in projections.
alter table public.profiles add column leaderboard_visible boolean not null default false;
grant update(leaderboard_visible) on public.profiles to authenticated;
create table public.ranked_seasons (
 id text primary key, rules_version text not null check(rules_version='classic-v1'),
 time_control text not null check(time_control='untimed'), active boolean not null default true
);
insert into public.ranked_seasons values('classic-open-v1','classic-v1','untimed',true);
alter table public.ranked_seasons enable row level security;
revoke all on public.ranked_seasons from anon,authenticated;
grant all on public.ranked_seasons to service_role;
alter table public.online_matches
 add column competition text not null default 'private' check(competition in ('private','ranked')),
 add column season text references public.ranked_seasons(id),
 add column rating_status text not null default 'unrated' check(rating_status in ('unrated','pending','settled','void')),
 add column rating_void_reason text,
 add constraint ranked_metadata check((competition='private' and season is null and rating_status='unrated') or (competition='ranked' and season is not null and rating_status<>'unrated'));
create table public.ratings (
 player_id uuid references public.profiles(id) on delete cascade,
 season text references public.ranked_seasons(id), rating integer not null default 1500 check(rating>=0),
 games integer not null default 0, wins integer not null default 0, draws integer not null default 0, losses integer not null default 0,
 primary key(player_id,season), check(games=wins+draws+losses and wins>=0 and draws>=0 and losses>=0)
);
alter table public.ratings enable row level security;
create policy ratings_self on public.ratings for select to authenticated using(player_id=(select auth.uid()));
revoke all on public.ratings from anon,authenticated;
grant select on public.ratings to authenticated;
grant all on public.ratings to service_role;
create table private.rating_events (
 match_id uuid references public.online_matches(id) on delete cascade,
 mark text check(mark in ('X','O')), player_id uuid references public.profiles(id) on delete set null,
 season text not null, before_rating integer not null, after_rating integer not null, delta integer not null,
 algorithm text not null default 'elo32-v1', accepted_at timestamptz not null default now(),
 primary key(match_id,mark), check(after_rating=before_rating+delta)
);
create table private.leaderboard_entries (
 player_id uuid references public.profiles(id) on delete cascade, season text not null,
 handle text not null, region text, rating integer not null, games integer not null,
 wins integer not null, draws integer not null, losses integer not null,
 primary key(player_id,season)
);
create index leaderboard_global on private.leaderboard_entries(season,rating desc,games desc,handle);
create index leaderboard_region on private.leaderboard_entries(season,region,rating desc,games desc,handle);
create table public.matchmaking_queue (
 player_id uuid primary key references public.profiles(id) on delete cascade,
 ticket uuid not null unique, season text not null references public.ranked_seasons(id), region text, rating integer not null,
 status text not null check(status in ('waiting','matched','cancelled','expired')),
 joined_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '45 seconds',
 match_id uuid references public.online_matches(id) on delete set null,
 check((status='matched' and match_id is not null) or (status<>'matched' and match_id is null))
);
create index queue_candidates on public.matchmaking_queue(season,status,joined_at);
alter table public.matchmaking_queue enable row level security;
create policy queue_self on public.matchmaking_queue for select to authenticated using(player_id=(select auth.uid()));
revoke all on public.matchmaking_queue from anon,authenticated;
grant select on public.matchmaking_queue to authenticated;
grant all on public.matchmaking_queue to service_role;
create table private.queue_attempts (
 player_id uuid references public.profiles(id) on delete cascade, ticket uuid not null,
 entered_at timestamptz not null default now(), primary key(player_id,ticket)
);
create index queue_rate_limit on private.queue_attempts(player_id,entered_at);
grant all on all tables in schema private to service_role;

create function private.refresh_leaderboard(p_player uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.leaderboard_entries where player_id=p_player;
 insert into private.leaderboard_entries
 select r.player_id,r.season,p.handle,p.region,r.rating,r.games,r.wins,r.draws,r.losses
 from public.ratings r join public.profiles p on p.id=r.player_id
 where p.id=p_player and p.leaderboard_visible and p.handle is not null and r.games>=10;
end $$;
create function private.profile_leaderboard_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.refresh_leaderboard(new.id);return new;end $$;
create trigger leaderboard_profile after update of leaderboard_visible,handle,region on public.profiles for each row execute function private.profile_leaderboard_changed();

create function private.settle_ranked_result() returns trigger language plpgsql security definer set search_path='' as $$
declare rx integer; ry integer; dx integer; score_x numeric;
begin
 if new.competition<>'ranked' or new.rating_status<>'pending' then return new;end if;
 if new.phase='abandoned' then
  update public.online_matches set rating_status='void',rating_void_reason='account_deleted' where id=new.id;return new;
 end if;
 if old.phase<>'active' or new.phase not in ('completed','forfeited') then return new;end if;
 if new.owner_id is null or new.guest_id is null then raise exception 'invalid_ranked_players';end if;
 -- Consistent lock order for both ratings. Queue creation initializes these rows.
 perform player_id from public.ratings where season=new.season and player_id in(new.owner_id,new.guest_id) order by player_id for update;
 select rating into strict rx from public.ratings where player_id=new.owner_id and season=new.season;
 select rating into strict ry from public.ratings where player_id=new.guest_id and season=new.season;
 if (select count(*) from public.online_matches m where m.id<>new.id and m.rating_status='settled' and m.season=new.season and m.updated_at>now()-interval '1 hour'
 and ((m.owner_id=new.owner_id and m.guest_id=new.guest_id) or (m.owner_id=new.guest_id and m.guest_id=new.owner_id)))>=3 then
  update public.online_matches set rating_status='void',rating_void_reason='repeat_pair_limit' where id=new.id;return new;
 end if;
 score_x:=case new.result when 'X' then 1 when 'draw' then 0.5 else 0 end;
 dx:=greatest(-rx,least(ry,round(32*(score_x-1/(1+power(10::numeric,(ry-rx)::numeric/400))))::integer));
 update public.ratings set rating=rating+dx,games=games+1,wins=wins+(new.result='X')::integer,draws=draws+(new.result='draw')::integer,losses=losses+(new.result='O')::integer where player_id=new.owner_id and season=new.season;
 update public.ratings set rating=rating-dx,games=games+1,wins=wins+(new.result='O')::integer,draws=draws+(new.result='draw')::integer,losses=losses+(new.result='X')::integer where player_id=new.guest_id and season=new.season;
 insert into private.rating_events(match_id,mark,player_id,season,before_rating,after_rating,delta) values
 (new.id,'X',new.owner_id,new.season,rx,rx+dx,dx),(new.id,'O',new.guest_id,new.season,ry,ry-dx,-dx);
 update public.online_matches set rating_status='settled' where id=new.id;
 perform private.refresh_leaderboard(new.owner_id);perform private.refresh_leaderboard(new.guest_id);
 return new;
end $$;
create trigger settle_ranked after update of phase on public.online_matches for each row execute function private.settle_ranked_result();

alter function public.arena_snapshot(uuid) set schema private;
create function public.arena_snapshot(p_match_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.arena_snapshot(m.id)||jsonb_build_object('competition',m.competition,'season',m.season,'ratingStatus',m.rating_status,'ratingVoidReason',m.rating_void_reason,
 'ratingChanges',(select jsonb_object_agg(mark,jsonb_build_object('before',before_rating,'after',after_rating,'delta',delta)) from private.rating_events where match_id=m.id))
 from public.online_matches m where m.id=p_match_id;
$$;
create function private.queue_snapshot(p_player uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('ticket',q.ticket,'status',case when q.status='matched' and m.phase<>'active' then 'idle' else coalesce(q.status,'idle') end,
 'joinedAt',q.joined_at,'expiresAt',q.expires_at,'match',case when q.status='matched' and m.phase='active' then public.arena_snapshot(q.match_id) else null end,
 'rating',jsonb_build_object('season',r.season,'value',r.rating,'games',r.games,'wins',r.wins,'draws',r.draws,'losses',r.losses,'provisional',r.games<10))
 from public.ratings r left join public.matchmaking_queue q on q.player_id=r.player_id left join public.online_matches m on m.id=q.match_id
 where r.player_id=p_player and r.season='classic-open-v1';
$$;
create function public.arena_queue(p_player uuid,p_ticket uuid,p_action text,p_game jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare own public.matchmaking_queue; candidate public.matchmaking_queue; skill integer; country text; new_id uuid; active_id uuid;
begin
 -- Pairing, cancellation and deletion share this short transaction lock.
 perform pg_advisory_xact_lock(730410);perform private.check_player(p_player);
 if p_action not in ('status','enter','poll','cancel') then raise exception 'invalid_queue_action';end if;
 insert into public.ratings(player_id,season) values(p_player,'classic-open-v1') on conflict do nothing;
 update public.matchmaking_queue set status='expired' where status='waiting' and expires_at<=now();
 select * into own from public.matchmaking_queue where player_id=p_player;
 select id into active_id from public.online_matches where competition='ranked' and phase='active' and p_player in(owner_id,guest_id) limit 1;
 if active_id is not null or p_action='status' then return private.queue_snapshot(p_player);end if;
 if p_ticket is null then raise exception 'invalid_queue_ticket';end if;
 if p_action='enter' then
  if own.ticket=p_ticket then return private.queue_snapshot(p_player);end if;
  if own.status='waiting' then raise exception 'queue_active';end if;
  if exists(select 1 from private.queue_attempts where player_id=p_player and ticket=p_ticket) then raise exception 'queue_superseded';end if;
  if not exists(select 1 from public.ranked_seasons where id='classic-open-v1' and active) then raise exception 'season_closed';end if;
  if (select count(*) from private.queue_attempts where player_id=p_player and entered_at>now()-interval '1 hour')>=40 then raise exception 'queue_rate_limit';end if;
  select rating into skill from public.ratings where player_id=p_player and season='classic-open-v1';
  select region into country from public.profiles where id=p_player;
  insert into private.queue_attempts(player_id,ticket) values(p_player,p_ticket);
  insert into public.matchmaking_queue(player_id,ticket,season,region,rating,status) values(p_player,p_ticket,'classic-open-v1',country,skill,'waiting')
  on conflict(player_id) do update set ticket=excluded.ticket,region=excluded.region,rating=excluded.rating,status='waiting',joined_at=now(),expires_at=now()+interval '45 seconds',match_id=null;
  select * into own from public.matchmaking_queue where player_id=p_player;
 else
  if own.ticket is distinct from p_ticket then raise exception 'queue_superseded';end if;
  if p_action='cancel' then
   update public.matchmaking_queue set status='cancelled' where player_id=p_player and status='waiting';return private.queue_snapshot(p_player);
  end if;
  if own.status<>'waiting' then return private.queue_snapshot(p_player);end if;
  update public.matchmaking_queue set expires_at=now()+interval '45 seconds' where player_id=p_player;
 end if;
 select q.* into candidate from public.matchmaking_queue q
 where q.player_id<>p_player and q.status='waiting' and q.expires_at>now() and q.season=own.season
 and (own.region is null or q.region=own.region or least(own.joined_at,q.joined_at)<=now()-interval '15 seconds')
 and abs(q.rating-own.rating)<=least(600,150+floor(extract(epoch from now()-least(own.joined_at,q.joined_at))/10)*100)
 and not exists(select 1 from public.online_matches m where m.competition='ranked' and m.phase='active' and q.player_id in(m.owner_id,m.guest_id))
 order by (q.region is not distinct from own.region) desc,abs(q.rating-own.rating),q.joined_at,q.player_id limit 1 for update of q;
 if found then
  if p_game->>'status'<>'playing' or p_game->'moves'<>'[]'::jsonb then raise exception 'invalid_server_state';end if;
  insert into public.online_matches(owner_id,guest_id,owner_name,guest_name,game,phase,competition,season,rating_status)
  select candidate.player_id,p_player,x.display_name,o.display_name,p_game,'active','ranked',own.season,'pending' from public.profiles x,public.profiles o where x.id=candidate.player_id and o.id=p_player returning id into new_id;
  update public.matchmaking_queue set status='matched',match_id=new_id where player_id in(p_player,candidate.player_id);
 end if;
 return private.queue_snapshot(p_player);
end $$;
create function public.arena_leaderboard(p_region text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]'::jsonb) from (
 select row_number() over(order by e.rating desc,e.games desc,p.handle) as rank,p.handle,p.region,e.rating,e.games,e.wins,e.draws,e.losses
 from private.leaderboard_entries e join public.profiles p on p.id=e.player_id
 where e.season='classic-open-v1' and p.leaderboard_visible and p.handle is not null and (p_region is null or p.region=p_region)
 order by e.rating desc,e.games desc,p.handle limit 50) row;
$$;
alter function public.arena_delete_account(uuid) set schema private;
create function public.arena_delete_account(p_player uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock(730410);perform private.arena_delete_account(p_player);end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.arena_snapshot(uuid),public.arena_queue(uuid,uuid,text,jsonb),public.arena_leaderboard(text),public.arena_delete_account(uuid) from public,anon,authenticated;
grant execute on function public.arena_snapshot(uuid),public.arena_queue(uuid,uuid,text,jsonb),public.arena_leaderboard(text),public.arena_delete_account(uuid) to service_role;
