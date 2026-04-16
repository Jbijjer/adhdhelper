#!/bin/bash
# Génère un bundle adhdhelper-bundle.tar.gz prêt à déployer sur un autre serveur.
# Usage : ./scripts/bundle.sh
# Résultat : adhdhelper-bundle.tar.gz dans le dossier courant

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_NAME="adhdhelper-bundle"
BUNDLE_DIR="/tmp/$BUNDLE_NAME"
IMAGE_NAME="adhdhelper-adhdhelper"  # nom généré par docker compose build

echo "==> Construction de l'image Docker..."
cd "$PROJECT_DIR"
docker compose build

echo "==> Préparation du bundle dans $BUNDLE_DIR..."
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR/certs"
mkdir -p "$BUNDLE_DIR/data/audio"

echo "==> Export de l'image Docker (peut prendre une minute)..."
docker save "$IMAGE_NAME" | gzip > "$BUNDLE_DIR/adhdhelper-image.tar.gz"

echo "==> Copie des fichiers de configuration..."
cp "$PROJECT_DIR/docker-compose.deploy.yml" "$BUNDLE_DIR/docker-compose.yml"
cp "$PROJECT_DIR/Caddyfile" "$BUNDLE_DIR/Caddyfile.example"

# .env avec les clés VAPID existantes (les garder identiques pour ne pas perdre les abonnements push)
cp "$PROJECT_DIR/.env" "$BUNDLE_DIR/.env"
# Forcer NODE_ENV=production dans le bundle
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$BUNDLE_DIR/.env"
sed -i 's|^DATABASE_PATH=.*|DATABASE_PATH=/app/data/adhdhelper.db|' "$BUNDLE_DIR/.env"
sed -i 's|^AUDIO_PATH=.*|AUDIO_PATH=/app/data/audio|' "$BUNDLE_DIR/.env"

# Copier les données existantes si l'utilisateur le souhaite
echo ""
read -p "Inclure les données existantes (base de données + audio) dans le bundle ? [o/N] " INCLUDE_DATA
if [[ "$INCLUDE_DATA" =~ ^[Oo]$ ]]; then
  echo "==> Copie des données..."
  cp -r "$PROJECT_DIR/data/." "$BUNDLE_DIR/data/"
fi

echo "==> Copie du script d'installation..."
cp "$SCRIPT_DIR/install.sh" "$BUNDLE_DIR/install.sh"
chmod +x "$BUNDLE_DIR/install.sh"

echo "==> Création de l'archive..."
cd /tmp
tar -czf "$PROJECT_DIR/$BUNDLE_NAME.tar.gz" "$BUNDLE_NAME"
rm -rf "$BUNDLE_DIR"

echo ""
echo "✅ Bundle créé : $PROJECT_DIR/$BUNDLE_NAME.tar.gz"
echo ""
echo "Pour déployer sur le serveur cible :"
echo "  1. Copier le bundle :  scp $BUNDLE_NAME.tar.gz user@serveur:~/"
echo "  2. Sur le serveur   :  tar -xzf $BUNDLE_NAME.tar.gz && cd $BUNDLE_NAME && ./install.sh"
