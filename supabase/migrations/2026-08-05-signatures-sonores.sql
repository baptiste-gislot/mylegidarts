-- Migration v7 : signature sonore des joueurs (MP3 joué à leur tour).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Colonne : chemin du MP3 dans le bucket « signatures » ----------
alter table public.players add column if not exists signature_path text;

-- ---------- Bucket public (lecture par URL directe, sans politique) ----------
-- Taille et type verrouillés côté serveur : l'app refuse déjà en amont,
-- ceci empêche un contournement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', true, 2097152, array['audio/mpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['audio/mpeg'];

-- App ouverte sans authentification : écriture pour le rôle anon, limitée au
-- bucket. Le select est requis par le remove() du client (delete ... returning).
drop policy if exists "signatures open read" on storage.objects;
create policy "signatures open read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'signatures');

drop policy if exists "signatures open insert" on storage.objects;
create policy "signatures open insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'signatures');

drop policy if exists "signatures open delete" on storage.objects;
create policy "signatures open delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'signatures');

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 7)
on conflict (id) do update set version = 7;
