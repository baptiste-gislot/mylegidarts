-- Migration v4 : verrou de suppression, version de schéma, duels, mode 301.
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Version de schéma (garde-fou côté app) ----------
create table if not exists public.schema_version (
  id int primary key default 1 check (id = 1),
  version int not null
);
alter table public.schema_version enable row level security;
drop policy if exists "version open read" on public.schema_version;
create policy "version open read" on public.schema_version for select using (true);

-- ---------- Mode de jeu (défi 4 volées / 301) ----------
alter table public.sessions add column if not exists mode text not null default 'volees'
  check (mode in ('volees', '301'));
alter table public.sessions add column if not exists won boolean;

-- ---------- Verrou de suppression ----------
-- Plus de delete direct pour le rôle anon : la suppression passe par des
-- fonctions qui exigent le code d'équipe (modifiable ci-dessous).
drop policy if exists "players open delete" on public.players;
drop policy if exists "sessions open delete" on public.sessions;

create table if not exists public.league_settings (
  id int primary key default 1 check (id = 1),
  delete_code text not null
);
-- Code par défaut : 180. À changer :
--   update public.league_settings set delete_code = 'votre-code';
insert into public.league_settings (id, delete_code) values (1, '180')
on conflict (id) do nothing;
-- RLS sans aucune politique : la table est invisible pour anon,
-- seules les fonctions security definer peuvent la lire.
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

-- ---------- Vues mises à jour (mode/won) ----------
drop view if exists public.player_month_stats;
drop view if exists public.session_stats;

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
       sum(total)::int as sum_total,
       max(best_volley)::int as best_volley,
       sum(count_180)::int as count_180
from public.session_stats
where mode = 'volees'
group by player_id, to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM');

-- ---------- Face-à-face (parties à exactement 2 joueurs) ----------
create or replace view public.duel_stats
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

-- ---------- Marquer la version ----------
insert into public.schema_version (id, version) values (1, 4)
on conflict (id) do update set version = 4;
