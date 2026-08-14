-- Répertoire unifié : les punchlines d'origine (jusqu'ici en dur dans le
-- code) rejoignent la table punchlines. Plus de distinction origine/maison :
-- tout s'édite, tout se supprime, et l'annonceur tire au hasard dans le pot
-- commun des lignes dont le seuil est atteint.

-- Nouvelle famille « flop » : les piques affichées au tableau du classement
-- « plus petit score » (le seuil est ignoré pour cette famille).
alter table public.punchlines drop constraint if exists punchlines_kind_check;
alter table public.punchlines
  add constraint punchlines_kind_check check (kind in ('taunt', 'congrat', 'flop'));

-- Tout éditable : l'update rejoint l'insert et le delete déjà ouverts.
create policy "punchlines open update" on public.punchlines
  for update using (true) with check (true);

-- Semis du répertoire d'origine. Idempotent : une ligne déjà présente
-- (même famille, même texte) n'est pas resemée.
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

update public.schema_version set version = 9 where id = 1;
