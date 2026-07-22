# MyLegiDarts

PWA de leaderboard de fléchettes. Le défi : **4 volées de 3 fléchettes**, saisies fléchette par fléchette — le meilleur score total fait le classement.

## Fonctionnalités

- **Classement** : deux critères (meilleur score / moyenne par partie) × deux périodes (mois en cours / depuis toujours), palmarès des vainqueurs mensuels, podium célébré au changement de mois, néon sur le leader.
- **Ambiance** : annonceur vocal (180, records, relais entre joueurs, trash-talk sur les volées ratées), bruitages d'impact synthétisés (WebAudio, PC et mobile), confettis, vibrations, toasts. Bouton 🔊 dans l'en-tête pour tout couper.
- **Historique** : groupé par partie (vainqueur mis en avant), détail volée par volée sur `/partie/[id]`.
- **Joueurs** : surnoms éditables, utilisés par l'annonceur et le live.
- **301** : deuxième jeu (premier à zéro exactement, bust si dépassement, sortie sèche) — hors classement, mais compté dans les face-à-face.
- **Face-à-face** : bilan des duels (parties à 2) sur la page profil, tous modes confondus.
- **Suppression verrouillée** : joueurs et parties ne se suppriment qu'avec le code d'équipe (fonctions SQL `security definer` ; code par défaut `180`, à changer dans `league_settings`).
- **QR d'installation** : page `/inviter` imprimable, liée depuis Joueurs.
- **Garde-fou de schéma** : l'app vérifie la version de la base au démarrage et réclame la migration manquante au lieu d'échouer silencieusement.

## Développement

Tests (Vitest), lint (ESLint) et types sont vérifiés par la CI GitHub Actions à chaque push :

```bash
npm test         # tests unitaires du cœur métier (scoring, 301, parties)
npm run lint
npm run typecheck
```

- **Tirer** : session multi-joueurs (volées alternées), clavier de saisie Simple/Double/Triple, 25, Bull, Raté, avec annulation.
- **Classement** : record par joueur, moyenne, meilleure volée, badge bullseye pour le leader.
- **Historique** : détail des sessions volée par volée, suppression possible.
- **Joueurs** : ajout/suppression (les sessions du joueur supprimé partent avec lui).
- **Direct** : les parties en cours sont visibles en live par les autres appareils (`/live`, bannière sur le classement) via Supabase Realtime Presence — rien n’est écrit en base tant que la session n’est pas enregistrée. La session en cours survit à un changement d’onglet ou un rechargement (reprise automatique pendant 6 h).
- Données partagées en temps réel entre appareils via Supabase (app ouverte, sans authentification).
- PWA installable (manifest + service worker Serwist), UI mobile-first.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Supabase (Postgres + Realtime) · Serwist.

## Mise en route

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans le **SQL Editor** du projet, exécutez [`supabase/schema.sql`](supabase/schema.sql) pour une installation neuve, ou les migrations de [`supabase/migrations/`](supabase/migrations) sur une base existante.
3. Copiez `.env.local.example` vers `.env.local` et renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API).
4. Installez et lancez :

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — serveur de développement (service worker désactivé en dev).
- `npm run build` / `npm start` — build et serveur de production.
- `npm run icons` — régénère les icônes PWA (`scripts/make-icons.mjs`, aucune dépendance).

## À savoir

- **Pas d'authentification** : quiconque possède l'URL et la clé anon peut lire et écrire. C'est un choix assumé pour un usage d'équipe ; ne stockez rien de sensible.
- La suppression d'un joueur supprime ses sessions (cascade en base).
- Le service worker n'est actif qu'en production (`npm run build && npm start`).
