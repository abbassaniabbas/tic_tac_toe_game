-- Separate rule versions and private invitations. Signature modes never alter Classic Elo.
create table public.signature_matches (
 id uuid primary key default gen_random_uuid(), rule text not null check(rule in ('ultimate-v1','blitz-v1')),
 owner_id uuid references public.profiles(id) on delete set null, guest_id uuid references public.profiles(id) on delete set null,
 owner_name text not null, guest_name text, game jsonb not null, revision integer not null default 0,
 phase text not null default 'waiting' check(phase in ('waiting','active','completed','cancelled','forfeited','timeout','abandoned')),
 result text check(result in ('X','O','draw')), remaining_x integer,remaining_o integer,turn_started_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',
 check(guest_id is null or owner_id<>guest_id), check(revision>=0),
 check((rule='ultimate-v1' and remaining_x is null and remaining_o is null and turn_started_at is null) or (rule='blitz-v1' and remaining_x is not null and remaining_o is not null and remaining_x between 0 and 60000 and remaining_o between 0 and 60000)),
 check(rule<>'blitz-v1' or phase<>'active' or turn_started_at is not null),
 check((phase in ('completed','forfeited','timeout') and result is not null) or (phase not in ('completed','forfeited','timeout') and result is null))
);
create index signature_owner on public.signature_matches(owner_id,updated_at desc);
create index signature_guest on public.signature_matches(guest_id,updated_at desc);
create table public.signature_moves (
 match_id uuid references public.signature_matches(id) on delete cascade,ply integer check(ply between 1 and 81),
 player_id uuid references public.profiles(id) on delete set null,move jsonb not null,request_id uuid not null,accepted_at timestamptz not null default now(),
 primary key(match_id,ply),unique(match_id,request_id)
);
create table private.signature_invites(match_id uuid primary key references public.signature_matches(id) on delete cascade,digest text unique not null);
create table public.puzzle_solves (
 player_id uuid references public.profiles(id) on delete cascade,day date,puzzle_id text not null,moves jsonb not null,verified_at timestamptz not null default now(),primary key(player_id,day)
);
create table public.player_achievements (
 player_id uuid references public.profiles(id) on delete cascade,code text check(code in ('first_verified_win','first_ultimate_win','first_blitz_win','ranked_ten','puzzle_solver')),
 earned_at timestamptz not null default now(),classic_match uuid references public.online_matches(id),signature_match uuid references public.signature_matches(id),puzzle_day date,
 primary key(player_id,code), check(num_nonnulls(classic_match,signature_match,puzzle_day)=1)
);
create table private.cosmetics(id text primary key,requires text);
insert into private.cosmetics values('blue',null),('slate',null),('violet','first_verified_win'),('cyan','puzzle_solver');
alter table public.profiles add column cosmetic text not null default 'blue' references private.cosmetics(id);
alter table public.signature_matches enable row level security;
alter table public.signature_moves enable row level security;
alter table public.puzzle_solves enable row level security;
alter table public.player_achievements enable row level security;
create policy signature_members on public.signature_matches for select to authenticated using((select auth.uid()) in(owner_id,guest_id));
create policy signature_move_members on public.signature_moves for select to authenticated using(exists(select 1 from public.signature_matches m where m.id=match_id and (select auth.uid()) in(m.owner_id,m.guest_id)));
create policy puzzle_self on public.puzzle_solves for select to authenticated using(player_id=(select auth.uid()));
create policy achievements_self on public.player_achievements for select to authenticated using(player_id=(select auth.uid()));
revoke all on public.signature_matches,public.signature_moves,public.puzzle_solves,public.player_achievements from anon,authenticated;
grant select on public.signature_matches,public.signature_moves,public.puzzle_solves,public.player_achievements to authenticated;
grant all on public.signature_matches,public.signature_moves,public.puzzle_solves,public.player_achievements to service_role;
grant all on all tables in schema private to service_role;

create function private.signature_snapshot(p_id uuid) returns jsonb language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('matchId',id,'rulesVersion',rule,'revision',revision,'game',game,'players',jsonb_build_object('X',owner_id,'O',guest_id),
 'playerNames',jsonb_build_object('X',owner_name,'O',guest_name),'phase',phase,'result',result,'createdAt',created_at,'expiresAt',expires_at,
 'serverNow',clock_timestamp(),'clock',case when rule='blitz-v1' then jsonb_build_object('X',remaining_x,'O',remaining_o,'startedAt',turn_started_at) else null end)
 from public.signature_matches where id=p_id;
$$;
create function public.arena_variant(p_player uuid,p_action text,p_request uuid,p_match uuid,p_revision integer,p_digest text,p_rule text,p_move jsonb,p_game jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.signature_matches; previous jsonb; response jsonb; fingerprint jsonb; name text; new_id uuid;stamp timestamptz; elapsed integer;mark text;pending integer;
begin
 perform private.check_player(p_player);
 if p_action='history' then return (select coalesce(jsonb_agg(s),'[]'::jsonb) from (select private.signature_snapshot(id) s from public.signature_matches where p_player in(owner_id,guest_id) order by updated_at desc limit 50) history);end if;
 fingerprint:=jsonb_build_object('matchId',p_match,'revision',p_revision,'digest',p_digest,'rule',p_rule,'move',p_move);
 if p_action<>'fetch' then
  previous:=private.receipt(p_player,p_request,'variant_'||p_action,fingerprint);
  if previous is not null then return previous;end if;
 end if;
 if p_action='create' then
  if p_rule not in ('ultimate-v1','blitz-v1') then raise exception 'invalid_rule';end if;
  if (select count(*) from public.signature_matches where owner_id=p_player and phase='waiting' and expires_at>now())>=3 then raise exception 'room_limit';end if;
  if (select count(*) from public.signature_matches where owner_id=p_player and created_at>now()-interval '1 hour')>=20 then raise exception 'rate_limit';end if;
  select display_name into name from public.profiles where id=p_player;
  insert into public.signature_matches(rule,owner_id,owner_name,game,remaining_x,remaining_o) values(p_rule,p_player,name,p_game,case when p_rule='blitz-v1' then 60000 end,case when p_rule='blitz-v1' then 60000 end) returning id into new_id;
  insert into private.signature_invites values(new_id,p_digest);response:=private.signature_snapshot(new_id);
 else
  if p_action='join' then
   select matches.* into m from public.signature_matches matches join private.signature_invites i on i.match_id=matches.id where i.digest=p_digest for update of matches;
   if not found then raise exception 'invalid_invite';end if;
   if p_player=m.owner_id or p_player=m.guest_id then return private.signature_snapshot(m.id);end if;
   if m.phase<>'waiting' then raise exception 'room_unavailable';end if;
   if m.expires_at<=now() then raise exception 'invite_expired';end if;
   select display_name into name from public.profiles where id=p_player;
   update public.signature_matches set guest_id=p_player,guest_name=name,phase='active',revision=revision+1,turn_started_at=case when rule='blitz-v1' then clock_timestamp() end,updated_at=now() where id=m.id;
  else
   select * into m from public.signature_matches where id=p_match for update;
   if not found or not coalesce(p_player=m.owner_id or p_player=m.guest_id,false) then raise exception 'not_participant';end if;
   stamp:=clock_timestamp();
   if m.rule='blitz-v1' and m.phase='active' then
    elapsed:=least(60000,greatest(0,floor(extract(epoch from stamp-m.turn_started_at)*1000)))::integer;
    pending:=case when m.game->>'turn'='X' then m.remaining_x else m.remaining_o end;
    if elapsed>=pending then
     update public.signature_matches set phase='timeout',result=case when game->>'turn'='X' then 'O' else 'X' end,
     remaining_x=case when game->>'turn'='X' then 0 else remaining_x end,remaining_o=case when game->>'turn'='O' then 0 else remaining_o end,
     turn_started_at=null,revision=revision+1,updated_at=stamp where id=m.id;
     response:=private.signature_snapshot(m.id);
    end if;
   end if;
   if response is null then
    if p_action='fetch' then return private.signature_snapshot(m.id);end if;
    if m.revision<>p_revision then raise exception 'stale_revision';end if;
    if p_action='end' and m.phase in ('waiting','active') then
     update public.signature_matches set phase=case when phase='waiting' then 'cancelled' else 'forfeited' end,
     result=case when phase='waiting' then null when p_player=owner_id then 'O' else 'X' end,turn_started_at=null,revision=revision+1,updated_at=stamp where id=m.id;
    elsif p_action='move' then
     if m.phase<>'active' then raise exception 'match_inactive';end if;
     mark:=case when p_player=m.owner_id then 'X' else 'O' end;
     if m.game->>'turn'<>mark then raise exception 'wrong_turn';end if;
     if p_game->'moves'<>((m.game->'moves')||jsonb_build_array(p_move)) or p_game->>'first'<>m.game->>'first' then raise exception 'invalid_server_state';end if;
     insert into public.signature_moves(match_id,ply,player_id,move,request_id) values(m.id,jsonb_array_length(p_game->'moves'),p_player,p_move,p_request);
     update public.signature_matches set game=p_game,phase=case when p_game->>'status'='playing' then 'active' else 'completed' end,
     result=case when p_game->>'status'='draw' then 'draw' else p_game->>'winner' end,
     remaining_x=case when rule='blitz-v1' and mark='X' then greatest(0,remaining_x-elapsed) else remaining_x end,
     remaining_o=case when rule='blitz-v1' and mark='O' then greatest(0,remaining_o-elapsed) else remaining_o end,
     turn_started_at=case when rule='blitz-v1' and p_game->>'status'='playing' then stamp end,revision=revision+1,updated_at=stamp where id=m.id;
    else raise exception 'match_inactive';end if;
   end if;
  end if;
  response:=private.signature_snapshot(m.id);
 end if;
 if p_action<>'fetch' then insert into private.command_receipts(player_id,request_id,action,fingerprint,response) values(p_player,p_request,'variant_'||p_action,fingerprint,response);end if;
 return response;
end $$;

create function private.award_verified() returns trigger language plpgsql security definer set search_path='' as $$
declare winner_id uuid;signature boolean;code text;
begin
 if old.phase<>'active' or new.phase not in ('completed','forfeited','timeout') or new.result not in ('X','O') then return new;end if;
 winner_id:=case when new.result='X' then new.owner_id else new.guest_id end;
 if winner_id is null then return new;end if;
 signature:=tg_table_name='signature_matches';
 insert into public.player_achievements(player_id,code,classic_match,signature_match) values(winner_id,'first_verified_win',case when not signature then new.id end,case when signature then new.id end) on conflict do nothing;
 if signature then
  code:=case when new.rule='ultimate-v1' then 'first_ultimate_win' else 'first_blitz_win' end;
  insert into public.player_achievements(player_id,code,signature_match) values(winner_id,code,new.id) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger verified_classic after update of phase on public.online_matches for each row execute function private.award_verified();
create trigger verified_signature after update of phase on public.signature_matches for each row execute function private.award_verified();
create function private.award_placements() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.competition='ranked' and new.rating_status='settled' then
  insert into public.player_achievements(player_id,code,classic_match)
  select player_id,'ranked_ten',new.id from public.ratings where season=new.season and games>=10 and player_id in(new.owner_id,new.guest_id) on conflict do nothing;
 end if;return new;
end $$;
create trigger ranked_achievement after update of rating_status on public.online_matches for each row execute function private.award_placements();
create function public.arena_solve(p_player uuid,p_day date,p_puzzle text,p_moves jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.check_player(p_player);
 if p_day<>(timezone('UTC',now()))::date then raise exception 'puzzle_date';end if;
 -- The authenticated Edge handler validates the full proof against deterministic replies.
 insert into public.puzzle_solves(player_id,day,puzzle_id,moves) values(p_player,p_day,p_puzzle,p_moves) on conflict do nothing;
 insert into public.player_achievements(player_id,code,puzzle_day) values(p_player,'puzzle_solver',p_day) on conflict do nothing;
end $$;
create function public.arena_extras(p_player uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('cosmetic',p.cosmetic,'achievements',(select coalesce(jsonb_agg(jsonb_build_object('code',code,'earnedAt',earned_at)),'[]'::jsonb) from public.player_achievements where player_id=p.id)) from public.profiles p where p.id=p_player;
$$;
create function public.arena_cosmetic(p_player uuid,p_cosmetic text) returns void language plpgsql security definer set search_path='' as $$
declare required text;
begin
 perform private.check_player(p_player);
 select requires into required from private.cosmetics where id=p_cosmetic;
 if not found or (required is not null and not exists(select 1 from public.player_achievements where player_id=p_player and code=required)) then raise exception 'cosmetic_locked';end if;
 update public.profiles set cosmetic=p_cosmetic where id=p_player;
end $$;
create function private.delete_signature_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.signature_matches set phase=case when phase in ('waiting','active') then 'abandoned' else phase end,
 result=case when phase in ('waiting','active') then null else result end,turn_started_at=null,
 owner_name=case when owner_id=old.id then 'Deleted player' else owner_name end,guest_name=case when guest_id=old.id then 'Deleted player' else guest_name end,
 revision=revision+1,updated_at=now() where old.id in(owner_id,guest_id);return old;
end $$;
create trigger signature_delete before delete on public.profiles for each row execute function private.delete_signature_identity();
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.arena_variant(uuid,text,uuid,uuid,integer,text,text,jsonb,jsonb),public.arena_solve(uuid,date,text,jsonb),public.arena_extras(uuid),public.arena_cosmetic(uuid,text) from public,anon,authenticated;
grant execute on function public.arena_variant(uuid,text,uuid,uuid,integer,text,text,jsonb,jsonb),public.arena_solve(uuid,date,text,jsonb),public.arena_extras(uuid),public.arena_cosmetic(uuid,text) to service_role;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.signature_matches;end if;end $$;
create function public.arena_replay(p_player uuid,p_match uuid,p_signature boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare game jsonb;rules text;result text;moves jsonb;
begin
 if p_signature then
  select m.game,m.rule,m.result into game,rules,result from public.signature_matches m where m.id=p_match and p_player in(m.owner_id,m.guest_id);
  select coalesce(jsonb_agg(move order by ply),'[]'::jsonb) into moves from public.signature_moves where match_id=p_match;
 else
  select m.game,'classic-v1',m.result into game,rules,result from public.online_matches m where m.id=p_match and p_player in(m.owner_id,m.guest_id);
  select coalesce(jsonb_agg(square order by ply),'[]'::jsonb) into moves from public.online_moves where match_id=p_match;
 end if;
 if game is null then raise exception 'not_participant';end if;
 if moves<>game->'moves' then raise exception 'replay_mismatch';end if;
 return jsonb_build_object('id',p_match,'rule',rules,'first',game->>'first','moves',moves,'result',result,'source','server');
end $$;
revoke all on function public.arena_replay(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.arena_replay(uuid,uuid,boolean) to service_role;
