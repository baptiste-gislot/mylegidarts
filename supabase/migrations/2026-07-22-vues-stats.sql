-- Migration : vues d'agrégats pour alléger le classement et l'historique.
-- À exécuter dans le SQL Editor de Supabase (idempotente).
-- Les mois sont calculés en Europe/Paris (fuseau de l'équipe).

-- Stats par session : meilleure volée et nombre de 180, sans exposer
-- le détail des fléchettes. Utilisée par l'historique paginé.
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

-- Stats par joueur et par mois : tout ce qu'il faut pour le classement
-- (record, moyenne, volée max, 180), le palmarès et le podium mensuel.
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
