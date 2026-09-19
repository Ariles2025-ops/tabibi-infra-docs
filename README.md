# Tabibi : infrastructure et documentation

[![integration](https://github.com/<org>/tabibi-infra-docs/actions/workflows/integration.yml/badge.svg)](https://github.com/<org>/tabibi-infra-docs/actions/workflows/integration.yml)

> **Pourquoi ce document.** C'est la porte d'entrée du projet Tabibi v2 : ce qu'est la plateforme, où sont les
> dépôts, quels documents lire, comment tout lancer en dix minutes, où en est chaque dépôt et ce qu'il reste à faire.
> Il s'adresse d'abord à un développeur qui rejoint l'équipe.

**Tabibi** est une plateforme de prise de rendez-vous médicaux en Algérie, reconstruite de façon professionnelle :
API Spring Boot (architecture hexagonale), front web Angular, application mobile Flutter pour les patients,
identité Keycloak, base PostgreSQL, tout conteneurisé et déployable sur un seul serveur. Cinq rôles : patient,
médecin, secrétaire, pharmacie, administrateur.

![Vue d'ensemble de Tabibi](docs/images/contexte.png)

## Carte des dépôts

| Dépôt | Rôle | Pile | Avancement |
|---|---|---|---|
| [`tabibi-backend`](https://github.com/<org>/tabibi-backend) | API métier, orchestration de production (`docker-compose.prod.yml`, `infra/`) | Spring Boot 3.4.1 / Java 21, Spring Security + Keycloak JWT, JPA, Liquibase, PostgreSQL 16 | v0.24.1, 27 commits, 17 modules, 16 changelogs, 54 classes de test |
| [`tabibi-web`](https://github.com/<org>/tabibi-web) | Front web, tous les rôles | Angular 18.2 (standalone, signaux, SSR), angular-oauth2-oidc, Karma / Jasmine, image Node | v0.21.0, 23 commits, 286 specs + 16 tests Playwright |
| [`tabibi-mobile`](https://github.com/<org>/tabibi-mobile) | Application patient Android et iOS | Flutter 3 (Dart >= 3.5), flutter_appauth, http | v0.13.0, 14 commits, CI avec APK |
| `tabibi-infra-docs` (ce dépôt) | Documentation vivante, environnement de dev, copie du realm Keycloak, diagrammes, **tests d'intégration réels des trois briques** | Docker Compose, Keycloak 26, Mermaid, Node 20 | 24 diagrammes, 8 documents, scénario d'intégration (20 étapes) + 10 tests Playwright du web contre la pile réelle, workflow `integration` |

Remplacer `<org>` par l'organisation GitHub qui héberge les dépôts.

## Sommaire de la documentation

| Document | Contenu | À lire quand |
|---|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | principes, vue d'ensemble, architecture hexagonale, modules et dépendances, diagrammes de classes, modèle de données, sécurité, **tous les endpoints par rôle**, structure du web et du mobile, séquences, conventions | premier jour |
| [docs/CHOIX-TECHNIQUES.md](docs/CHOIX-TECHNIQUES.md) | chaque technologie : version, pourquoi, alternatives écartées ; ordres de prix d'hébergement ; stratégie « commencer petit, pouvoir changer » | pour comprendre les décisions, ou recruter |
| [docs/SECURITE.md](docs/SECURITE.md) | modèle de menace, mesures en place (tirées du code), durcissement Keycloak, secrets, reste à faire avant la production (loi 18-07, chiffrement, sauvegardes, pentest) | avant de toucher à la sécurité ou de déployer |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | guide pas à pas : VPS, DNS, `.env`, realm de production, `docker compose up`, vérifications, sauvegardes, mise à jour, journaux, évolution | pour mettre en ligne |
| [docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md) | installer, lancer, tester chaque dépôt ; ajouter une fonctionnalité (liste de contrôle) ; conventions de commit ; lire le journal ; regénérer les diagrammes | avant le premier commit |
| [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md) | liste fonctionnelle par acteur avec, pour chaque fonctionnalité, les endpoints, la route web, l'écran mobile et le statut | pour savoir ce qui existe |
| [docs/JOURNAL.md](docs/JOURNAL.md) | journal global chronologique des trois dépôts (date, dépôt, version, hash, résumé) | pour retrouver quand et où une fonctionnalité est arrivée |
| [docs/architecture-cible.html](docs/architecture-cible.html) | la même architecture en une page HTML autonome avec les images, à ouvrir dans un navigateur ou à envoyer | pour présenter le projet |
| [CONTRIBUTING.md](CONTRIBUTING.md) | branches, pull requests, revue, CI verte, branche principale protégée | avant de contribuer |
| `docs/diagrammes/src/*.mmd`, `docs/images/*.png` | sources Mermaid et images générées (`docs/diagrammes/generer.sh`) | pour modifier un schéma |

## Démarrage rapide en dix minutes

Prérequis : Docker, JDK 21 et Maven 3.9, Node 20, Flutter (facultatif pour le mobile).

```bash
# 1. Cloner les quatre dépôts côte à côte
git clone https://github.com/<org>/tabibi-infra-docs.git
git clone https://github.com/<org>/tabibi-backend.git
git clone https://github.com/<org>/tabibi-web.git
git clone https://github.com/<org>/tabibi-mobile.git

# 2. PostgreSQL 16 + Keycloak 26 (realm tabibi importé avec les comptes de démonstration)
cd tabibi-infra-docs && docker compose up -d
#    Keycloak : http://localhost:8081 (admin / admin), PostgreSQL : localhost:5432 (tabibi / tabibi)

# 3. L'API (données en mémoire ; ajouter -Dspring-boot.run.profiles=postgres pour la base)
cd ../tabibi-backend && mvn spring-boot:run
#    http://localhost:8080/swagger-ui.html, http://localhost:8080/actuator/health

# 4. Le front web
cd ../tabibi-web && npm install && npm start
#    http://localhost:4200

# 5. L'application mobile (émulateur Android ; 10.0.2.2 désigne la machine hôte)
cd ../tabibi-mobile && flutter pub get && flutter run
```

Comptes de démonstration (développement local seulement, jamais en production) :

| Utilisateur | Mot de passe | Rôle | Essayer |
|---|---|---|---|
| `patient.demo` | `patient` | PATIENT | réserver un créneau du Dr Amina Belkacem, écrire au médecin, demander un médicament (Dawini) |
| `medecin.demo` | `medecin` | MEDECIN | `/medecin/agenda` : honorer, proposer une téléconsultation, rédiger une ordonnance |
| `secretaire.demo` | `secretaire` | SECRETAIRE | après rattachement par `medecin.demo` (`/medecin/secretaires`) : `/secretaire` |
| `pharmacie.demo` | `pharmacie` | PHARMACIE | `/pharmacie` : répondre aux demandes de la wilaya 16 |
| `admin.demo` | `admin` | ADMIN | `/admin` : candidatures, modération des avis, rappels |

Jeton en ligne de commande (dev seulement) :

```bash
curl -s -X POST http://localhost:8081/realms/tabibi/protocol/openid-connect/token \
  -d client_id=tabibi-web -d grant_type=password -d username=patient.demo -d password=patient \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
```

Tester : `mvn test` (backend), `npx ng test --watch=false --browsers=ChromeHeadlessCI` (web),
`flutter test` (mobile). Détails dans [docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md).

## Tests d'intégration réels (API + Keycloak + PostgreSQL + navigateur)

Les tests de chaque dépôt sont unitaires ou simulés. Ce dépôt ajoute la vérification **réelle** de l'ensemble :
`integration/lancer.sh` construit l'image de l'API depuis les sources de `tabibi-backend`, démarre PostgreSQL 16 et
Keycloak 26 (realm et comptes de démonstration importés), attend que tout réponde, puis `integration/scenario-api.mjs`
obtient de vrais jetons et déroule un parcours complet : identité et rôles, ouverture d'un créneau, candidature du
médecin validée par l'administrateur, réservation, notification, rendez-vous honoré, avis et synthèse publique,
ordonnance et vérification publique, refus 401 / 403. Chaque étape affiche `OK` ou `ECHEC` ; la pile est détruite à
la fin (`down -v`).

```bash
# tabibi-backend cloné à côté de ce dépôt ; Docker, Compose v2 et Node 20 installés
integration/lancer.sh
```

Le front web est ensuite vérifié **dans un vrai navigateur**, face à cette même pile : `integration/verifier-web.sh`
lance les tests Playwright de `integration/web` (Chromium) sur l'image `tabibi-web` branchée sur l'API réelle. Un
seul outil de test navigateur dans tout le projet : Playwright, ici comme dans `tabibi-web`.

```bash
# la pile et le conteneur web déjà lancés (voir le guide du développeur)
integration/verifier-web.sh                 # ou : cd integration/web && npm test
```

Les dix tests vérifient, à partir des **vraies données de l'API** (aucune liste codée en dur) : `assets/config.json`,
l'accueil et la fiche du praticien rendus côté serveur, la recherche par spécialité réellement filtrante, la
vérification publique d'une ordonnance, la redirection d'une page privée vers le Keycloak réel, `robots.txt` et
`sitemap.xml`, la CSP qui autorise l'API, et la bascule de l'interface en arabe (`dir="rtl"`).

Le workflow [`.github/workflows/integration.yml`](.github/workflows/integration.yml) (badge ci-dessus) rejoue tout cela
sur GitHub Actions à chaque push sur `main`, à chaque pull request, à la demande et chaque lundi, en clonant
`tabibi-backend` et `tabibi-web` à côté ; il construit ensuite l'image du front web, la lance face à l'API réelle,
exécute les tests Playwright et publie le rapport HTML, les traces, les captures et les vidéos en artefact
`playwright-integration-web`. Détails, variables et exploration de la pile dans
[docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md) (section « Tests d'intégration des trois briques ») ; ce que la
CI prouve, et ce qu'elle ne prouve pas, dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) (section 16).

## État d'avancement

Hash = commit qui a livré la fonctionnalité (voir [docs/JOURNAL.md](docs/JOURNAL.md)).

| Fonctionnalité | Backend | Web | Mobile (patient) |
|---|---|---|---|
| Socle : connexion Keycloak, JWT, rôles, `/api/moi` | v0.1.0 `8cf3134` | v0.1.0 `c86810d` | v0.1.0 `053f2de` |
| Persistance JPA / PostgreSQL + Liquibase | v0.2.0 `61d07fd` | — | — |
| Annuaire : recherche publique de praticiens | v0.3.0 `5e3ae9a` | v0.2.0 `d54e169` | v0.2.0 `8bd6b73` |
| Créneaux et fiche du praticien | v0.4.0 `252ad14` | v0.3.0 `6ebf00b` | v0.3.0 `c970f87` |
| Réserver, mes rendez-vous, annuler | v0.5.0 `ad63b7b` (+ v0.5.1 `1fa03d9`) | v0.3.0 `6ebf00b` | v0.3.0 `c970f87` |
| Ordonnances : rédaction, consultation, vérification publique | v0.6.0 `65abf35` | v0.4.0 `167e6b5` | v0.4.0 `0f6c3ba` |
| Espace médecin : agenda, honorer, créneaux, ordonnances rédigées | v0.7.0 `53a65ee` | v0.5.0 `cb9dda4` | hors périmètre |
| Notifications internes, port `Notifieur` | v0.8.0 `1bd2d65` | v0.6.0 `312b010` | v0.5.0 `4f1d143` |
| Téléconsultation Jitsi avec consentement | v0.9.0 `7efc917` | v0.7.0 `61fe225` | v0.6.0 `cef96cb` |
| Administration : candidatures des médecins, statistiques | v0.10.0 `6ade583` | v0.8.0 `6ca7b2b` | hors périmètre |
| Messagerie patient-médecin | v0.11.0 `1ddc48a` | v0.9.0 `852199c` | v0.7.0 `47c7539` |
| Avis vérifiés, synthèse publique, modération | v0.12.0 `e9e96f2` | v0.10.0 `ad6b213` | v0.8.0 `35453ee` |
| Dawini : besoins de médicaments et pharmacies | v0.13.0 `1f23e39` | v0.11.0 `49cd6ec` | v0.9.0 `a7078c2` (+ v0.9.1 `341fc5c`) |
| Profil de l'utilisateur | v0.14.0 `5e82ed1` | v0.13.0 `b427a4d` | v0.11.0 `8fc3667` |
| Liste d'attente et alerte de créneau libéré | v0.15.0 `4eccf80` | v0.14.0 `b745b21` | v0.12.0 `9f3cc3c` |
| Cabinet : secrétaires, espace secrétaire, annulation par le cabinet | v0.16.0 `9e9f6d0` | v0.15.0 `11d34ef` | hors périmètre |
| Rappels de rendez-vous 24 h avant | v0.17.0 `a860191` | v0.16.0 `bccea88` | (reçus en notification) |
| Configuration par environnement (API, Keycloak) | variables d'environnement dès v0.1.0 | v0.12.0 `9417001` | v0.10.0 `6f5d39a` |
| CORS configurable | v0.18.0 `acca60a` | — | — |
| Journal des accès à l'API | v0.19.0 `e412bae` | pas d'écran | — |
| Image Docker de production, orchestration Compose, Caddy, sauvegardes | v0.20.0 `3e8c786` | v0.17.0 `92bcfa7` | — |
| CI : publication sur GHCR, Dependabot | v0.21.0 `1de20fb` | v0.18.0 `40410ff` | v0.13.0 `40bc155` (APK, stores) |
| Durcissement du realm Keycloak, realm de production | v0.22.0 `ae58723` | — | — |
| Rendu côté serveur des pages publiques (SSR) | — | v0.19.0 `fea168b` | — |
| Orchestration : `DOMAINE` transmis au service `web`, versions alignées sur le journal | v0.22.1 `d14bc9f` | v0.19.1 `359d1cb` | — |
| Ordonnance imprimable (PDF avec QR code de vérification) | v0.23.0 `799efd3` | impression navigateur depuis v0.4.0 | — |
| Limitation de débit sur les points publics (429, `Retry-After`) | v0.24.0 `8e9e288` | — | — |
| Référencement : titres, descriptions, page 404, `robots.txt`, `sitemap.xml` | — | v0.20.0 `09006fc` | — |
| Scénario de bout en bout dans le dépôt (API simulée ou adaptateurs en mémoire, sans Docker) | v0.24.1 `7736cba` (`ScenarioApiTest`) | v0.21.0 `deb1202` (Playwright, 16 tests) | — |
| Tests d'intégration réels des trois briques (pile Docker, scénario API, rendu serveur du web) et CI dédiée | infra-docs `22e4529`, `faf9156` (scénario contre l'API réelle, PDF compris) | infra-docs `ad31ea1` (image web face à l'API réelle) | pas encore (pas d'émulateur en CI) |
| Front web vérifié dans un vrai navigateur (Playwright) contre la pile réelle | — | infra-docs `84369d5`, `e86ac20` (10 tests Chromium, rapport et traces en artefacts) | pas encore |

## Ce qu'il reste à faire

Détail et priorités dans [docs/SECURITE.md](docs/SECURITE.md) (section 5) et [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md).

1. **Avant la production** : conformité loi 18-07 / RGPD (information, consentements, droits, localisation des
   données), chiffrement au repos et des sauvegardes, restauration testée, MFA imposée aux administrateurs et
   médecins, test d'intrusion, durcissement du serveur, pousser sur la branche `main` (la CI ne publie les images
   que depuis `main`), renseigner la variable de dépôt `ORG_GITHUB` pour que la CI d'intégration clone les bons dépôts.
2. **Fonctionnel** : SMS / e-mail (adaptateurs du port `Notifieur`), nom du patient dans les écrans du cabinet,
   sélecteur de wilayas, écran du journal des accès, annulation d'une ordonnance, export et effacement d'un compte,
   purge du journal des accès.
3. **Mobile** : stockage sécurisé et rafraîchissement du jeton, notifications push, icône et écran de lancement,
   signature release depuis la CI, publication sur les stores.
4. **Tests** : connexion OIDC réelle jusqu'au bout dans le navigateur (la CI d'intégration vérifie aujourd'hui que
   la page privée part bien vers Keycloak, pas qu'un compte s'y connecte) ; transmettre à Playwright le code de
   l'ordonnance émise par le scénario API (variable `CODE_ORDONNANCE`) pour vérifier aussi le cas valide de
   `/verifier` ; tests mobiles contre l'API réelle.
5. **Plus tard** : instance Jitsi dédiée, base managée puis plusieurs instances
   (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)).

## Contenu de ce dépôt

```
README.md                      cette page
CONTRIBUTING.md                règles de contribution
docker-compose.yml             PostgreSQL 16 + Keycloak 26 pour le développement (identique à celui du backend)
integration/                   tests d'intégration réels : pile Docker (docker-compose.integration.yml),
                               scénario API (scenario-api.mjs), lanceur (lancer.sh), lanceur des tests navigateur
                               (verifier-web.sh) et tests Playwright du front (web/)
.github/workflows/integration.yml   la CI qui exécute cette pile réelle (API + Keycloak + PostgreSQL + web)
infra/keycloak/tabibi-realm.json   copie du realm de développement (source de vérité : tabibi-backend)
docs/*.md                      les documents listés plus haut
docs/architecture-cible.html   la version HTML autonome
docs/diagrammes/src/*.mmd      sources Mermaid ; docs/diagrammes/generer.sh les regénère
docs/images/*.png, *.svg       les images générées (24 diagrammes)
```
