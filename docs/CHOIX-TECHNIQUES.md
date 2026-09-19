# Choix techniques : quoi, quelle version, pourquoi, et ce qui a été écarté

> **Pourquoi ce document.** Un développeur qui arrive doit comprendre non seulement *ce qui* a été choisi mais
> *pourquoi*, et savoir ce qui a été écarté et à quel prix. Ce document est aussi un outil de recrutement : il dit
> quelles compétences on cherche. Les prix indiqués sont des ordres de grandeur prudents (fourchettes, hors taxes,
> à vérifier sur les grilles tarifaires du moment), jamais des chiffres contractuels.

## Sommaire

1. [Résumé de la pile](#1-résumé-de-la-pile)
2. [Backend : Java 21 et Spring Boot 3.4](#2-backend--java-21-et-spring-boot-34)
3. [Base de données : PostgreSQL 16 et Liquibase](#3-base-de-données--postgresql-16-et-liquibase)
4. [Identité : Keycloak 26](#4-identité--keycloak-26)
5. [Front web : Angular 18](#5-front-web--angular-18)
6. [Mobile : Flutter 3](#6-mobile--flutter-3)
7. [Téléconsultation : Jitsi Meet](#7-téléconsultation--jitsi-meet)
8. [Exécution : Docker, Caddy, Compose](#8-exécution--docker-caddy-compose)
9. [Livraison : GitHub, Actions, GHCR, Dependabot](#9-livraison--github-actions-ghcr-dependabot)
10. [Hébergement : commencer moins cher](#10-hébergement--commencer-moins-cher)
11. [Stratégie « commencer petit, pouvoir changer »](#11-stratégie--commencer-petit-pouvoir-changer)

## 1. Résumé de la pile

| Couche | Choix | Version (dans le code) | Dépôt |
|---|---|---|---|
| Langage backend | Java (LTS) | 21 (`pom.xml`, image `eclipse-temurin:21-jre-alpine`) | tabibi-backend |
| Cadre backend | Spring Boot (Web, Security, OAuth2 Resource Server, Validation, Actuator, Data JPA) | 3.4.1 | tabibi-backend |
| Documentation d'API | springdoc-openapi (Swagger UI) | 2.7.0 | tabibi-backend |
| Persistance | PostgreSQL + Liquibase (JPA / Hibernate) | PostgreSQL 16 (`postgres:16-alpine` en prod), Liquibase géré par Boot | tabibi-backend |
| Tests backend | JUnit 5, Mockito, Spring Security Test, Testcontainers | Testcontainers 1.20.4 | tabibi-backend |
| Identité | Keycloak | 26.0 (`quay.io/keycloak/keycloak:26.0`) | infra |
| Front web | Angular (standalone, signaux, SSR) + angular-oauth2-oidc | Angular 18.2, @angular/ssr 18.2, angular-oauth2-oidc 17, TypeScript 5.5, Node 20 | tabibi-web |
| Tests web | Karma / Jasmine (Chrome headless) | Karma 6.4, Jasmine 5.1 | tabibi-web |
| Serveur web | Node + express (rendu côté serveur et fichiers statiques, `server.ts`) | `node:20-alpine`, express 4 | tabibi-web |
| Mobile | Flutter / Dart + flutter_appauth, http, url_launcher, flutter_secure_storage | SDK Dart >= 3.5, flutter_appauth 8, http 1.2, url_launcher 6.3 | tabibi-mobile |
| Vidéo | Jitsi Meet (lien de salle, aucun SDK) | instance `https://meet.jit.si` par défaut | tabibi-backend |
| Reverse proxy | Caddy | `caddy:2-alpine` | tabibi-backend (`infra/caddy`) |
| Orchestration | Docker Compose (un serveur) | Compose v2 | tabibi-backend, tabibi-infra-docs |
| CI / registre | GitHub Actions, GitHub Container Registry, Dependabot | actions v4 à v6 | les trois dépôts |
| Diagrammes | Mermaid (sources versionnées, PNG et SVG générés) | mermaid-cli 11 | tabibi-infra-docs |

## 2. Backend : Java 21 et Spring Boot 3.4

**Pourquoi.**
- **Sécurité intégrée** : Spring Security + `spring-boot-starter-oauth2-resource-server` valident un JWT Keycloak
  (JWKS, issuer) en quelques lignes, `@PreAuthorize` porte l'autorisation par rôle, `@EnableMethodSecurity` et les
  tranches de test (`@WebMvcTest` + `spring-security-test`) permettent de tester 401 / 403 sur chaque endpoint.
  C'est la pile la plus éprouvée pour des données sensibles (santé, banque).
- **Typage fort et architecture hexagonale naturelle** : records immuables, interfaces comme ports, injection par
  constructeur ; le domaine reste sans annotation.
- **Écosystème complet** : JPA / Hibernate, Liquibase, Actuator (sondes de santé), springdoc (Swagger), Testcontainers
  (tests d'intégration sur un vrai PostgreSQL), `@Scheduled` (rappels) sans dépendance externe.
- **Recrutement** : Java et Spring sont très enseignés et très pratiqués en Algérie et au Maghreb ; on trouve des
  profils juniors et seniors.
- **Java 21 (LTS)** : support long, records, `switch` à motifs, threads virtuels disponibles si besoin.

**Alternatives écartées.**
- *Node.js (NestJS, Express)* : rapide à démarrer, mais la sécurité (validation, OIDC, autorisations) se compose à
  partir de bibliothèques hétérogènes, le typage reste optionnel, et la culture « un script par endpoint » fait
  dériver l'architecture quand l'équipe grandit.
- *Python (Django, FastAPI)* : très bon pour un prototype ; Django impose son ORM et son modèle monolithique, FastAPI
  laisse tout à assembler ; moins naturel pour une architecture hexagonale stricte et un typage vérifié à la compilation.
- *Go* : excellent pour des services réseau ; moins de bibliothèques métier prêtes (JPA, migrations, OIDC resource
  server, validation) et vivier de recrutement plus étroit localement.
- *Kotlin + Spring* : tout à fait possible plus tard (même écosystème) ; Java a été retenu pour la lisibilité par le
  plus grand nombre.

## 3. Base de données : PostgreSQL 16 et Liquibase

**Pourquoi.**
- **PostgreSQL** : gratuit, robuste, transactions sérieuses, `timestamptz`, `uuid`, JSON (`lignes_json` des
  ordonnances), extensions ; disponible en service managé chez tous les hébergeurs et en conteneur pour le dev.
- **Liquibase** : les migrations sont des fichiers YAML versionnés avec le code (`001-initial.yaml` à `016-audit.yaml`),
  appliqués automatiquement au démarrage de l'API ; le schéma est donc reproductible sur n'importe quelle base et
  `ddl-auto: validate` garantit que les entités JPA et le schéma sont alignés.
- **Portabilité** : JPA + changelogs génériques (types abstraits) : passer à une autre base relationnelle
  (MariaDB, SQL Server) resterait une question de pilote et de tests, pas de réécriture.
- **Deux adaptateurs par port** : l'API démarre sans base (profil par défaut, en mémoire) ; PostgreSQL n'est branché
  que sous le profil `postgres`. Les tests unitaires ne dépendent d'aucune base, le test d'intégration
  Testcontainers valide les adaptateurs JPA sur un vrai PostgreSQL.

**Alternatives écartées.**
- *Flyway* : équivalent tout à fait valable (SQL brut) ; Liquibase a été préféré pour ses changelogs YAML portables
  et ses instructions `createTable` / `addColumn` indépendantes du dialecte.
- *MySQL / MariaDB* : possible, mais PostgreSQL est plus riche (types, contraintes, JSON) à coût égal.
- *Base NoSQL (MongoDB)* : les données sont relationnelles (rendez-vous, créneaux, avis par rendez-vous, unicité
  patient / médecin) et exigent des contraintes fortes ; un document store n'apporterait rien ici.
- *Supabase (PostgreSQL managé + API automatique)* : la base est du PostgreSQL, donc compatible en tant que simple
  hébergement de la base ; en revanche l'« API automatique » et la sécurité par RLS contourneraient le domaine et
  les règles métier de l'API. Non retenu comme cadre applicatif.

## 4. Identité : Keycloak 26

**Pourquoi.**
- **Souveraineté et confidentialité** : les identités des patients restent dans notre infrastructure ; rien ne
  transite par un fournisseur d'identité étranger. Point important pour des données de santé et pour la loi
  algérienne 18-07 (voir [SECURITE.md](SECURITE.md)).
- **Standard OIDC / OAuth2** : Authorization Code + PKCE pour le web (`angular-oauth2-oidc`) et le mobile
  (`flutter_appauth`), JWT signés validés par l'API ; aucun code d'authentification maison.
- **Tout est là** : rôles du realm (PATIENT, MEDECIN, SECRETAIRE, ADMIN, PHARMACIE), MFA TOTP, protection contre la
  force brute, politique de mots de passe, pages de connexion thémables, console d'administration, export / import
  du realm (`infra/keycloak/tabibi-realm.json`, versionné et testé par `RealmKeycloakTest`).
- **Gratuit et open source** (Red Hat), très déployé en santé et en secteur public.

**Alternatives écartées.**
- *Auth0, Firebase Authentication, AWS Cognito* : SaaS confortables mais facturés par utilisateur actif (le coût
  suit le succès), données d'identité hors du pays, verrouillage sur un fournisseur.
- *Supabase Auth* : lié à la plateforme Supabase ; moins de maîtrise des flux (MFA conditionnelle par rôle, thèmes,
  fédération) et même question de localisation des données.
- *Authentification maison (Spring Security + table utilisateurs)* : moins de code tiers à exploiter, mais il
  faudrait réécrire ce que Keycloak fait déjà bien (MFA, verrouillage, réinitialisation, sessions, PKCE), avec le
  risque d'erreur qui va avec.

**Coût d'exploitation** : un conteneur de plus (environ 500 Mo à 1 Go de mémoire) et une base dédiée ; sur le VPS
unique, c'est absorbé.

## 5. Front web : Angular 18

**Pourquoi.**
- **Un cadre complet et cohérent** : routeur, client HTTP et intercepteurs, formulaires, injection de dépendances,
  tests (Karma / Jasmine) et CLI livrés ensemble ; les choix d'architecture sont faits pour l'équipe, ce qui compte
  quand elle grandit.
- **TypeScript de bout en bout**, composants standalone et signaux (Angular 18) : moins de cérémonie qu'avant, code
  lisible.
- **OIDC prêt** : `angular-oauth2-oidc` (Authorization Code + PKCE, discovery document, `state` pour revenir sur la
  page demandée).
- **Configuration à l'exécution** (`assets/config.json` lu par un `APP_INITIALIZER`, `process.env` côté serveur) :
  le même build sert en dev, en recette et en production.
- **Rendu côté serveur inclus** (`@angular/ssr`, express) : les pages publiques de l'annuaire sont indexables sans
  changer de cadre ni ajouter un second serveur applicatif.
- **Recrutement** : Angular est répandu dans les entreprises de services et les grandes organisations ; ce profil
  est complémentaire d'un profil Spring.

**Alternatives écartées.**
- *React (+ Vite)* : bibliothèque de rendu, pas un cadre : routeur, requêtes, formulaires, état et tests sont à
  choisir et à assembler ; très bon pour une petite équipe experte, moins structurant pour une équipe qui se forme.
- *Next.js* : apporte le SSR et le rendu hybride, utiles pour le SEO d'un annuaire ; mais son modèle (routes
  serveur, actions) doublonne avec l'API Spring. Angular a son propre SSR (`@angular/ssr`), retenu ici : un petit
  serveur express rend les pages publiques et sert les fichiers, sans logique métier côté Node.
- *Vue / Nuxt* : proche de React dans l'arbitrage ; moins courant localement.

## 6. Mobile : Flutter 3

**Pourquoi.**
- **Un seul code pour Android et iOS**, rendu natif performant, Material 3 ; l'application patient est volontairement
  simple (listes, formulaires, boutons) et Flutter y excelle.
- **OIDC natif** : `flutter_appauth` s'appuie sur AppAuth (navigateur système, PKCE, redirection `dz.tabibi.app:/oauthredirect`),
  la façon recommandée de se connecter à Keycloak depuis une application mobile (jamais de WebView interne).
- **Configuration à la compilation** (`--dart-define`) : aucune adresse codée en dur, aucun secret embarqué (client
  public).
- **Tests** : `flutter test` avec un `FakeApiService` injecté dans les pages ; CI qui produit un APK de débogage.

**Alternatives écartées.**
- *React Native* : mutualiserait des compétences JavaScript, mais dépend de ponts natifs et d'un outillage
  (Metro, Expo ou non) plus mouvant ; l'expérience OIDC native et la qualité de rendu sont moins prévisibles.
- *Capacitor / Ionic (réutiliser l'application Angular dans une WebView)* : tentant pour ne pas dupliquer les écrans,
  mais l'expérience est celle d'un site dans une coquille, et la connexion OIDC dans une WebView est déconseillée.
  Cette option reste une solution de repli si l'équipe mobile manque.
- *Deux applications natives (Kotlin + Swift)* : le meilleur rendu, au double du coût de développement et de
  maintenance ; injustifié aujourd'hui.

## 7. Téléconsultation : Jitsi Meet

**Pourquoi.**
- **Open source, gratuit, sans SDK propriétaire** : l'API génère un nom de salle non devinable (`tabibi-` + 32
  caractères hexadécimaux tirés par `SecureRandom`) et remet le lien au médecin, puis au patient **après son
  consentement explicite** ; l'application ouvre le lien dans un nouvel onglet (web) ou le navigateur externe (mobile).
- **Auto-hébergeable** : l'instance publique `meet.jit.si` sert à démarrer ; une instance Tabibi (`TABIBI_TELECONSULTATION_BASE_URL`)
  permettra de garder les flux vidéo sous contrôle.
- **Aucun couplage** : rien à changer dans le domaine pour changer de fournisseur (le lien est une URL).

**Alternatives écartées.**
- *Twilio Video, Agora, Daily, Vonage* : SDK propriétaires, facturation à la minute, données de flux hors du pays.
- *WebRTC maison* : signalisation, TURN, qualité réseau : plusieurs mois de travail pour refaire Jitsi.

## 8. Exécution : Docker, Caddy, Compose

**Pourquoi.**
- **Images OCI multi-étapes** (backend : Maven puis JRE Alpine, utilisateur sans privilège, `HEALTHCHECK` ; web :
  Node pour construire puis Node pour servir et rendre, utilisateur `node`) : la même image tourne partout, le déploiement est un `docker compose pull && up -d`.
- **Caddy** : certificats Let's Encrypt automatiques (renouvellement compris), HTTP/2 et HTTP/3, un `Caddyfile` de
  trente lignes pour trois sous-domaines, en-têtes de sécurité (HSTS, nosniff, Referrer-Policy).
- **Docker Compose sur un serveur** : lisible, reproductible, suffisant pour des milliers d'utilisateurs ; réseau
  interne, volumes nommés, redémarrage automatique, sondes de santé.

**Alternatives écartées.**
- *nginx + certbot* : fonctionne, mais plus de plomberie (renouvellement, rechargement) pour le même résultat ;
  l'image web a d'abord utilisé nginx (v0.17.0) avant de passer à express pour le rendu côté serveur (v0.19.0).
- *Traefik* : excellent avec un orchestrateur ; plus de concepts que nécessaire pour un seul hôte.
- *Kubernetes dès le départ* : surdimensionné (coût, compétences) ; la voie d'évolution est décrite dans
  [DEPLOIEMENT.md](DEPLOIEMENT.md) et reste ouverte puisque tout est déjà en images et en variables d'environnement.
- *PaaS (Heroku, Render, Fly.io, Railway)* : très pratique, mais coût mensuel par service, données hors du pays et
  Keycloak plus difficile à y loger.

## 9. Livraison : GitHub, Actions, GHCR, Dependabot

**Pourquoi.**
- **GitHub** : organisation avec quatre dépôts, branche principale protégée (pull request, CI verte, revue).
- **GitHub Actions** : la CI vit à côté du code (`.github/workflows/ci.yml`) : `mvn verify` (backend),
  `npm ci` + `ng build` + `ng test` (web), `flutter analyze` + `flutter test` + APK (mobile).
- **GHCR** : le registre d'images est celui de GitHub ; l'authentification utilise le `GITHUB_TOKEN` du workflow,
  aucun compte ni secret supplémentaire ; tags `latest` et `sha-<commit>` (déploiement reproductible).
- **Dependabot** : pull requests hebdomadaires de mise à jour (Maven, npm, Actions, images Docker), vérifiées par la CI.

**Alternatives écartées.** *Docker Hub* (limites de téléchargement anonymes, compte séparé), *GitLab* (tout aussi bon,
mais l'organisation est sur GitHub), *registre privé auto-hébergé* (une chose de plus à exploiter).

## 10. Hébergement : commencer moins cher

Le déploiement cible est **un VPS de 2 vCPU et 4 Go de mémoire** avec Docker (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).
Ordres de grandeur, hors taxes, à vérifier au moment du choix :

| Poste | Fourchette mensuelle prudente | Remarques |
|---|---|---|
| VPS 2 vCPU / 4 Go (Hetzner Cloud, OVHcloud VPS, Scaleway) | environ 5 à 15 EUR | Hetzner (Allemagne, Finlande) est souvent le moins cher à performance égale ; OVHcloud et Scaleway (France) sont des alternatives européennes ; un modèle 4 vCPU / 8 Go pour grandir reste sous 30 EUR |
| Nom de domaine | 1 à 2 EUR (10 à 20 EUR par an) | `.dz` via un registrar agréé, ou `.com` / `.net` |
| Certificats TLS | 0 | Let's Encrypt via Caddy |
| Sauvegardes hors site (stockage objet ou espace de stockage) | 1 à 5 EUR | quelques Go chiffrés |
| Jitsi Meet | 0 (instance publique) ; environ 10 à 30 EUR si instance dédiée | une instance dédiée demande un serveur à part, dimensionné pour la vidéo |
| PostgreSQL managé (étape 2) | environ 15 à 60 EUR | sauvegardes et réplication gérées ; à envisager quand la base devient critique |
| GitHub, Actions, GHCR | 0 pour des dépôts publics ; quota gratuit puis quelques EUR pour des dépôts privés | à surveiller si la CI devient lourde |

**Total de départ : de l'ordre de 10 à 25 EUR par mois** pour la plateforme complète, hors travail humain.

**Point d'attention juridique (Algérie)** : la loi 18-07 sur la protection des données à caractère personnel
encadre le traitement des données de santé et le transfert de données hors du territoire. Un hébergement en Europe est
le moins cher et le plus simple techniquement pour démarrer, mais **la localisation des données de production doit
être validée avec un conseil juridique** (hébergeur algérien, autorisation de l'autorité compétente, ou
mesures compensatoires). Tout ici est portable : changer d'hébergeur ne change ni le code ni les images.

## 11. Stratégie « commencer petit, pouvoir changer »

Le code est déjà prêt pour les changements prévisibles :

| Changement futur | Ce qui est déjà en place | Ce qu'il resterait à faire |
|---|---|---|
| Changer d'hébergeur | tout est en images OCI et Compose ; sauvegardes `pg_dump` ; DNS à repointer | copier `.env`, restaurer la base, relancer `docker compose up -d` |
| Base de données managée | `SPRING_DATASOURCE_URL`, `KC_DB_URL` en variables ; Liquibase applique le schéma au démarrage | changer deux variables, restaurer un dump |
| Plusieurs instances de l'API | API sans état (JWT, pas de session) ; `TABIBI_RAPPELS_ACTIFS` pour ne planifier les rappels que sur une instance | un répartiteur de charge devant (Caddy sait le faire) |
| Envoyer des SMS ou des e-mails | port `Notifieur` et enum `CanalNotification` (SMS, EMAIL réservés) | un adaptateur (fournisseur SMS algérien, Brevo) branché sur le port, sans toucher au domaine |
| Instance Jitsi dédiée | `TABIBI_TELECONSULTATION_BASE_URL` | déployer Jitsi, changer une variable |
| Autre fournisseur d'identité OIDC | l'API ne dépend que de l'issuer et du JWKS ; `KeycloakRoleConverter` isole la lecture des rôles | adapter le convertisseur de rôles ; les clients OIDC sont standard |
| Recette et production | web : `assets/config.json` écrit au démarrage du conteneur ; mobile : `--dart-define` ; backend : profils et variables | un `.env` par environnement |
| Remplacer PostgreSQL | JPA + changelogs Liquibase génériques | pilote JDBC, relecture des requêtes dérivées, tests Testcontainers sur la nouvelle base |
| Orchestrateur (Kubernetes) | images, sondes `liveness` / `readiness`, configuration par variables, aucun état local hors volumes | manifestes ou charts |

Ce que l'on ne fait volontairement **pas** aujourd'hui : microservices (un monolithe modulaire hexagonal suffit et
se découpe plus tard le long des modules), file de messages (les notifications sont synchrones et internes), cache
distribué, prérendu statique (le rendu côté serveur se fait à la demande, avec secours sans rendu).
