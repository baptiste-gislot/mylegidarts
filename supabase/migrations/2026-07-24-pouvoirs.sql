-- Migration v6 : système de pouvoirs (parties hors classement).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Colonne pouvoirs ----------
-- Null = partie sans pouvoirs. Sinon : { power, used, copied?, bonus, volleySizes }.
alter table public.sessions add column if not exists powers jsonb;

-- Les bonus et fléchettes de rab peuvent dépasser 720 : la borne haute ne
-- s'applique qu'aux parties classiques.
alter table public.sessions drop constraint if exists sessions_total_check;
alter table public.sessions add constraint sessions_total_check
  check (total >= 0 and (total <= 720 or powers is not null));

-- ---------- Vues : les parties avec pouvoirs restent hors classement ----------
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

grant select on public.session_stats, public.player_month_stats to anon, authenticated;

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 6)
on conflict (id) do update set version = 6;
