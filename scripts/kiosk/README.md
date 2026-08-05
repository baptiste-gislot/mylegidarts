# Kiosque — voix Piper pour l'annonceur

Le kiosque (Ubuntu Server + Chromium en mode kiosk) utilise la synthèse vocale
du système via speech-dispatcher. Par défaut c'est espeak-ng, très robotique.
`install-piper.sh` la remplace par [Piper](https://github.com/OHF-Voice/piper1-gpl),
une voix neuronale locale de bien meilleure qualité.

## Installation

```bash
scp -r scripts/kiosk/ <kiosque>:/tmp/
ssh <kiosque> 'sudo bash /tmp/kiosk/install-piper.sh'
```

Puis redémarrer Chromium (ou le service kiosk). Rien à changer côté app :
Chromium ne verra plus que la voix Piper en `fr`, que l'annonceur choisit tout seul.

Voix par défaut : `fr_FR-siwis-medium` (femme). Alternatives :
`sudo bash install-piper.sh fr_FR-tom-medium` (homme),
`fr_FR-upmc-medium` (deux locuteurs). Catalogue complet :
`python3 -m piper.download_voices` (sans argument).

## Ce que fait le script

1. Installe Piper (`piper-tts[http]`) dans un venv sous `/opt/piper`.
2. Télécharge la voix dans `/opt/piper/voices`.
3. Crée le service systemd `piper-tts` : serveur HTTP local (port 5005) qui
   garde le modèle en mémoire — l'annonceur parle sans délai de chargement.
4. Déclare un module générique speech-dispatcher (`piper.conf`) qui appelle ce
   serveur (le JSON passe par `jq`, les apostrophes des piques survivent).
5. Fait de Piper le seul module actif (sinon Chromium continuerait de proposer
   les voix espeak) et redémarre speech-dispatcher.
6. Écarte le binaire `sd_espeak-ng` (renommé `.off`) : speech-dispatcher le
   charge sinon d'office comme module de secours — invisible dans
   `spd-say -O` mais joignable — et Chrome route la parole dessus.
   Attention : une mise à jour du paquet speech-dispatcher peut le restaurer ;
   relancer le script dans ce cas.

## Dépannage

- Pas de son au test `spd-say` : vérifier `journalctl -u piper-tts -e`, puis la
  sortie audio — si le kiosque passe par PulseAudio/PipeWire, remplacer
  `aplay -q -` par `paplay` dans `/etc/speech-dispatcher/modules/piper.conf`.
- Chromium ne liste pas la voix : le relancer complètement (les voix sont lues
  au démarrage), puis `speechSynthesis.getVoices()` dans la console.

## Restauration

```bash
sudo cp /etc/speech-dispatcher/speechd.conf.avant-piper /etc/speech-dispatcher/speechd.conf
sudo mv /usr/lib/speech-dispatcher-modules/sd_espeak-ng.off /usr/lib/speech-dispatcher-modules/sd_espeak-ng
sudo systemctl disable --now piper-tts
sudo pkill -f speech-dispatcher
```
