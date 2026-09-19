#!/usr/bin/env bash
# Verifie le front web (image tabibi-web) lance face a la pile d'integration reelle, DANS UN VRAI NAVIGATEUR :
# ce script n'est qu'un lanceur mince pour les tests Playwright de integration/web (installation du navigateur et
# des dependances si besoin, puis `npx playwright test`). Les verifications elles-memes sont dans
# integration/web/tests/pile-reelle.spec.ts : configuration servie, accueil et fiche rendus cote serveur avec les
# praticiens de l'API REELLE, recherche par specialite, verification d'une ordonnance, redirection vers Keycloak,
# robots.txt et plan du site, CSP, bascule en arabe.
#
# Pourquoi un lanceur plutot que des etapes directes dans le workflow : la meme commande sert en local et en CI,
# le developpeur n'a qu'une ligne a retenir, et le workflow reste lisible. Le workflow ajoute par-dessus le cache
# npm et l'installation du navigateur (etapes GitHub Actions), ce qui rend ces deux etapes-ci instantanees.
#
#   integration/verifier-web.sh
# Variables : URL_WEB (http://localhost:4200), URL_API (http://localhost:8080), ISSUER_KEYCLOAK
# (http://localhost:8081/realms/tabibi), CODE_ORDONNANCE (code d'une vraie ordonnance : sans lui, le cas valide de
# la page /verifier est saute), FICHIER_RESULTAT (resultat du scenario API ; defaut :
# integration/resultat-scenario.json), CHROME_BIN (Chrome deja installe, au lieu du Chromium de Playwright).
# Les anciens noms TABIBI_WEB_URL, TABIBI_API_URL et TABIBI_KEYCLOAK_ISSUER restent acceptes.
#
# CODE_ORDONNANCE n'a pas a etre fourni a la main : integration/scenario-api.mjs (joue par integration/lancer.sh)
# ecrit le code de l'ordonnance qu'il vient d'emettre dans FICHIER_RESULTAT, et ce lanceur l'y lit. Une valeur deja
# presente dans l'environnement l'emporte sur le fichier.
# Rapport HTML : integration/web/playwright-report (`npx playwright show-report`) ; traces, captures et videos des
# echecs : integration/web/test-results.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ICI/web"

command -v node >/dev/null || { echo "node (20 ou plus) est requis." >&2; exit 2; }
command -v npm >/dev/null || { echo "npm est requis." >&2; exit 2; }

# Le code d'une vraie ordonnance, ecrit par le scenario API : sans lui, le cas « code de verification valide » de
# integration/web/tests/pile-reelle.spec.ts est saute. Le fichier est absent quand on lance ces tests seuls.
FICHIER_RESULTAT="${FICHIER_RESULTAT:-$ICI/resultat-scenario.json}"
if [ -z "${CODE_ORDONNANCE:-}" ] && [ -f "$FICHIER_RESULTAT" ]; then
  CODE_ORDONNANCE="$(node -e '
    const fs = require("node:fs");
    try {
      const resultat = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.stdout.write(String(resultat.codeOrdonnance || ""));
    } catch {
      // fichier tronque ou non JSON : on repart sans code, le cas valide sera saute (message ci-dessous)
    }
  ' "$FICHIER_RESULTAT")" || CODE_ORDONNANCE=""
  if [ -n "$CODE_ORDONNANCE" ]; then
    export CODE_ORDONNANCE
    echo "== Code d'ordonnance lu dans $FICHIER_RESULTAT : $CODE_ORDONNANCE"
  else
    echo "== $FICHIER_RESULTAT sans codeOrdonnance exploitable : le cas valide de /verifier sera saute" >&2
  fi
elif [ -n "${CODE_ORDONNANCE:-}" ]; then
  echo "== Code d'ordonnance fourni par l'environnement : $CODE_ORDONNANCE"
else
  echo "== Pas de $FICHIER_RESULTAT et pas de CODE_ORDONNANCE : le cas valide de /verifier sera saute" >&2
fi

echo "== Dependances de integration/web (@playwright/test)"
if [ -d node_modules ]; then
  echo "deja installees"
else
  npm ci --no-audit --no-fund
fi

# Le navigateur : celui de Playwright, sauf si CHROME_BIN designe un Chrome deja present (poste, conteneur).
# --with-deps installe aussi les bibliotheques systeme (apt) : reserve a la CI et a root, ou il n'y a personne pour
# repondre a sudo ; ailleurs, le telechargement du navigateur suffit.
if [ -n "${CHROME_BIN:-}" ]; then
  echo "== Navigateur : CHROME_BIN=$CHROME_BIN"
elif [ "${CI:-}" = "true" ] || [ "$(id -u)" = "0" ]; then
  echo "== Navigateur : Chromium de Playwright, avec ses dependances systeme"
  npx playwright install --with-deps chromium
else
  echo "== Navigateur : Chromium de Playwright (dependances systeme : npx playwright install --with-deps chromium)"
  npx playwright install chromium
fi

echo "== Tests Playwright contre ${URL_WEB:-${TABIBI_WEB_URL:-http://localhost:4200}} (API ${URL_API:-${TABIBI_API_URL:-http://localhost:8080}})"
exec npx playwright test
