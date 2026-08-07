#!/usr/bin/env bash
# Remplace la voix espeak de l'annonceur par Piper (piper1-gpl, voix neuronale)
# sur le kiosque Ubuntu Server + Chromium.
#
# Architecture : Chromium → speech-dispatcher → module générique (curl)
#                → serveur HTTP Piper local (systemd, modèle gardé en mémoire).
#
# Usage : sudo ./install-piper.sh [voix]        (défaut : fr_FR-siwis-medium)
# Autres voix françaises : fr_FR-tom-medium (homme), fr_FR-upmc-medium (2 locuteurs).
# Relançable sans risque (idempotent). Restauration : voir README.md à côté.
set -euo pipefail

VOICE="${1:-fr_FR-siwis-medium}"
PIPER_HOME=/opt/piper
PORT=5005
SPEECHD_CONF=/etc/speech-dispatcher/speechd.conf
ESPEAK_MODULE=/usr/lib/speech-dispatcher-modules/sd_espeak-ng

[[ $EUID -eq 0 ]] || { echo "Lance-moi avec sudo." >&2; exit 1; }

echo "── Dépendances système"
apt-get update -qq
apt-get install -y -qq python3-venv jq curl alsa-utils speech-dispatcher

echo "── Piper dans un venv ($PIPER_HOME)"
python3 -m venv "$PIPER_HOME/venv"
"$PIPER_HOME/venv/bin/pip" install --quiet --upgrade pip
"$PIPER_HOME/venv/bin/pip" install --quiet 'piper-tts[http]'

echo "── Voix $VOICE"
mkdir -p "$PIPER_HOME/voices"
"$PIPER_HOME/venv/bin/python" -m piper.download_voices "$VOICE" --data-dir "$PIPER_HOME/voices"

echo "── Service systemd piper-tts (serveur HTTP local, port $PORT)"
cat > /etc/systemd/system/piper-tts.service <<UNIT
[Unit]
Description=Piper TTS — annonceur MyLegiDarts
After=network.target

[Service]
ExecStart=$PIPER_HOME/venv/bin/python -m piper.http_server --host 127.0.0.1 --port $PORT --data-dir $PIPER_HOME/voices -m $VOICE
WorkingDirectory=$PIPER_HOME/voices
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now piper-tts.service

echo "── Module speech-dispatcher « piper »"
# jq -Rs construit le JSON : les apostrophes des piques de l'annonceur survivent.
# aplay joue le WAV reçu ; si la sortie son passe par PulseAudio/PipeWire,
# remplacer « aplay -q - » par « paplay ».
# --retry-connrefused : au démarrage du kiosque, Piper charge encore son modèle
# quand la première annonce tombe — mieux vaut l'attendre que la perdre.
cat > /etc/speech-dispatcher/modules/piper.conf <<CONF
GenericExecuteSynth "printf %s \"\$DATA\" | jq -Rs '{text: .}' | curl -s --retry 5 --retry-connrefused --retry-delay 1 --max-time 30 -X POST -H 'Content-Type: application/json' -d @- -o - http://127.0.0.1:$PORT/synthesize | aplay -q -"
GenericCmdDependency "jq"
GenericCmdDependency "curl"
GenericCmdDependency "aplay"
GenericLanguage "fr" "fr" "utf-8"
AddVoice "fr" "FEMALE1" "$VOICE"
CONF

echo "── speechd.conf : Piper seul module actif"
cp -n "$SPEECHD_CONF" "$SPEECHD_CONF.avant-piper" || true
# Désactive les autres modules (sinon Chromium continue de lister les voix espeak).
sed -i -E '/^AddModule "piper"/! s/^AddModule /#&/' "$SPEECHD_CONF"
grep -q '^AddModule "piper"' "$SPEECHD_CONF" ||
  echo 'AddModule "piper" "sd_generic" "piper.conf"' >> "$SPEECHD_CONF"
sed -i -E 's/^#? *DefaultModule .*/DefaultModule piper/' "$SPEECHD_CONF"
grep -q '^DefaultModule' "$SPEECHD_CONF" || echo 'DefaultModule piper' >> "$SPEECHD_CONF"

echo "── Neutralisation du module espeak-ng de secours"
# speech-dispatcher charge toujours espeak-ng en secours (chemin codé en dur,
# invisible dans « spd-say -O ») et Chrome peut router la parole dessus.
# Un simple renommage serait défait par la prochaine mise à jour du paquet
# speech-dispatcher — et la voix robotique reviendrait au redémarrage suivant.
# Une diversion dpkg, elle, est respectée à chaque réinstallation.
# (sd_dummy reste en place pour les messages d'erreur.)
if [[ -f "$ESPEAK_MODULE.off" && ! -e "$ESPEAK_MODULE" ]]; then
  # Rattrape les installations précédentes, qui déplaçaient le binaire à la main.
  mv "$ESPEAK_MODULE.off" "$ESPEAK_MODULE"
fi
if ! dpkg-divert --list "$ESPEAK_MODULE" | grep -q .; then
  dpkg-divert --quiet --rename --divert "$ESPEAK_MODULE.off" --add "$ESPEAK_MODULE"
fi

echo "── Config utilisateur : elle masquerait tout ce qui précède"
# speech-dispatcher lit ~/.config/speech-dispatcher/speechd.conf s'il existe,
# et ignore alors complètement /etc. Le test ci-dessous tourne en root : il ne
# verrait pas le problème, seul l'utilisateur du kiosque est concerné.
if [[ -n "${SUDO_USER:-}" ]]; then
  USER_CONF="$(getent passwd "$SUDO_USER" | cut -d: -f6)/.config/speech-dispatcher/speechd.conf"
  if [[ -f "$USER_CONF" ]]; then
    echo "⚠ $USER_CONF existe et masque $SPEECHD_CONF."
    echo "  À écarter à la main : mv '$USER_CONF' '$USER_CONF.avant-piper'"
  fi
fi

echo "── Redémarrage de speech-dispatcher"
pkill -f speech-dispatcher || true

echo "── Test"
sleep 1
spd-say -o piper -l fr "Cent quatre-vingts ! L'annonceur a une nouvelle voix." ||
  echo "spd-say a échoué — vérifier « journalctl -u piper-tts » et la sortie son (aplay/paplay)."

echo
echo "Terminé. Redémarrer Chromium (ou le service kiosk) pour qu'il recharge les voix."
echo "Ce test-ci a tourné en root : pour valider la chaîne telle que Chromium la voit,"
echo "lancer « bash diagnostic-voix.sh » avec l'utilisateur du kiosque."
