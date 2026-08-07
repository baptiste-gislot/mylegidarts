#!/usr/bin/env bash
# Pourquoi l'annonceur perd-il la voix Piper après un redémarrage ?
#
# Lecture seule : ce script ne modifie rien, il déroule la chaîne
# Chromium → speech-dispatcher → module « piper » → serveur HTTP Piper
# et signale ce qui cloche à chaque maillon.
#
# Usage : bash diagnostic-voix.sh      (avec l'utilisateur qui lance Chromium,
#                                       PAS avec sudo — la config de
#                                       speech-dispatcher dépend de l'utilisateur)
PORT=5005
MODULES_DIR=/usr/lib/speech-dispatcher-modules
SYSTEM_CONF=/etc/speech-dispatcher/speechd.conf
USER_CONF="$HOME/.config/speech-dispatcher/speechd.conf"

titre() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
ko() { printf '  \033[31m✗ %s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓ %s\033[0m\n' "$1"; }

echo "Diagnostic annonceur — utilisateur $(id -un), $(date '+%F %T')"

titre "1. Serveur Piper (systemd)"
if [[ "$(systemctl is-enabled piper-tts 2>/dev/null)" == enabled ]]; then
  ok "piper-tts activé au démarrage"
else
  ko "piper-tts n'est PAS activé au démarrage — « sudo systemctl enable --now piper-tts »"
fi
if [[ "$(systemctl is-active piper-tts 2>/dev/null)" == active ]]; then
  ok "piper-tts tourne depuis $(systemctl show -p ActiveEnterTimestamp --value piper-tts)"
else
  ko "piper-tts est arrêté — « journalctl -u piper-tts -e » pour la raison"
fi

titre "2. Le serveur répond-il, et en combien de temps ?"
# Le premier appel après un boot charge le modèle : c'est là que ça peut traîner.
debut=$(date +%s%N)
if printf 'Test' | jq -Rs '{text: .}' |
  curl -sf --max-time 20 -X POST -H 'Content-Type: application/json' -d @- \
    -o /dev/null "http://127.0.0.1:$PORT/synthesize"; then
  ok "synthèse OK en $(( ($(date +%s%N) - debut) / 1000000 )) ms"
else
  ko "pas de réponse sur 127.0.0.1:$PORT — le module speech-dispatcher parlera dans le vide"
fi

titre "3. Ordre au démarrage : Piper prêt avant Chromium ?"
piper_debut=$(systemctl show -p ActiveEnterTimestampMonotonic --value piper-tts 2>/dev/null)
chromium_pid=$(pgrep -o -f 'chromium|chrome' || true)
if [[ -n "$chromium_pid" ]]; then
  echo "  Chromium (pid $chromium_pid) démarré à $(ps -o lstart= -p "$chromium_pid")"
  echo "  piper-tts prêt à     $(systemctl show -p ActiveEnterTimestamp --value piper-tts)"
  [[ -n "$piper_debut" ]] &&
    echo "  (si Chromium démarre avant, il ouvre sa liste de voix sans Piper et la garde)"
else
  echo "  Chromium n'est pas lancé."
fi

titre "4. Quelle configuration speech-dispatcher fait foi ?"
# Piège classique : un fichier utilisateur masque complètement /etc, et le test
# d'installation lancé en sudo ne le voit pas (il lit celui de root).
if [[ -f "$USER_CONF" ]]; then
  ko "config utilisateur présente — elle MASQUE $SYSTEM_CONF :"
  grep -E '^\s*(AddModule|DefaultModule)' "$USER_CONF" | sed 's/^/      /'
else
  ok "pas de config utilisateur, c'est $SYSTEM_CONF qui s'applique"
fi
grep -E '^\s*(AddModule|DefaultModule)' "$SYSTEM_CONF" 2>/dev/null | sed 's/^/      /'

titre "5. Le module espeak-ng est-il revenu ?"
# install-piper.sh l'écarte en le renommant : une mise à jour du paquet
# speech-dispatcher le réinstalle, et Chromium repart dessus.
if [[ -x "$MODULES_DIR/sd_espeak-ng" ]]; then
  ko "sd_espeak-ng est de retour → l'annonceur peut retomber sur la voix robotique"
  echo "      Dernières opérations dpkg sur speech-dispatcher :"
  grep -h 'speech-dispatcher' /var/log/dpkg.log /var/log/dpkg.log.1 2>/dev/null |
    tail -5 | sed 's/^/      /'
else
  ok "sd_espeak-ng toujours écarté"
fi

titre "6. Modules et voix vus par speech-dispatcher"
echo "  Modules : $(spd-say -O 2>&1 | tr '\n' ' ')"
echo "  Voix fr : $(spd-say -L 2>/dev/null | grep -i '^\s*fr' | head -5 | tr '\n' ' ')"

titre "7. Test à l'oreille"
echo "  spd-say -o piper -l fr « … »  → doit sortir en voix neuronale"
spd-say -o piper -l fr "Test de l'annonceur avec la voix Piper." 2>&1 | sed 's/^/      /' || true

titre "8. Côté Chromium"
cat <<'FIN'
  La liste des voix est propre au processus Chromium et figée à la connexion
  avec speech-dispatcher. Sur le kiosque, survoler le bouton 🔊 : son titre
  nomme la voix retenue par l'annonceur. Sinon, dans la console :
      speechSynthesis.getVoices().map(v => v.name)
  Une liste vide ou sans « fr_FR-… » = Chromium n'a jamais vu Piper : le
  relancer complètement (redémarrer le service kiosk) une fois piper-tts prêt.
FIN
