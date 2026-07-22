-- Schéma du leaderboard de fléchettes.
-- À exécuter dans le SQL Editor de votre projet Supabase.

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
  created_at timestamptz not null default now()
);

create index if not exists sessions_player_id_idx on public.sessions (player_id);
create index if not exists sessions_match_id_idx on public.sessions (match_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

-- App ouverte sans authentification : lecture/écriture pour le rôle anon.
alter table public.players enable row level security;
alter table public.sessions enable row level security;

create policy "players open read" on public.players for select using (true);
create policy "players open insert" on public.players for insert with check (true);
create policy "players open delete" on public.players for delete using (true);
-- update limité aux players (surnoms) ; les sessions restent immuables.
create policy "players open update" on public.players for update using (true) with check (true);

create policy "sessions open read" on public.sessions for select using (true);
create policy "sessions open insert" on public.sessions for insert with check (true);
create policy "sessions open delete" on public.sessions for delete using (true);

-- Diffusion temps réel des changements vers les clients connectés.
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.sessions;

-- Vues d'agrégats (classement, historique) — voir migrations/2026-07-22-vues-stats.sql
create or replace view public.session_stats
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
       coalesce(count(*) filter (where v.volley_total = 180), 0)::int as count_180
from public.sessions s
left join volleys v on v.id = s.id
group by s.id;

create or replace view public.player_month_stats
with (security_invoker = true) as
select player_id,
       to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM') as month,
       count(*)::int as sessions_count,
       max(total)::int as best_total,
       sum(total)::int as sum_total,
       max(best_volley)::int as best_volley,
       sum(count_180)::int as count_180
from public.session_stats
group by player_id, to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM');

grant select on public.session_stats, public.player_month_stats to anon, authenticated;
