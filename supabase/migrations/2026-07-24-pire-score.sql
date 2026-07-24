-- Migration v5 : pire score par joueur/mois (classement « plus petit score »).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Vue player_month_stats : + worst_total ----------
drop view if exists public.player_month_stats;
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
where mode = 'volees'
group by player_id, to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM');

grant select on public.player_month_stats to anon, authenticated;

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 5)
on conflict (id) do update set version = 5;
