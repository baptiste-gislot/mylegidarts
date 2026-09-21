-- Migration v10 : mode flétanque (la pétanque aux fléchettes, 2 contre 2).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Nouveau mode de jeu ----------
alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions add constraint sessions_mode_check
  check (mode in ('volees', '301', 'fletanque'));

-- Null = partie d'un autre mode. Sinon : { team, thrown, menes }.
-- Le total de la ligne porte le score final de l'équipe, won son sacre.
alter table public.sessions add column if not exists fletanque jsonb;

-- ---------- Vues : la flétanque reste hors classement ----------
-- (player_month_stats ne retient déjà que mode = 'volees' sans pouvoirs ;
-- duel_stats ne regarde que les parties à exactement deux joueurs, la
-- flétanque s'en tient donc écartée d'elle-même.)
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
       s.won,
       s.powers,
       s.fletanque
from public.sessions s
left join volleys v on v.id = s.id
group by s.id;

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

grant select on public.session_stats, public.player_month_stats to anon, authenticated;

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 10)
on conflict (id) do update set version = 10;
