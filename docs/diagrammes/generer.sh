#!/usr/bin/env bash
# Regenere les images (PNG et SVG) de docs/images a partir des sources Mermaid de docs/diagrammes/src.
# Prerequis : Mermaid CLI (npm install -g @mermaid-js/mermaid-cli) et un Chromium accessible a Puppeteer.
# Usage : docs/diagrammes/generer.sh [nom-sans-extension ...]   (sans argument : tous les diagrammes)
# Variable facultative PUPPETEER_CONFIG : fichier de configuration Puppeteer (chemin de Chromium, --no-sandbox).
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
SRC="$ICI/src"
DEST="$ICI/../images"
mkdir -p "$DEST"
OPTIONS=(-b white -s 2)
if [[ -n "${PUPPETEER_CONFIG:-}" ]]; then OPTIONS+=(-p "$PUPPETEER_CONFIG"); fi
if [[ $# -gt 0 ]]; then noms=("$@"); else noms=(); for f in "$SRC"/*.mmd; do noms+=("$(basename "$f" .mmd)"); done; fi
for nom in "${noms[@]}"; do
  echo "== $nom"
  mmdc "${OPTIONS[@]}" -i "$SRC/$nom.mmd" -o "$DEST/$nom.png"
  mmdc "${OPTIONS[@]}" -i "$SRC/$nom.mmd" -o "$DEST/$nom.svg"
done
