-- Schéma du leaderboard de fléchettes.
-- À exécuter dans le SQL Editor de votre projet Supabase.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint players_name_unique unique (name)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  -- 12 fléchettes : [{ "sector": 20, "mult": 3 }, ...] (sector 0 = raté, 25 = bull)
  darts jsonb not null,
  total int not null check (total between 0 and 720),
  created_at timestamptz not null default now()
);

create index if not exists sessions_player_id_idx on public.sessions (player_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

-- App ouverte sans authentification : lecture/écriture pour le rôle anon.
alter table public.players enable row level security;
alter table public.sessions enable row level security;

create policy "players open read" on public.players for select using (true);
create policy "players open insert" on public.players for insert with check (true);
create policy "players open delete" on public.players for delete using (true);

create policy "sessions open read" on public.sessions for select using (true);
create policy "sessions open insert" on public.sessions for insert with check (true);
create policy "sessions open delete" on public.sessions for delete using (true);

-- Diffusion temps réel des changements vers les clients connectés.
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.sessions;
