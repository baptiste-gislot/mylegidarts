-- Punchlines maison : chacun peut enrichir le répertoire de l'annonceur.
-- Deux familles : les piques (taunt) et les compliments (congrat), chacune
-- avec son seuil de déclenchement sur le total de la volée.

create table if not exists public.punchlines (
  id uuid primary key default gen_random_uuid(),
  -- taunt : dite quand la volée fait AU PLUS `threshold` points.
  -- congrat : dite quand la volée fait AU MOINS `threshold` points.
  kind text not null check (kind in ('taunt', 'congrat')),
  text text not null check (char_length(btrim(text)) between 1 and 200),
  threshold int not null check (threshold between 0 and 180),
  created_at timestamptz not null default now()
);

alter table public.punchlines enable row level security;

-- Contenu léger et collectif : lecture, ajout et retrait ouverts pour anon
-- (contrairement aux sessions, supprimer une punchline ne fait perdre aucun score).
create policy "punchlines open read" on public.punchlines for select using (true);
create policy "punchlines open insert" on public.punchlines for insert with check (true);
create policy "punchlines open delete" on public.punchlines for delete using (true);

alter publication supabase_realtime add table public.punchlines;

update public.schema_version set version = 8 where id = 1;
