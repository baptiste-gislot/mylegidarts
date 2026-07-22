# MyLegiDarts

PWA de leaderboard de fléchettes pour MyLegiTech. Le défi : **4 volées de 3 fléchettes**, saisies fléchette par fléchette — le meilleur score total fait le classement.

## Fonctionnalités

- **Tirer** : session multi-joueurs (volées alternées), clavier de saisie Simple/Double/Triple, 25, Bull, Raté, avec annulation.
- **Classement** : record par joueur, moyenne, meilleure volée, badge bullseye pour le leader.
- **Historique** : détail des sessions volée par volée, suppression possible.
- **Joueurs** : ajout/suppression (les sessions du joueur supprimé partent avec lui).
- Données partagées en temps réel entre appareils via Supabase (app ouverte, sans authentification).
- PWA installable (manifest + service worker Serwist), UI mobile-first.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Supabase (Postgres + Realtime) · Serwist.

## Mise en route

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans le **SQL Editor** du projet, exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql) (tables, politiques RLS ouvertes, publication temps réel).
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
