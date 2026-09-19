#!/usr/bin/env bash
# Verifie, avec curl seulement, le front web (image tabibi-web) lance face a la pile d'integration reelle :
#   1. /assets/config.json (ecrit au demarrage du conteneur) contient l'URL de l'API et l'emetteur Keycloak ;
#   2. la page d'accueil / est rendue cote serveur : elle contient « Trouver un praticien » et le nom de chaque
#      praticien de l'annuaire de l'API reelle (le serveur de rendu a donc appele GET /api/medecins) ;
#   3. la fiche /medecins/<id> est rendue avec le nom et la specialite du praticien (GET /api/medecins/<id>) ;
#   4. la politique de securite (CSP) posee par le serveur autorise l'origine de l'API.
# Chaque verification affiche OK ou ECHEC ; le script sort en erreur au premier echec.
#
#   integration/verifier-web.sh
# Variables : TABIBI_WEB_URL (http://localhost:4200), TABIBI_API_URL (http://localhost:8080), TABIBI_KEYCLOAK_ISSUER
# (http://localhost:8081/realms/tabibi), TABIBI_MEDECIN_ID (00000000-0000-0000-0000-000000000001, medecin.demo),
# TABIBI_ATTENTE_S (attente maximale du demarrage du web, 120 s).
set -euo pipefail

WEB="${TABIBI_WEB_URL:-http://localhost:4200}"
API="${TABIBI_API_URL:-http://localhost:8080}"
ISSUER="${TABIBI_KEYCLOAK_ISSUER:-http://localhost:8081/realms/tabibi}"
MEDECIN_ID="${TABIBI_MEDECIN_ID:-00000000-0000-0000-0000-000000000001}"
ATTENTE_S="${TABIBI_ATTENTE_S:-120}"
# Le rendu serveur peut, a la premiere requete, depasser son delai et renvoyer la page sans rendu : on reessaie.
ESSAIS_RENDU=10

numero=0
ok() { numero=$((numero + 1)); printf 'OK     %02d. %s\n' "$numero" "$*"; }
echec() { numero=$((numero + 1)); printf 'ECHEC  %02d. %s\n' "$numero" "$*"; exit 1; }

# Extrait les valeurs d'un champ texte d'un JSON de l'API (les vues sont plates, sans guillemet echappe dans les noms).
champ() { grep -o "\"$1\":\"[^\"]*\"" | cut -d'"' -f4 || true; }

echo "Verification du front web $WEB face a l'API $API"

# Attente du serveur node : un fichier statique, sans rendu.
debut=$(date +%s)
until curl -fs --max-time 5 -o /dev/null "$WEB/assets/config.json"; do
  if [ $(( $(date +%s) - debut )) -ge "$ATTENTE_S" ]; then
    echec "le front web ne repond pas apres $ATTENTE_S s : $WEB/assets/config.json"
  fi
  sleep 3
done
ok "Le front web repond ($(( $(date +%s) - debut )) s) : $WEB/assets/config.json"

# 1. Configuration ecrite a l'execution.
config=$(curl -fs "$WEB/assets/config.json")
grep -Eq "\"apiUrl\": *\"$API\"" <<<"$config" || echec "assets/config.json ne contient pas apiUrl $API : $config"
grep -Eq "\"keycloakIssuer\": *\"$ISSUER\"" <<<"$config" || echec "assets/config.json ne contient pas keycloakIssuer $ISSUER : $config"
ok "assets/config.json : apiUrl $API, keycloakIssuer $ISSUER"

# 2. Accueil rendu cote serveur avec les praticiens de l'API reelle.
mapfile -t praticiens < <(curl -fs "$API/api/medecins" | champ nomComplet)
[ "${#praticiens[@]}" -gt 0 ] || echec "l'annuaire de l'API est vide : rien a comparer (le scenario API a-t-il tourne ?)"

accueil=""
for essai in $(seq 1 "$ESSAIS_RENDU"); do
  accueil=$(curl -fs --max-time 30 "$WEB/" || true)
  if grep -Fq "Trouver un praticien" <<<"$accueil" && grep -Fq "${praticiens[0]}" <<<"$accueil"; then
    break
  fi
  if [ "$essai" -lt "$ESSAIS_RENDU" ]; then sleep 3; fi
done
grep -Fq "Trouver un praticien" <<<"$accueil" || echec "la page / rendue cote serveur ne contient pas « Trouver un praticien » (page sans rendu ?)"
for nom in "${praticiens[@]}"; do
  grep -Fq "$nom" <<<"$accueil" || echec "la page / ne contient pas le praticien « $nom » renvoye par l'API"
  grep -Fq "/medecins/" <<<"$accueil" || echec "la page / ne contient aucun lien vers une fiche /medecins/..."
done
ok "Page / rendue cote serveur : « Trouver un praticien » et ${#praticiens[@]} praticien(s) de l'API (${praticiens[*]})"

# 3. Fiche du praticien rendue cote serveur.
fiche_api=$(curl -fs "$API/api/medecins/$MEDECIN_ID") || echec "GET $API/api/medecins/$MEDECIN_ID echoue : la fiche n'existe pas dans l'API"
nom=$(champ nomComplet <<<"$fiche_api"); specialite=$(champ specialiteFr <<<"$fiche_api")
if [ -z "$nom" ] || [ -z "$specialite" ]; then echec "fiche API illisible : $fiche_api"; fi
fiche=""
for essai in $(seq 1 "$ESSAIS_RENDU"); do
  fiche=$(curl -fs --max-time 30 "$WEB/medecins/$MEDECIN_ID" || true)
  if grep -Fq "$nom" <<<"$fiche"; then
    break
  fi
  if [ "$essai" -lt "$ESSAIS_RENDU" ]; then sleep 3; fi
done
grep -Fq "$nom" <<<"$fiche" || echec "la fiche /medecins/$MEDECIN_ID ne contient pas « $nom »"
grep -Fq "$specialite" <<<"$fiche" || echec "la fiche /medecins/$MEDECIN_ID ne contient pas « $specialite »"
ok "Fiche /medecins/$MEDECIN_ID rendue cote serveur : $nom, $specialite"

# 4. En-tetes de securite du serveur node : la CSP autorise l'API (connect-src).
csp=$(curl -fsI "$WEB/" | tr -d '\r' | grep -i '^content-security-policy:' || true)
[ -n "$csp" ] || echec "aucun en-tete Content-Security-Policy sur $WEB/"
grep -Fq "$API" <<<"$csp" || echec "la CSP n'autorise pas l'origine de l'API $API : $csp"
ok "Content-Security-Policy presente et connect-src autorise $API"

echo
echo "Front web verifie : $numero verifications OK ($WEB face a $API)."
