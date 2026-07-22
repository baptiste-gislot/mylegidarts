export function SetupNotice() {
  return (
    <div className="setup-notice">
      <p className="empty__title">Supabase n’est pas configuré</p>
      <ol>
        <li>Créez un projet sur supabase.com.</li>
        <li>
          Exécutez <code>supabase/schema.sql</code> dans le SQL Editor du projet.
        </li>
        <li>
          Copiez <code>.env.local.example</code> vers <code>.env.local</code> et renseignez{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Relancez le serveur.</li>
      </ol>
    </div>
  )
}
