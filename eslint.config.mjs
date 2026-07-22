import coreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  {
    rules: {
      // L'app restaure volontairement des états depuis localStorage au montage
      // (cache, session en cours, préférences) : le faire dans un effet est le
      // pattern anti-mismatch d'hydratation. On garde la règle en avertissement.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default config
