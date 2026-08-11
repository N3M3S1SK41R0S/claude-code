#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
DESK="$APPS/donjon-du-savoir-lien.desktop"
cat > "$DESK" <<EOF
[Desktop Entry]
Type=Application
Name=Le Donjon du Savoir
Comment=Jeu de plateau de culture générale (dernière version en ligne)
Exec=xdg-open "https://claude.ai/code/artifact/e2127687-04c1-40c0-be43-f0e5f8b27205"
Icon=$DIR/donjon-512.png
Terminal=false
Categories=Game;Education;
EOF
chmod +x "$DESK"
for B in "$HOME/Bureau" "$HOME/Desktop"; do [ -d "$B" ] && cp "$DESK" "$B/" 2>/dev/null || true; done
echo 'Icone installee. Cherchez « Le Donjon du Savoir » dans vos applications ou sur le Bureau.'
