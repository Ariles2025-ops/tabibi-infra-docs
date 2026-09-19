#!/usr/bin/env bash
# Lance la pile d'integration reelle (PostgreSQL + Keycloak + API construite depuis tabibi-backend), attend qu'elle
# soit prete, execute le scenario API (scenario-api.mjs), affiche les journaux des conteneurs en cas d'echec, puis
# arrete tout et supprime les volumes.
#
#   integration/lancer.sh                 # depuis n'importe quel dossier ; Docker, Compose v2 et Node 20+ requis
#   GARDER_LA_PILE=1 integration/lancer.sh   # laisse la pile en route apres le scenario (CI : etape web ensuite,
#                                            # ou pour l'explorer) ; l'arreter avec :
#   docker compose -f integration/docker-compose.integration.yml down -v
#
# Le scenario ecrit aussi son resultat (identifiant du medecin publie, du rendez-vous, et surtout le code de
# verification de l'ordonnance emise) dans un petit fichier JSON : integration/resultat-scenario.json par defaut,
# chemin surchargeable par FICHIER_RESULTAT. integration/verifier-web.sh le lit et en tire CODE_ORDONNANCE, ce qui
# permet aux tests navigateur de verifier le cas « code de verification valide » avec une vraie ordonnance. Le
# fichier decrit des donnees vivantes : il est efface en meme temps que la pile (sauf avec GARDER_LA_PILE=1, ou son
# chemin est affiche a la fin).
#
# Variables : TABIBI_BACKEND_DIR (sources de tabibi-backend ; defaut : ../../tabibi-backend a cote de ce depot),
#             TABIBI_ATTENTE_S (attente maximale du demarrage, 240 s),
#             FICHIER_RESULTAT (resultat du scenario ; defaut : integration/resultat-scenario.json).
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -f "$ICI/docker-compose.integration.yml")
export TABIBI_BACKEND_DIR="${TABIBI_BACKEND_DIR:-$ICI/../../tabibi-backend}"
ATTENTE_S="${TABIBI_ATTENTE_S:-240}"
API="${TABIBI_API_URL:-http://localhost:8080}"
ISSUER="${TABIBI_KEYCLOAK_ISSUER:-http://localhost:8081/realms/tabibi}"
# Expose le fichier de resultat : le scenario l'ecrit, verifier-web.sh (meme defaut) l'y retrouve sans rien recevoir.
export FICHIER_RESULTAT="${FICHIER_RESULTAT:-$ICI/resultat-scenario.json}"

journal() { printf '\n== %s\n' "$*"; }

# Prerequis : sources du backend (Dockerfile et realm), docker compose, node.
if [ ! -f "$TABIBI_BACKEND_DIR/Dockerfile" ] || [ ! -f "$TABIBI_BACKEND_DIR/infra/keycloak/tabibi-realm.json" ]; then
  echo "tabibi-backend introuvable dans $TABIBI_BACKEND_DIR (Dockerfile ou infra/keycloak/tabibi-realm.json absent)." >&2
  echo "Cloner tabibi-backend a cote de ce depot, ou indiquer TABIBI_BACKEND_DIR." >&2
  exit 2
fi
command -v docker >/dev/null || { echo "docker est requis." >&2; exit 2; }
command -v node >/dev/null || { echo "node (20 ou plus) est requis." >&2; exit 2; }

# Attend qu'une URL reponde 200 (au plus ATTENTE_S secondes).
attendre() {
  local url="$1" nom="$2" debut fin
  debut=$(date +%s); fin=$((debut + ATTENTE_S))
  while :; do
    if curl -fs --max-time 5 -o /dev/null "$url"; then
      echo "$nom pret ($(( $(date +%s) - debut )) s) : $url"
      return 0
    fi
    if [ "$(date +%s)" -ge "$fin" ]; then
      echo "$nom ne repond pas apres $ATTENTE_S s : $url" >&2
      return 1
    fi
    sleep 3
  done
}

CODE=0
terminer() {
  if [ "$CODE" -ne 0 ]; then
    journal "Echec (code $CODE) : etat et journaux des conteneurs"
    "${COMPOSE[@]}" ps || true
    "${COMPOSE[@]}" logs --no-color --timestamps || true
  fi
  if [ "${GARDER_LA_PILE:-0}" = "1" ]; then
    journal "Pile conservee (GARDER_LA_PILE=1) : docker compose -f $ICI/docker-compose.integration.yml down -v pour l'arreter"
    if [ -f "$FICHIER_RESULTAT" ]; then
      echo "Resultat du scenario : $FICHIER_RESULTAT"
      echo "  (code de l'ordonnance emise ; integration/verifier-web.sh le lit et exporte CODE_ORDONNANCE)"
    fi
  else
    journal "Arret de la pile et suppression des volumes"
    "${COMPOSE[@]}" down -v --remove-orphans || true
    # Les donnees decrites par le resultat viennent de partir avec les volumes : ne pas laisser un fichier trompeur.
    rm -f "$FICHIER_RESULTAT"
  fi
  exit "$CODE"
}
trap terminer EXIT

journal "Construction de l'image de l'API et demarrage de la pile (backend : $TABIBI_BACKEND_DIR)"
"${COMPOSE[@]}" up -d --build || { CODE=$?; exit; }

journal "Attente du demarrage (au plus $ATTENTE_S s)"
attendre "$ISSUER" "Keycloak (realm tabibi)" || { CODE=1; exit; }
attendre "$API/actuator/health" "API" || { CODE=1; exit; }
"${COMPOSE[@]}" ps

journal "Scenario API"
# Un resultat d'une execution precedente ne doit jamais etre pris pour celui-ci.
rm -f "$FICHIER_RESULTAT"
TABIBI_API_URL="$API" TABIBI_KEYCLOAK_ISSUER="$ISSUER" TABIBI_ATTENTE_S="$ATTENTE_S" \
  node "$ICI/scenario-api.mjs" || CODE=$?
