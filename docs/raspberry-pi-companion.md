# Déployer COMPANION sur Raspberry Pi 5

## Prérequis

- Raspberry Pi 5 avec Raspberry Pi OS 64 bits et environnement graphique ;
- écran HDMI, cible recommandée 1920 × 1080 ;
- Node.js 20 ou version LTS plus récente uniquement pour construire depuis les sources ;
- test final réalisé sur un appareil ARM64 réel.

## Lancement depuis les sources

```bash
npm install
npm start -- --companion
```

L'équivalent explicite est `npm run start:companion`. Sous Linux, le lancement direct Companion active le mode kiosque. Le démarrage normal avec `npm start` conserve le sélecteur des modes. Sur Windows, `--companion` ouvre directement Companion sans imposer le kiosque ; `--kiosk` permet de le tester volontairement.

## Construire le paquet Debian ARM64

```bash
npm ci
npm test
npm run check
npm run dist:pi
```

Le paquet est produit dans `dist/`. La génération `.deb` nécessite un environnement Linux disposant des outils de packaging attendus par Electron Builder, notamment `fpm`. Sur Windows, Electron Builder peut produire `dist/linux-arm64-unpacked`, mais la création finale du `.deb` n'est pas garantie. La construction de référence doit donc être exécutée sous Linux, puis validée sur Raspberry Pi OS 64 bits.

## Installation

```bash
sudo apt install ./dist/HARZ-KARREG-0.3.5-linux-arm64.deb
```

Le chemin exact de l'exécutable installé doit être vérifié avec `command -v harz-karreg`. Si le gestionnaire de bureau ou la version du paquet utilise un autre chemin, adapter la ligne `Exec` du fichier d'autostart.

## Démarrage automatique

Créer le répertoire utilisateur puis copier le modèle fourni :

```bash
mkdir -p ~/.config/autostart
cp deployment/raspberry-pi/harz-karreg-companion.desktop ~/.config/autostart/
```

Vérifier ensuite la ligne `Exec` dans la copie installée. Le démarrage automatique se produit à l'ouverture de la session graphique, sans privilèges root.

## Accès depuis le réseau local avec Docker

Le service web statique permet d'ouvrir COMPANION depuis un autre ordinateur. Il ne synchronise pas encore les données métier : chaque navigateur conserve son propre `localStorage` jusqu'à la mise en place de l'API Rust.

Préparer les répertoires :

```bash
sudo mkdir -p /opt/harzkarreg/{app,config,data/database,data/backups,cache,releases,scripts}
sudo chown -R harzkarreg:harzkarreg /opt/harzkarreg
sudo chmod 750 /opt/harzkarreg/config
```

Depuis le dépôt cloné :

```bash
cd /opt/harz_truck_planner
cp deployment/raspberry-pi/.env.example /opt/harzkarreg/config/harzkarreg.env
docker compose --env-file /opt/harzkarreg/config/harzkarreg.env \
  -f deployment/raspberry-pi/compose.yaml up -d --build
docker compose --env-file /opt/harzkarreg/config/harzkarreg.env \
  -f deployment/raspberry-pi/compose.yaml ps
curl --fail http://127.0.0.1:8080/healthz
```

Depuis un autre ordinateur du même réseau, ouvrir `http://HarzOS.local:8080/`. Si la résolution `.local` n'est pas disponible, obtenir l'adresse du Raspberry avec `hostname -I` et ouvrir `http://ADRESSE_IP:8080/`.

Le conteneur est non privilégié, son système de fichiers est en lecture seule et il redémarre avec Docker grâce à `restart: unless-stopped`. Activer Docker au démarrage si nécessaire :

```bash
sudo systemctl enable --now docker
```

Sur un réseau non maîtrisé, ne pas exposer le port 8080 vers Internet. Un pare-feu peut limiter ce port au sous-réseau local.

## Maintenance et sortie du kiosque

- `Alt+F4` ferme l'application lorsqu'un clavier de maintenance est branché.
- Une connexion SSH administrateur permet de diagnostiquer ou arrêter le processus.
- Le mode kiosque ne remplace pas les contrôles d'accès qui devront être assurés par le futur backend.

## Limites de la phase A

COMPANION utilise encore le `localStorage` de son propre profil Electron. Il ne reçoit donc pas encore les publications d'un PC ADMIN distant. Le packaging Linux n'active pas l'auto-update GitHub Windows ; la mise à jour Linux devra suivre une stratégie séparée.

## Vérifications matérielles obligatoires

- installation effective du `.deb` ARM64 ;
- démarrage du binaire et chargement de Companion ;
- plein écran après ouverture de session ;
- rendu 1920 × 1080, mise à l'échelle et lisibilité sur le téléviseur ;
- sortie de maintenance et redémarrage après coupure électrique ;
- stabilité sur plusieurs heures et consommation mémoire ;
- persistance des préférences et des données legacy dans le profil Electron.
