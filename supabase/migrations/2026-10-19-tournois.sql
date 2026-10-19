-- Migration v12 : tournois (poules puis tableau).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Tournois ----------
-- Un tournoi ne stocke que ce qui ne se déduit pas des parties : sa
-- composition, les forfaits et les morts subites. Les résultats se lisent
-- dans les parties rattachées (sessions.tournament_id / tournament_slot).
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  mode text not null check (mode in ('volees', '301', 'cricket', 'clock', 'killer', 'shanghai')),
  -- Poules tirées à la création : [[id joueur, …], …], têtes de série en premier.
  pools jsonb not null,
  -- Joueurs déclarés forfait : [id joueur, …].
  forfeits jsonb not null default '[]'::jsonb,
  -- Morts subites du tableau : { "<rencontre>": { "winner": id, "volleys": [[a, b], …] } }.
  tiebreaks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;
drop policy if exists "tournaments open read" on public.tournaments;
create policy "tournaments open read" on public.tournaments for select using (true);
drop policy if exists "tournaments open insert" on public.tournaments;
create policy "tournaments open insert" on public.tournaments for insert with check (true);
drop policy if exists "tournaments open update" on public.tournaments;
create policy "tournaments open update" on public.tournaments for update using (true) with check (true);
-- Seuls forfaits et morts subites évoluent après la création.
revoke update on public.tournaments from anon, authenticated;
grant update (forfeits, tiebreaks) on public.tournaments to anon, authenticated;

-- ---------- Parties rattachées ----------
-- Supprimer un tournoi laisse ses parties : elles redeviennent des parties ordinaires.
alter table public.sessions
  add column if not exists tournament_id uuid references public.tournaments (id) on delete set null;
alter table public.sessions add column if not exists tournament_slot text;
create index if not exists sessions_tournament_id_idx on public.sessions (tournament_id);

-- ---------- Suppression au code ----------
create or replace function public.delete_tournament(tid uuid, code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code is distinct from (select delete_code from league_settings where id = 1) then
    raise exception 'code invalide';
  end if;
  delete from tournaments where id = tid;
end;
$$;

grant execute on function public.delete_tournament(uuid, text) to anon, authenticated;

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 12)
on conflict (id) do update set version = 12;
