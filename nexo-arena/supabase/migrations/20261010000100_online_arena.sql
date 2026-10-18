-- Clients can read their own records; all match mutations go through authenticated
-- Edge Functions and locked service-role RPCs. Classic outcomes come from @nexo/engine.
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 handle text unique check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,19}$'),
 display_name text not null default 'Player' check (length(trim(display_name)) between 1 and 24 and display_name !~ '[[:cntrl:]]'),
 locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
 region text check (region is null or region ~ '^[A-Z]{2}$'),
 created_at timestamptz not null default now()
);
create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();

create table public.online_matches (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references public.profiles(id) on delete set null,
 guest_id uuid references public.profiles(id) on delete set null,
 owner_name text not null,
 guest_name text,
 game jsonb not null,
 revision integer not null default 0 check (revision >= 0),
 phase text not null default 'waiting' check (phase in ('waiting','active','completed','cancelled','forfeited','abandoned')),
 result text check (result in ('X','O','draw')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '10 minutes',
 check (guest_id is null or guest_id <> owner_id),
 check ((phase in ('completed','forfeited') and result is not null) or (phase not in ('completed','forfeited') and result is null))
);
create index online_owner_history on public.online_matches(owner_id,updated_at desc);
create index online_guest_history on public.online_matches(guest_id,updated_at desc);
create table private.invites (
 match_id uuid primary key references public.online_matches(id) on delete cascade,
 digest text unique not null check (digest ~ '^[a-f0-9]{64}$')
);
create table public.online_moves (
 match_id uuid not null references public.online_matches(id) on delete cascade,
 ply integer not null check (ply between 1 and 9),
 player_id uuid references public.profiles(id) on delete set null,
 square smallint not null check (square between 0 and 8),
 mark text not null check(mark in ('X','O')),
 request_id uuid not null,
 accepted_at timestamptz not null default now(),
 primary key(match_id,ply), unique(match_id,request_id)
);
create table private.command_receipts (
 player_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null,
 action text not null,
 fingerprint jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(player_id,request_id)
);

alter table public.profiles enable row level security;
alter table public.online_matches enable row level security;
alter table public.online_moves enable row level security;
alter table private.invites enable row level security;
alter table private.command_receipts enable row level security;
create policy profile_self_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy match_participants_read on public.online_matches for select to authenticated using ((select auth.uid()) in (owner_id,guest_id));
create policy moves_participants_read on public.online_moves for select to authenticated using (exists(select 1 from public.online_matches m where m.id = match_id and (select auth.uid()) in (m.owner_id,m.guest_id)));
revoke all on public.profiles, public.online_matches, public.online_moves from anon,authenticated;
grant select on public.profiles,public.online_matches,public.online_moves to authenticated;
grant update(handle,display_name,locale,region) on public.profiles to authenticated;
grant all on public.profiles,public.online_matches,public.online_moves to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

create function public.arena_snapshot(p_match_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('matchId',id,'revision',revision,'rulesVersion','classic-v1','game',game,
 'players',jsonb_build_object('X',owner_id,'O',guest_id),'playerNames',jsonb_build_object('X',owner_name,'O',guest_name),
 'phase',phase,'result',result,'createdAt',created_at,'updatedAt',updated_at,'expiresAt',expires_at)
 from public.online_matches where id = p_match_id;
$$;
create function private.check_player(p_player uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 -- Profile row locks serialize all commands from this identity and protect request IDs.
 perform id from public.profiles where id = p_player for update;
 if not found then raise exception 'profile_missing' using errcode='P0001'; end if;
end $$;
create function private.receipt(p_player uuid,p_request uuid,p_action text,p_fingerprint jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.command_receipts;
begin
 select * into r from private.command_receipts where player_id=p_player and request_id=p_request;
 if found then
  if r.action <> p_action or r.fingerprint <> p_fingerprint then raise exception 'request_conflict'; end if;
  return r.response;
 end if;
 return null;
end $$;

create function public.arena_create(p_player uuid,p_request uuid,p_digest text,p_game jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous jsonb; response jsonb; new_id uuid; display text;
begin
 perform private.check_player(p_player);
 previous := private.receipt(p_player,p_request,'create','{}'::jsonb);
 if previous is not null then return previous; end if;
 if (select count(*) from public.online_matches where owner_id=p_player and phase='waiting' and expires_at>now()) >= 3 then raise exception 'room_limit'; end if;
 if (select count(*) from public.online_matches where owner_id=p_player and created_at > now()-interval '1 hour') >= 20 then raise exception 'rate_limit'; end if;
 select display_name into display from public.profiles where id=p_player;
 insert into public.online_matches(owner_id,owner_name,game) values(p_player,display,p_game) returning id into new_id;
 insert into private.invites(match_id,digest) values(new_id,p_digest);
 response := public.arena_snapshot(new_id);
 insert into private.command_receipts(player_id,request_id,action,fingerprint,response) values(p_player,p_request,'create','{}'::jsonb,response);
 return response;
end $$;

create function public.arena_join(p_player uuid,p_request uuid,p_digest text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.online_matches; previous jsonb; response jsonb; fingerprint jsonb; display text;
begin
 perform private.check_player(p_player);
 fingerprint := jsonb_build_object('digest',p_digest);
 previous := private.receipt(p_player,p_request,'join',fingerprint);
 if previous is not null then return previous; end if;
 select matches.* into m from public.online_matches matches join private.invites i on i.match_id=matches.id where i.digest=p_digest for update of matches;
 if not found then raise exception 'invalid_invite'; end if;
 if p_player=m.owner_id or p_player=m.guest_id then return public.arena_snapshot(m.id); end if;
 if m.phase <> 'waiting' or m.guest_id is not null then raise exception 'room_unavailable'; end if;
 if m.expires_at <= now() then raise exception 'invite_expired'; end if;
 select display_name into display from public.profiles where id=p_player;
 update public.online_matches set guest_id=p_player,guest_name=display,phase='active',revision=revision+1,updated_at=now() where id=m.id;
 response := public.arena_snapshot(m.id);
 insert into private.command_receipts(player_id,request_id,action,fingerprint,response) values(p_player,p_request,'join',fingerprint,response);
 return response;
end $$;

create function public.arena_commit_move(p_player uuid,p_request uuid,p_match uuid,p_revision integer,p_square integer,p_game jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.online_matches; previous jsonb; response jsonb; fingerprint jsonb; mark text;
begin
 perform private.check_player(p_player);
 fingerprint := jsonb_build_object('matchId',p_match,'expectedRevision',p_revision,'square',p_square);
 previous := private.receipt(p_player,p_request,'move',fingerprint);
 if previous is not null then return previous; end if;
 select * into m from public.online_matches where id=p_match for update;
 if not found or not coalesce(p_player=m.owner_id or p_player=m.guest_id,false) then raise exception 'not_participant'; end if;
 if m.phase <> 'active' then raise exception 'match_inactive'; end if;
 if m.revision <> p_revision then raise exception 'stale_revision'; end if;
 mark := case when p_player=m.owner_id then 'X' else 'O' end;
 if m.game->>'turn' <> mark then raise exception 'wrong_turn'; end if;
 if p_square not between 0 and 8 or p_square is null then raise exception 'invalid_square'; end if;
 if m.game->'board'->p_square <> 'null'::jsonb then raise exception 'occupied_square'; end if;
 -- p_game is computed by the Edge Function using the shared engine, never a client payload.
 if p_game->'moves' <> ((m.game->'moves') || jsonb_build_array(p_square)) or p_game->>'first' <> m.game->>'first' then raise exception 'invalid_server_state'; end if;
 insert into public.online_moves(match_id,ply,player_id,square,mark,request_id) values(m.id,jsonb_array_length(p_game->'moves'),p_player,p_square,mark,p_request);
 update public.online_matches set game=p_game,revision=revision+1,phase=case when p_game->>'status'='playing' then 'active' else 'completed' end,
 result=case when p_game->>'status'='draw' then 'draw' else p_game->>'winner' end, updated_at=now() where id=m.id;
 response := public.arena_snapshot(m.id);
 insert into private.command_receipts(player_id,request_id,action,fingerprint,response) values(p_player,p_request,'move',fingerprint,response);
 return response;
end $$;

create function public.arena_end(p_player uuid,p_request uuid,p_match uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.online_matches; previous jsonb; response jsonb; fingerprint jsonb;
begin
 perform private.check_player(p_player);
 fingerprint := jsonb_build_object('matchId',p_match,'expectedRevision',p_revision);
 previous := private.receipt(p_player,p_request,'end',fingerprint);
 if previous is not null then return previous; end if;
 select * into m from public.online_matches where id=p_match for update;
 if not found or not coalesce(p_player=m.owner_id or p_player=m.guest_id,false) then raise exception 'not_participant'; end if;
 if m.revision <> p_revision then raise exception 'stale_revision'; end if;
 if m.phase not in ('waiting','active') then raise exception 'match_inactive'; end if;
 update public.online_matches set phase=case when m.phase='waiting' then 'cancelled' else 'forfeited' end,
 result=case when m.phase='waiting' then null when p_player=m.owner_id then 'O' else 'X' end,
 revision=revision+1,updated_at=now() where id=m.id;
 response := public.arena_snapshot(m.id);
 insert into private.command_receipts(player_id,request_id,action,fingerprint,response) values(p_player,p_request,'end',fingerprint,response);
 return response;
end $$;

-- Preserve accepted games with anonymized identities while removing profile data.
create function public.arena_delete_account(p_player uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform id from public.profiles where id=p_player for update;
 update public.online_matches set phase=case when phase in ('waiting','active') then 'abandoned' else phase end,
 result=case when phase in ('waiting','active') then null else result end,
 owner_name=case when owner_id=p_player then 'Deleted player' else owner_name end,
 guest_name=case when guest_id=p_player then 'Deleted player' else guest_name end,
 revision=revision+1,updated_at=now() where p_player in (owner_id,guest_id);
 -- Cached command snapshots also contain participant names/IDs. Retire them;
 -- the match is now closed, so retries cannot append another accepted move.
 delete from private.command_receipts
 where response #>> '{players,X}' = p_player::text or response #>> '{players,O}' = p_player::text;
 delete from public.profiles where id=p_player;
end $$;

-- No caller can infer private match state through these definer functions.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.arena_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.arena_create(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.arena_join(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.arena_commit_move(uuid,uuid,uuid,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.arena_end(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.arena_delete_account(uuid) from public,anon,authenticated;
grant execute on function public.arena_snapshot(uuid),public.arena_create(uuid,uuid,text,jsonb),public.arena_join(uuid,uuid,text),public.arena_commit_move(uuid,uuid,uuid,integer,integer,jsonb),public.arena_end(uuid,uuid,uuid,integer),public.arena_delete_account(uuid) to service_role;

-- UPDATE-only subscriptions; participant RLS protects records. No client Presence is
-- used to determine a result. Connection loss never awards a win.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.online_matches;
 end if;
end $$;
create function public.arena_receipt(p_player uuid,p_request uuid,p_action text,p_fingerprint jsonb) returns jsonb language sql security definer set search_path = '' as $$
 select private.receipt(p_player,p_request,p_action,p_fingerprint);
$$;
revoke all on function public.arena_receipt(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.arena_receipt(uuid,uuid,text,jsonb) to service_role;
