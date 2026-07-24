-- Schéma complet MyLegiDarts (version 5).
-- Pour une installation neuve : exécuter ce fichier dans le SQL Editor.
-- Pour une base existante : exécuter les fichiers de migrations/ dans l'ordre.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  created_at timestamptz not null default now(),
  constraint players_name_unique unique (name)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  -- Les sessions enregistrées ensemble (même partie) partagent un match_id.
  match_id uuid,
  -- 12 fléchettes : [{ "sector": 20, "mult": 3 }, ...] (sector 0 = raté, 25 = bull)
  darts jsonb not null,
  total int not null check (total between 0 and 720),
  mode text not null default 'volees' check (mode in ('volees', '301')),
  won boolean,
  created_at timestamptz not null default now()
);

create index if not exists sessions_player_id_idx on public.sessions (player_id);
create index if not exists sessions_match_id_idx on public.sessions (match_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

-- App ouverte sans authentification : lecture/écriture pour le rôle anon,
-- mais PAS de delete direct (voir les fonctions à code plus bas) ni
-- d'update sauf sur players (surnoms).
alter table public.players enable row level security;
alter table public.sessions enable row level security;

create policy "players open read" on public.players for select using (true);
create policy "players open insert" on public.players for insert with check (true);
create policy "players open update" on public.players for update using (true) with check (true);

create policy "sessions open read" on public.sessions for select using (true);
create policy "sessions open insert" on public.sessions for insert with check (true);

-- Diffusion temps réel des changements vers les clients connectés.
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.sessions;

-- ---------- Version de schéma (garde-fou côté app) ----------
create table if not exists public.schema_version (
  id int primary key default 1 check (id = 1),
  version int not null
);
alter table public.schema_version enable row level security;
create policy "version open read" on public.schema_version for select using (true);
insert into public.schema_version (id, version) values (1, 5)
on conflict (id) do update set version = 5;

-- ---------- Verrou de suppression ----------
create table if not exists public.league_settings (
  id int primary key default 1 check (id = 1),
  delete_code text not null
);
-- Code par défaut : 180. À changer :
--   update public.league_settings set delete_code = 'votre-code';
insert into public.league_settings (id, delete_code) values (1, '180')
on conflict (id) do nothing;
alter table public.league_settings enable row level security;
revoke all on public.league_settings from anon, authenticated;

create or replace function public.delete_sessions(ids uuid[], code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code is distinct from (select delete_code from league_settings where id = 1) then
    raise exception 'code invalide';
  end if;
  delete from sessions where id = any(ids);
end;
$$;

create or replace function public.delete_player(pid uuid, code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code is distinct from (select delete_code from league_settings where id = 1) then
    raise exception 'code invalide';
  end if;
  delete from players where id = pid; -- les sessions suivent (cascade)
end;
$$;

grant execute on function public.delete_sessions(uuid[], text) to anon, authenticated;
grant execute on function public.delete_player(uuid, text) to anon, authenticated;

-- ---------- Vues d'agrégats ----------
create view public.session_stats
with (security_invoker = true) as
with volleys as (
  select s.id,
         (d.ord - 1) / 3 as volley_index,
         sum((d.dart ->> 'sector')::int * (d.dart ->> 'mult')::int) as volley_total
  from public.sessions s,
       lateral jsonb_array_elements(s.darts) with ordinality as d(dart, ord)
  group by s.id, (d.ord - 1) / 3
)
select s.id,
       s.player_id,
       s.match_id,
       s.total,
       s.created_at,
       coalesce(max(v.volley_total), 0)::int as best_volley,
       coalesce(count(*) filter (where v.volley_total = 180), 0)::int as count_180,
       s.mode,
       s.won
from public.sessions s
left join volleys v on v.id = s.id
group by s.id;

-- Le classement ne compte que le défi 4 volées.
create view public.player_month_stats
with (security_invoker = true) as
select player_id,
       to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM') as month,
       count(*)::int as sessions_count,
       max(total)::int as best_total,
       min(total)::int as worst_total,
       sum(total)::int as sum_total,
       max(best_volley)::int as best_volley,
       sum(count_180)::int as count_180
from public.session_stats
where mode = 'volees'
group by player_id, to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM');

-- ---------- Face-à-face (parties à exactement 2 joueurs) ----------
create view public.duel_stats
with (security_invoker = true) as
with two_player_matches as (
  select match_id
  from public.sessions
  where match_id is not null
  group by match_id
  having count(*) = 2
)
select a.player_id,
       b.player_id as opponent_id,
       count(*)::int as played,
       count(*) filter (
         where (a.mode = 'volees' and a.total > b.total) or (a.mode = '301' and a.won)
       )::int as wins,
       count(*) filter (
         where (a.mode = 'volees' and a.total < b.total) or (a.mode = '301' and b.won)
       )::int as losses
from public.sessions a
join public.sessions b on b.match_id = a.match_id and b.id <> a.id
where a.match_id in (select match_id from two_player_matches)
group by a.player_id, b.player_id;

grant select on public.session_stats, public.player_month_stats, public.duel_stats
  to anon, authenticated;
