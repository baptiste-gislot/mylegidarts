-- Schéma complet MyLegiDarts (version 9).
-- Pour une installation neuve : exécuter ce fichier dans le SQL Editor.
-- Pour une base existante : exécuter les fichiers de migrations/ dans l'ordre.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  -- Chemin du MP3 de signature dans le bucket storage « signatures ».
  signature_path text,
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
  -- Les bonus des pouvoirs peuvent dépasser 720 (borne réservée aux parties classiques).
  total int not null check (total >= 0 and (total <= 720 or powers is not null)),
  mode text not null default 'volees' check (mode in ('volees', '301')),
  won boolean,
  -- Null = partie sans pouvoirs. Sinon : { power, used, copied?, bonus, volleySizes }.
  powers jsonb,
  created_at timestamptz not null default now()
);

-- Le répertoire complet de l'annonceur : les lignes d'origine (semées plus
-- bas) et les ajouts des joueurs vivent dans le même pot, sans distinction.
create table if not exists public.punchlines (
  id uuid primary key default gen_random_uuid(),
  -- taunt : dite quand la volée fait AU PLUS `threshold` points.
  -- congrat : dite quand la volée fait AU MOINS `threshold` points.
  -- flop : affichée au tableau « plus petit score » (seuil ignoré).
  kind text not null check (kind in ('taunt', 'congrat', 'flop')),
  text text not null check (char_length(btrim(text)) between 1 and 200),
  threshold int not null check (threshold between 0 and 180),
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
alter table public.punchlines enable row level security;

create policy "players open read" on public.players for select using (true);
create policy "players open insert" on public.players for insert with check (true);
create policy "players open update" on public.players for update using (true) with check (true);

create policy "sessions open read" on public.sessions for select using (true);
create policy "sessions open insert" on public.sessions for insert with check (true);

-- Contenu léger et collectif : édition et suppression ouvertes, une punchline
-- ne fait perdre aucun score (contrairement aux sessions).
create policy "punchlines open read" on public.punchlines for select using (true);
create policy "punchlines open insert" on public.punchlines for insert with check (true);
create policy "punchlines open update" on public.punchlines for update using (true) with check (true);
create policy "punchlines open delete" on public.punchlines for delete using (true);

-- Diffusion temps réel des changements vers les clients connectés.
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.punchlines;

-- Semis du répertoire d'origine de l'annonceur. Idempotent : une ligne déjà
-- présente (même famille, même texte) n'est pas resemée. Chaque ligne reste
-- ensuite éditable et supprimable comme n'importe quelle punchline maison.
insert into public.punchlines (kind, text, threshold)
select v.kind, v.text, v.threshold
from (values
  -- Volée à zéro pile
  ('taunt', 'Zéro. Historique.', 0),
  ('taunt', 'Trois fléchettes, zéro point. Respect.', 0),
  ('taunt', 'Le sol est touché, la cible non.', 0),
  ('taunt', 'Personne n’a rien vu, promis.', 0),
  ('taunt', 'On encadre celle-là ?', 0),
  ('taunt', 'Trois lancers, zéro dégât. La cible te remercie.', 0),
  ('taunt', 'Statistiquement, c’est presque impossible. Bravo ?', 0),
  ('taunt', 'Même en visant à côté, tu aurais marqué.', 0),
  -- Volée faible
  ('taunt', 'La cible est en face, pourtant.', 20),
  ('taunt', 'Le mur, lui, n’avait rien demandé.', 20),
  ('taunt', 'On dira que c’était un tir de réglage.', 20),
  ('taunt', 'Même la craie a eu peur.', 20),
  ('taunt', 'Courageux de continuer.', 20),
  ('taunt', 'La fléchette a fait ce qu’elle a pu.', 20),
  ('taunt', 'Quelqu’un a bougé la cible, sûrement.', 20),
  ('taunt', 'Ça ira mieux au prochain café.', 20),
  ('taunt', 'On a vu des fléchettes plus motivées.', 20),
  ('taunt', 'C’est le coude ou la vue ?', 20),
  ('taunt', 'Le tableau ne juge pas. Nous, si.', 20),
  ('taunt', 'La prochaine tournée est pour toi, ça motive.', 20),
  ('taunt', 'Heureusement que c’est l’intention qui compte.', 20),
  ('taunt', 'Tu vises le 20 ou tu improvises ?', 20),
  ('taunt', 'La cible a plus peur de ton haleine que de tes fléchettes.', 20),
  ('taunt', 'C’était un échauffement, on va dire.', 20),
  ('taunt', 'Il paraît que la pratique paie. Un jour.', 20),
  ('taunt', 'Les lunettes, c’est remboursé par la mutuelle.', 20),
  ('taunt', 'Ta technique est unique. Garde-la pour toi.', 20),
  ('taunt', 'On lance avec la main, pas avec les yeux fermés.', 20),
  ('taunt', 'Le stagiaire fait mieux. Et il n’a pas de bras.', 20),
  ('taunt', 'Ce n’est plus du sport, c’est de l’art abstrait.', 20),
  ('taunt', 'Rassure-moi, tu tenais la fléchette dans le bon sens ?', 20),
  ('taunt', 'À peine plus de points que le nombre de cheveux d’Adrien.', 20),
  ('taunt', 'T’auras peut-être plus de succès si tu fais le canard comme César.', 20),
  ('taunt', 'Tu galères plus que Privel en compétition. Dur.', 20),
  ('taunt', 'Bientôt Baptiste aura plus d’enfants que t’as de points.', 20),
  ('taunt', 'T’allais passer pro, mais les croisés, tu connais.', 20),
  ('taunt', 'Sam Neill se retourne dans sa tombe.', 20),
  ('taunt', 'Si t’es pas content, va te plaindre à la RH.', 20),
  ('taunt', 'Reprends une dose de whey, c’est pour ton bien.', 20),
  ('taunt', 'Un score moins élevé que le degré des bières d’Aloïs.', 20),
  -- Bonne volée
  ('congrat', 'Belle volée !', 40),
  ('congrat', 'Propre.', 40),
  ('congrat', 'Voilà qui met la pression.', 40),
  ('congrat', 'Le sisal s’en souviendra.', 40),
  ('congrat', 'Ça commence à sentir le record.', 40),
  ('congrat', 'Joli bras.', 40),
  ('congrat', 'Voilà pourquoi on te laisse gagner au babyfoot.', 40),
  ('congrat', 'La cible n’a rien vu venir.', 40),
  ('congrat', 'Du travail d’orfèvre.', 40),
  ('congrat', 'Chirurgical.', 40),
  ('congrat', 'Quelqu’un s’est entraîné en cachette.', 40),
  ('congrat', 'Le genre de volée qui fait taire l’open space.', 40),
  -- Volée énorme
  ('congrat', 'Énorme !', 60),
  ('congrat', 'Ça, c’est du tir !', 60),
  ('congrat', 'On se calme, c’est censé être un loisir.', 60),
  ('congrat', 'Quelqu’un a pris une licence en douce.', 60),
  ('congrat', 'Le patron de la cible.', 60),
  ('congrat', 'Magistral !', 60),
  ('congrat', 'Appelez la fédération, il y a un dossier.', 60),
  ('congrat', 'La cible demande un arbitrage vidéo.', 60),
  ('congrat', 'C’est plus une volée, c’est une démonstration.', 60),
  ('congrat', 'Les autres peuvent rentrer chez eux.', 60),
  ('congrat', 'Standing ovation de la machine à café.', 60),
  ('congrat', 'On va devoir reculer la ligne de tir pour toi.', 60),
  -- Piques du tableau (plus petit score du mois)
  ('flop', 'Le tableau a demandé à rester anonyme.', 0),
  ('flop', 'Gardien officiel du bas du tableau.', 0),
  ('flop', 'La cible se souvient surtout du mur.', 0),
  ('flop', 'Un score pareil, ça se fête. Ou pas.', 0),
  ('flop', 'Le sisal a porté plainte.', 0),
  ('flop', 'Champion, mais dans l’autre sens.', 0),
  ('flop', 'Ce record-là, personne ne viendra le chercher.', 0),
  ('flop', 'La craie a refusé de l’écrire deux fois.', 0),
  ('flop', 'Validé par huissier, malheureusement.', 0),
  ('flop', 'On a vérifié : la cible était bien accrochée.', 0),
  ('flop', 'La moyenne de l’équipe te remercie d’exister.', 0),
  ('flop', 'Même le stagiaire n’ose pas commenter.', 0)
) as v(kind, text, threshold)
where not exists (
  select 1 from public.punchlines p where p.kind = v.kind and p.text = v.text
);

-- ---------- Version de schéma (garde-fou côté app) ----------
create table if not exists public.schema_version (
  id int primary key default 1 check (id = 1),
  version int not null
);
alter table public.schema_version enable row level security;
create policy "version open read" on public.schema_version for select using (true);
insert into public.schema_version (id, version) values (1, 9)
on conflict (id) do update set version = 9;

-- ---------- Signatures sonores (storage) ----------
-- Bucket public : le MP3 de chaque joueur se lit par URL directe.
-- Taille et type verrouillés côté serveur : l'app refuse déjà en amont,
-- ceci empêche un contournement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', true, 2097152, array['audio/mpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['audio/mpeg'];

-- Écriture pour le rôle anon, limitée au bucket. Le select est requis
-- par le remove() du client (delete ... returning).
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
       s.won,
       s.powers
from public.sessions s
left join volleys v on v.id = s.id
group by s.id;

-- Le classement ne compte que le défi 4 volées joué sans pouvoirs.
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
where mode = 'volees' and powers is null
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
