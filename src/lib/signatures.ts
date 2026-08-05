import { supabase } from './supabaseClient'

// Signatures sonores : chaque joueur peut déposer un petit MP3, joué à son
// entrée en piste (son premier tour de la partie). Les fichiers vivent dans
// le bucket storage public « signatures », la table players garde le chemin.

const BUCKET = 'signatures'

/** Taille maximale acceptée : 2 Mo (aussi verrouillée côté bucket). */
export const SIGNATURE_MAX_BYTES = 2_097_152

/** Vérifie qu'un fichier est un MP3 acceptable ; message d'erreur sinon. */
export function checkSignatureFile(file: File): string | null {
  const mp3 =
    file.type === 'audio/mpeg' || file.type === 'audio/mp3' || /\.mp3$/i.test(file.name)
  if (!mp3) return 'Format non reconnu : choisissez un fichier MP3.'
  if (file.size > SIGNATURE_MAX_BYTES) {
    return 'Fichier trop lourd (2 Mo max) — quelques secondes suffisent.'
  }
  return null
}

/** URL publique d'une signature à partir du chemin stocké en base. */
export function signatureUrl(path: string): string | null {
  if (!supabase) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Dépose le MP3 dans le bucket et renvoie son chemin. Le chemin est versionné
 * (horodatage) : un remplacement change d'URL et échappe aux caches CDN/navigateur.
 */
export async function uploadSignature(
  playerId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: 'Supabase n’est pas configuré.' }
  const path = `${playerId}-${Date.now()}.mp3`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'audio/mpeg' })
  if (error) return { error: error.message }
  return { path }
}

/** Supprime un fichier du bucket, sans bloquer si ça échoue (nettoyage). */
export function removeSignatureFile(path: string): void {
  void supabase?.storage.from(BUCKET).remove([path])
}
