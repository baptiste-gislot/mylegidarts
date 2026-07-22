-- Migration : groupement des sessions par partie + surnoms des joueurs.
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- Les sessions enregistrées ensemble partagent un match_id.
alter table public.sessions add column if not exists match_id uuid;
create index if not exists sessions_match_id_idx on public.sessions (match_id);

-- Surnom optionnel des joueurs (« Le Sniper de la compta »).
alter table public.players add column if not exists nickname text;

-- Les surnoms sont modifiables : politique update sur players uniquement
-- (les sessions restent immuables, pas de politique update dessus).
drop policy if exists "players open update" on public.players;
create policy "players open update" on public.players for update using (true) with check (true);
