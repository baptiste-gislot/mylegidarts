-- Migration v11 : jeux au tour par tour (Cricket, Around the clock, Killer, Shanghai).
-- À exécuter dans le SQL Editor de Supabase (idempotente).

-- ---------- Nouveaux modes de jeu ----------
alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions add constraint sessions_mode_check
  check (mode in ('volees', '301', 'fletanque', 'cricket', 'clock', 'killer', 'shanghai'));

-- Le total porte le score propre à chaque jeu (points au Cricket et au
-- Shanghai, cases franchies à l'Around the clock, vies restantes au Killer) :
-- la borne de 720 ne vaut que pour le défi.
alter table public.sessions drop constraint if exists sessions_total_check;
alter table public.sessions add constraint sessions_total_check
  check (
    total >= 0
    and (total <= 720 or powers is not null or mode in ('cricket', 'clock', 'killer', 'shanghai'))
  );

-- ---------- Face-à-face : tous les jeux comptent ----------
-- Au défi, le plus gros total gagne ; ailleurs, c'est le drapeau won. Deux
-- vainqueurs ex æquo (Shanghai aux points) ne gagnent ni ne perdent.
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
         where (a.mode = 'volees' and a.total > b.total)
            or (a.mode <> 'volees' and a.won and not coalesce(b.won, false))
       )::int as wins,
       count(*) filter (
         where (a.mode = 'volees' and a.total < b.total)
            or (a.mode <> 'volees' and b.won and not coalesce(a.won, false))
       )::int as losses
from public.sessions a
join public.sessions b on b.match_id = a.match_id and b.id <> a.id
where a.match_id in (select match_id from two_player_matches)
group by a.player_id, b.player_id;

grant select on public.duel_stats to anon, authenticated;

-- ---------- Version de schéma ----------
insert into public.schema_version (id, version) values (1, 11)
on conflict (id) do update set version = 11;
