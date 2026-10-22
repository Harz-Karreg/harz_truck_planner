#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/Harz-Karreg/harz_truck_planner.git"
BRANCH="main"
SOURCE_DIR="/opt/harz_truck_planner"
INSTALL_DIR="/opt/harzkarreg"
TARGET_USER="${SUDO_USER:-harzkarreg}"
WITH_ELECTRON=false
WITH_AUTOSTART=true

usage() {
  cat <<'EOF'
Installation HARZ KARREG Companion sur Debian/Raspberry Pi OS ARM64.

Usage:
  sudo ./install-harzos.sh [options]

Options:
  --user NOM          Utilisateur de la session graphique (défaut: SUDO_USER ou harzkarreg)
  --branch BRANCHE    Branche Git à installer (défaut: main)
  --repo URL          Dépôt Git à utiliser
  --with-electron     Construit et installe également le paquet Electron ARM64
  --no-autostart      N'ouvre pas Companion automatiquement à la connexion graphique
  --help              Affiche cette aide
EOF
}

log() {
  printf '\n[HARZOS] %s\n' "$*"
}

fail() {
  printf '\n[HARZOS] ERREUR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      [[ $# -ge 2 ]] || fail "--user attend une valeur"
      TARGET_USER="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || fail "--branch attend une valeur"
      BRANCH="$2"
      shift 2
      ;;
    --repo)
      [[ $# -ge 2 ]] || fail "--repo attend une valeur"
      REPO_URL="$2"
      shift 2
      ;;
    --with-electron)
      WITH_ELECTRON=true
      shift
      ;;
    --no-autostart)
      WITH_AUTOSTART=false
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "option inconnue: $1"
      ;;
  esac
done

[[ ${EUID} -eq 0 ]] || fail "lancez ce script avec sudo"
command -v apt-get >/dev/null || fail "ce script nécessite Debian ou Raspberry Pi OS"
getent passwd "$TARGET_USER" >/dev/null || fail "l'utilisateur $TARGET_USER n'existe pas"

TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
TARGET_GROUP="$(id -gn "$TARGET_USER")"
ARCH="$(dpkg --print-architecture)"

if [[ "$ARCH" != "arm64" ]]; then
  fail "architecture $ARCH détectée; ARM64 est requis pour HarzOS Companion"
fi

log "Installation des dépendances système"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git docker.io docker-compose chromium

systemctl enable --now docker
usermod -aG docker "$TARGET_USER"

log "Préparation des répertoires persistants"
install -d -o "$TARGET_USER" -g "$TARGET_GROUP" "$INSTALL_DIR"
install -d -m 750 -o "$TARGET_USER" -g "$TARGET_GROUP" "$INSTALL_DIR/config"
install -d -o "$TARGET_USER" -g "$TARGET_GROUP" \
  "$INSTALL_DIR/app" \
  "$INSTALL_DIR/data/database" \
  "$INSTALL_DIR/data/backups" \
  "$INSTALL_DIR/cache" \
  "$INSTALL_DIR/releases" \
  "$INSTALL_DIR/scripts"

log "Récupération du dépôt $REPO_URL ($BRANCH)"
if [[ -d "$SOURCE_DIR/.git" ]]; then
  chown -R "$TARGET_USER:$TARGET_GROUP" "$SOURCE_DIR"
  sudo -u "$TARGET_USER" git -C "$SOURCE_DIR" fetch origin "$BRANCH"
  sudo -u "$TARGET_USER" git -C "$SOURCE_DIR" checkout "$BRANCH"
  sudo -u "$TARGET_USER" git -C "$SOURCE_DIR" merge --ff-only "origin/$BRANCH"
elif [[ -e "$SOURCE_DIR" ]]; then
  fail "$SOURCE_DIR existe mais n'est pas un dépôt Git; aucune donnée n'a été modifiée"
else
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$SOURCE_DIR"
  chown -R "$TARGET_USER:$TARGET_GROUP" "$SOURCE_DIR"
fi

ENV_FILE="$INSTALL_DIR/config/harzkarreg.env"
if [[ ! -f "$ENV_FILE" ]]; then
  install -m 600 -o "$TARGET_USER" -g "$TARGET_GROUP" \
    "$SOURCE_DIR/deployment/raspberry-pi/.env.example" "$ENV_FILE"
  log "Configuration créée dans $ENV_FILE"
else
  log "Configuration existante conservée: $ENV_FILE"
fi

log "Construction et démarrage du service web Companion"
docker compose \
  --env-file "$ENV_FILE" \
  -f "$SOURCE_DIR/deployment/raspberry-pi/compose.yaml" \
  up -d --build

log "Contrôle du service web"
healthy=false
for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:8080/healthz >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]] || fail "Companion n'a pas répondu sur http://127.0.0.1:8080/healthz"

LAUNCH_COMMAND="/usr/bin/chromium --kiosk --noerrdialogs --disable-session-crashed-bubble http://127.0.0.1:8080/companion/"

if [[ "$WITH_ELECTRON" == true ]]; then
  log "Vérification de l'espace disponible pour Electron"
  AVAILABLE_KB="$(df -Pk "$SOURCE_DIR" | awk 'NR == 2 { print $4 }')"
  REQUIRED_KB=$((6 * 1024 * 1024))
  if (( AVAILABLE_KB < REQUIRED_KB )); then
    fail "au moins 6 Gio libres sont nécessaires pour construire Electron"
  fi

  log "Installation des outils de construction Electron"
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm ruby ruby-dev build-essential
  if ! command -v fpm >/dev/null; then
    gem install fpm --no-document
  fi

  install -d -o "$TARGET_USER" -g "$TARGET_GROUP" "$TARGET_HOME/.npm"
  sudo -u "$TARGET_USER" env HOME="$TARGET_HOME" npm --prefix "$SOURCE_DIR" ci
  sudo -u "$TARGET_USER" env HOME="$TARGET_HOME" npm --prefix "$SOURCE_DIR" test
  sudo -u "$TARGET_USER" env HOME="$TARGET_HOME" npm --prefix "$SOURCE_DIR" run check
  sudo -u "$TARGET_USER" env HOME="$TARGET_HOME" npm --prefix "$SOURCE_DIR" run dist:pi

  DEB_PACKAGE="$(find "$SOURCE_DIR/dist" -maxdepth 1 -type f -name '*linux-arm64.deb' -print -quit)"
  [[ -n "$DEB_PACKAGE" ]] || fail "aucun paquet Debian ARM64 n'a été produit"
  apt-get install -y "$DEB_PACKAGE"

  ELECTRON_BIN="$(command -v harz-karreg || true)"
  [[ -n "$ELECTRON_BIN" ]] || fail "le paquet Electron est installé mais l'exécutable harz-karreg est introuvable"
  LAUNCH_COMMAND="$ELECTRON_BIN --companion"
fi

log "Création du lanceur graphique"
APPLICATIONS_DIR="$TARGET_HOME/.local/share/applications"
AUTOSTART_DIR="$TARGET_HOME/.config/autostart"
DESKTOP_DIR="$TARGET_HOME/Desktop"
if [[ -d "$TARGET_HOME/Bureau" ]]; then
  DESKTOP_DIR="$TARGET_HOME/Bureau"
fi

install -d -o "$TARGET_USER" -g "$TARGET_GROUP" "$APPLICATIONS_DIR" "$DESKTOP_DIR"
if [[ "$WITH_AUTOSTART" == true ]]; then
  install -d -o "$TARGET_USER" -g "$TARGET_GROUP" "$AUTOSTART_DIR"
fi

LAUNCHER="$APPLICATIONS_DIR/harzkarreg-companion.desktop"
cat > "$LAUNCHER" <<EOF
[Desktop Entry]
Type=Application
Name=HARZ KARREG Companion
Comment=Planning transport HARZ KARREG
Exec=$LAUNCH_COMMAND
Icon=applications-internet
Terminal=false
Categories=Office;
StartupNotify=true
EOF
chmod 755 "$LAUNCHER"
chown "$TARGET_USER:$TARGET_GROUP" "$LAUNCHER"
install -m 755 -o "$TARGET_USER" -g "$TARGET_GROUP" "$LAUNCHER" "$DESKTOP_DIR/harzkarreg-companion.desktop"

if [[ "$WITH_AUTOSTART" == true ]]; then
  install -m 755 -o "$TARGET_USER" -g "$TARGET_GROUP" "$LAUNCHER" "$AUTOSTART_DIR/harzkarreg-companion.desktop"
fi

IP_ADDRESS="$(hostname -I | awk '{ print $1 }')"
log "Installation terminée"
printf 'Companion local : http://127.0.0.1:8080/\n'
printf 'Companion réseau : http://%s:8080/\n' "${IP_ADDRESS:-ADRESSE_DU_RASPBERRY}"
printf 'Lanceur : %s\n' "$DESKTOP_DIR/harzkarreg-companion.desktop"
printf 'Reconnectez la session de %s pour appliquer son appartenance au groupe docker.\n' "$TARGET_USER"
