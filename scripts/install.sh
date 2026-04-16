#!/bin/bash
# Script d'installation d'ADHDHelper sur un nouveau serveur.
# À exécuter dans le dossier extrait du bundle.
# Prérequis : Docker + Docker Compose installés, Tailscale connecté.

set -e

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================"
echo "   Installation d'ADHDHelper"
echo "======================================"
echo ""

# --- Vérifications ---
if ! command -v docker &>/dev/null; then
  echo "❌ Docker n'est pas installé. Installe Docker avant de continuer."
  exit 1
fi
if ! docker compose version &>/dev/null; then
  echo "❌ Docker Compose (v2) n'est pas disponible."
  exit 1
fi

# --- Nom de domaine Tailscale ---
echo "Quel est le nom de domaine Tailscale de ce serveur ?"
echo "  (ex: mon-serveur.mammoth-mine.ts.net)"
read -p "Hostname Tailscale : " TS_HOST

if [[ -z "$TS_HOST" ]]; then
  echo "❌ Hostname requis."
  exit 1
fi

# --- Certificat Tailscale ---
echo ""
echo "==> Génération du certificat Tailscale pour $TS_HOST..."
if command -v tailscale &>/dev/null; then
  sudo tailscale cert --cert-file "$INSTALL_DIR/certs/adhdhelper.crt" \
                      --key-file  "$INSTALL_DIR/certs/adhdhelper.key" \
                      "$TS_HOST"
  sudo chmod 644 "$INSTALL_DIR/certs/adhdhelper.key"
  echo "✅ Certificat généré."
else
  echo "⚠️  Tailscale CLI introuvable. Génère le certificat manuellement :"
  echo "     tailscale cert --cert-file $INSTALL_DIR/certs/adhdhelper.crt \\"
  echo "                    --key-file  $INSTALL_DIR/certs/adhdhelper.key \\"
  echo "                    $TS_HOST"
  echo "   puis : sudo chmod 644 $INSTALL_DIR/certs/adhdhelper.key"
  read -p "Appuie sur Entrée une fois le certificat en place..."
fi

# --- Caddyfile ---
echo ""
echo "==> Configuration de Caddy..."
sed "s|jbijjer-desktop.mammoth-mine.ts.net|$TS_HOST|g" \
  "$INSTALL_DIR/Caddyfile.example" > "$INSTALL_DIR/Caddyfile"
echo "✅ Caddyfile créé pour $TS_HOST"

# --- Chargement de l'image Docker ---
echo ""
echo "==> Chargement de l'image Docker (peut prendre une minute)..."
docker load < "$INSTALL_DIR/adhdhelper-image.tar.gz"
echo "✅ Image chargée."

# --- Lancement ---
echo ""
echo "==> Démarrage des services..."
cd "$INSTALL_DIR"
docker compose --env-file .env up -d

echo ""
echo "======================================"
echo "✅ ADHDHelper est lancé !"
echo ""
echo "   Accès : https://$TS_HOST"
echo ""
echo "⚠️  Pense à configurer les URLs dans Réglages :"
echo "   - URL LiteLLM (ex: http://IP-DU-SERVEUR-LITELLM:8000)"
echo "   - URL Whisper : http://faster-whisper:8000"
echo "======================================"
