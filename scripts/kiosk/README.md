# Kiosque — voix Piper pour l'annonceur

Le kiosque (Ubuntu Server + Chromium en mode kiosk) utilise la synthèse vocale
du système via speech-dispatcher. Par défaut c'est espeak-ng, très robotique.
`install-piper.sh` la remplace par [Piper](https://github.com/OHF-Voice/piper1-gpl),
une voix neuronale locale de bien meilleure qualité.

## Installation

```bash
scp -r scripts/kiosk/ kiosque:/tmp/
ssh kiosque 'sudo bash /tmp/kiosk/install-piper.sh'
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
6. Écarte le binaire `sd_espeak-ng` par une **diversion dpkg** : speech-dispatcher
   le charge sinon d'office comme module de secours — invisible dans
   `spd-say -O` mais joignable — et Chrome route la parole dessus. La diversion
   survit aux mises à jour du paquet, contrairement à un simple renommage.

## Dépannage

Premier réflexe, avec **l'utilisateur du kiosque** (pas en sudo : la config de
speech-dispatcher dépend de l'utilisateur) :

```bash
bash diagnostic-voix.sh
```

Il déroule la chaîne complète et pointe le maillon fautif. Les causes déjà
rencontrées, dans l'ordre où le script les teste :

- **`piper-tts` pas encore prêt quand l'annonce part** — le serveur charge son
  modèle pendant que le kiosque démarre. Le module `curl` réessaie désormais
  (`--retry-connrefused`), l'annonce est retardée au lieu d'être perdue.
- **Chromium démarré avant speech-dispatcher** : sa liste de voix est figée à
  la connexion, il ne verra pas Piper de toute la session. Le relancer.
- **Une config utilisateur `~/.config/speech-dispatcher/speechd.conf`** masque
  complètement `/etc/speech-dispatcher/speechd.conf`. Piège vicieux : le test
  d'installation tourne en root et lit celle de root, donc il passe.
- **`sd_espeak-ng` restauré par une mise à jour** (installations d'avant la
  diversion dpkg) : relancer `install-piper.sh`.
- Pas de son du tout au test `spd-say` : `journalctl -u piper-tts -e`, puis la
  sortie audio — si le kiosque passe par PulseAudio/PipeWire, remplacer
  `aplay -q -` par `paplay` dans `/etc/speech-dispatcher/modules/piper.conf`.

Côté app : le titre du bouton 🔊 nomme la voix retenue par l'annonceur — le
plus court moyen de vérifier depuis le kiosque que Piper a bien été trouvé.

## Restauration

```bash
sudo cp /etc/speech-dispatcher/speechd.conf.avant-piper /etc/speech-dispatcher/speechd.conf
sudo dpkg-divert --rename --remove /usr/lib/speech-dispatcher-modules/sd_espeak-ng
sudo systemctl disable --now piper-tts
sudo pkill -f speech-dispatcher
```
