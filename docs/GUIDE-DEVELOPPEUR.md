# Guide du développeur

> **Pourquoi ce document.** Pour qu'un développeur qui rejoint Tabibi soit productif le premier jour : installer,
> lancer et tester chaque dépôt, ajouter une fonctionnalité en respectant l'architecture, écrire un commit conforme,
> lire le journal. Les règles de contribution (branches, pull requests) sont dans [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Sommaire

1. [Outils à installer](#1-outils-à-installer)
2. [Lancer l'environnement complet en local](#2-lancer-lenvironnement-complet-en-local)
3. [Backend : `tabibi-backend`](#3-backend--tabibi-backend)
4. [Web : `tabibi-web`](#4-web--tabibi-web)
5. [Mobile : `tabibi-mobile`](#5-mobile--tabibi-mobile)
6. [Ajouter une fonctionnalité : la liste de contrôle](#6-ajouter-une-fonctionnalité--la-liste-de-contrôle)
7. [Conventions de commit](#7-conventions-de-commit)
8. [Lire et tenir le journal](#8-lire-et-tenir-le-journal)
9. [Regénérer les diagrammes de ce dépôt](#9-regénérer-les-diagrammes-de-ce-dépôt)

## 1. Outils à installer

| Outil | Version | Pour |
|---|---|---|
| Git | récent | tous les dépôts |
| Docker Engine + Compose v2 | récent | PostgreSQL et Keycloak en local, test d'intégration Testcontainers, images |
| JDK Temurin | 21 | backend |
| Maven | 3.9 | backend (`mvn`) |
| Node.js + npm | 20 | web |
| Chrome ou Chromium | récent | tests Karma (`CHROME_BIN` si hors du `PATH`) |
| Flutter SDK (canal stable) + Android Studio (SDK, émulateur) ; Xcode sur macOS | Flutter 3, Dart >= 3.5 | mobile |
| Mermaid CLI (`npm install -g @mermaid-js/mermaid-cli`) | 11 | diagrammes de ce dépôt (facultatif) |

## 2. Lancer l'environnement complet en local

```bash
git clone https://github.com/<org>/tabibi-infra-docs.git
git clone https://github.com/<org>/tabibi-backend.git
git clone https://github.com/<org>/tabibi-web.git
git clone https://github.com/<org>/tabibi-mobile.git

cd tabibi-infra-docs && docker compose up -d      # PostgreSQL 16 (5432) + Keycloak 26 (8081, realm tabibi importé)
cd ../tabibi-backend && mvn spring-boot:run        # API sur http://localhost:8080, données en mémoire
cd ../tabibi-web && npm install && npm start       # http://localhost:4200
cd ../tabibi-mobile && flutter pub get && flutter run   # émulateur Android (10.0.2.2 = machine hôte)
```

Le `docker-compose.yml` de ce dépôt et celui du backend sont équivalents (mêmes images, même realm monté) : lancer
l'un ou l'autre, pas les deux (mêmes ports). Keycloak : console `http://localhost:8081` (`admin` / `admin`).

**Comptes de démonstration** (realm de développement seulement, jamais en production) :

| Utilisateur | Mot de passe | Rôle |
|---|---|---|
| `patient.demo` | `patient` | PATIENT |
| `medecin.demo` | `medecin` | MEDECIN (identifiant du premier praticien de démonstration de l'annuaire en mémoire) |
| `secretaire.demo` | `secretaire` | SECRETAIRE (à rattacher par `medecin.demo`) |
| `pharmacie.demo` | `pharmacie` | PHARMACIE |
| `admin.demo` | `admin` | ADMIN |

Obtenir un jeton en ligne de commande (le client `tabibi-web` accepte le mot de passe direct **en dev seulement**) :

```bash
TOKEN=$(curl -s -X POST http://localhost:8081/realms/tabibi/protocol/openid-connect/token \
  -d client_id=tabibi-web -d grant_type=password -d username=medecin.demo -d password=medecin \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
curl -s http://localhost:8080/api/moi -H "Authorization: Bearer $TOKEN"
```

## 3. Backend : `tabibi-backend`

```bash
mvn spring-boot:run                                          # profil par défaut : en mémoire, sans base
mvn spring-boot:run -Dspring-boot.run.profiles=postgres      # JPA + Liquibase sur le PostgreSQL de docker compose
mvn test                                                     # unitaires + tranches web (aucun service externe)
mvn verify -Dit.docker=true                                  # + test d'intégration PostgreSQL (Testcontainers, Docker requis)
docker build -t tabibi-backend .                             # image de production
```

- Swagger : `http://localhost:8080/swagger-ui.html`. Santé : `/actuator/health`.
- Variables utiles : `TABIBI_KEYCLOAK_ISSUER`, `TABIBI_CORS_ORIGINES`, `TABIBI_TELECONSULTATION_BASE_URL`,
  `TABIBI_RAPPELS_ACTIFS`, `SPRING_DATASOURCE_*` (voir le README du dépôt).
- Structure : un module par domaine, `domain/` (entités, ports, exceptions), `application/` (services),
  `adapter/` (contrôleur, repositories mémoire et JPA) ; voir [ARCHITECTURE.md](ARCHITECTURE.md).
- Tests (50 classes) : `src/test/java/dz/tabibi/backend/<module>/` : `*Test` sur le domaine (`AvisTest`,
  `TeleconsultationTest`, `ProfilTest`...), `*ServiceTest` (cas d'usage avec faux ports), `*WebTest`
  (`@WebMvcTest` + `SecurityConfig` : 401 sans jeton, 403 par rôle, codes HTTP), `JpaRendezVousRepositoryIT`
  (Testcontainers, activé par `-Dit.docker=true`), `SecuriteWebTest` et `CorsWebTest` (chaîne de sécurité),
  `RealmKeycloakTest` (le realm versionné est conforme).

## 4. Web : `tabibi-web`

```bash
npm install
npm start                                                    # ng serve, http://localhost:4200
npx ng test --watch=false --browsers=ChromeHeadlessCI        # 271 specs, Chrome headless sans bac à sable
npx ng build                                                 # dist/tabibi-web/browser et server/server.mjs
npm run serve:ssr                                            # http://localhost:4000 : build de production rendu côté serveur
docker build -t tabibi-web . && docker run --rm -p 4200:80 -e TABIBI_API_URL=http://localhost:8080 \
  -e TABIBI_KEYCLOAK_ISSUER=http://localhost:8081/realms/tabibi tabibi-web      # image Node (SSR)
```

- Configuration : `src/assets/config.json` (`apiUrl`, `keycloakIssuer`, `keycloakClientId`), lue par `ConfigService`
  avant le démarrage (côté serveur : `CONFIGURATION_SERVEUR` depuis `process.env`) ; remplacée au déploiement,
  jamais reconstruite. Le rendu côté serveur (`server.ts`) ne doit jamais dépendre de `window`, `localStorage` ni
  d'une minuterie : vérifier `isPlatformBrowser` avant d'en utiliser.
- Structure : un dossier par domaine avec un `*.service.ts` (HTTP) et des composants standalone ; `auth/` (OIDC,
  intercepteur, rôles, gardes) ; routes dans `app.routes.ts`.
- Tests : `*.spec.ts` à côté de chaque fichier ; services avec `HttpTestingController`, composants avec un service
  factice ; `AppComponent` a un test de fumée de la barre de navigation par rôle.

## 5. Mobile : `tabibi-mobile`

```bash
flutter pub get
flutter run                                                  # émulateur Android
flutter run --dart-define=TABIBI_API_URL=http://localhost:8080 \
            --dart-define=TABIBI_ISSUER=http://localhost:8081/realms/tabibi     # simulateur iOS
flutter analyze && flutter test
tool/preparer_android.sh && flutter build apk --debug        # projet Android généré et configuré (dz.tabibi.app)
```

- Configuration : `lib/config/configuration.dart` (`--dart-define`), client public `tabibi-mobile` (PKCE).
- Structure : `services/` (ApiService, AuthService, session), `models/`, `pages/`, `utils/`, `widgets/`.
- Tests : `test/*_test.dart` (modèles, utilitaires), `test/widget_test.dart` (pages avec `FakeApiService`).
- Les projets natifs `android/` et `ios/` ne sont pas versionnés (`flutter create .`).

## 6. Ajouter une fonctionnalité : la liste de contrôle

Exemple : « le patient peut noter la ponctualité d'un cabinet ». Suivre l'ordre : chaque étape a ses tests.

**Backend**

1. **Domaine** (`<module>/domain/`) : l'entité ou la valeur (record immuable), ses règles (validation au
   constructeur ou dans une méthode de fabrique, transitions d'état qui lèvent `TransitionInvalideException`),
   ses exceptions (`XIntrouvableException`, `XInvalideException`). Aucune annotation Spring. Tests du domaine.
2. **Port** (`<module>/domain/XRepository.java`) : l'interface, uniquement ce dont le cas d'usage a besoin
   (`enregistrer`, `parId`, `parPatient`...). Si la fonctionnalité doit prévenir quelqu'un, injecter le port
   `Notifieur` ; si elle libère un créneau, le port `AlerteCreneau`.
3. **Service** (`<module>/application/XService.java`) : le cas d'usage, `@Service`, `@Transactional` sur ce qui
   écrit, règle de propriétaire (`AccesRefuseException`), appels aux ports. Tests avec de faux ports (Mockito ou
   fakes en mémoire) : cas nominal, chaque refus (400, 403, 404, 409), notifications envoyées ou non.
4. **Adaptateurs sortants** (`<module>/adapter/`) : `EnMemoireXRepository` (profil par défaut) et
   `JpaXRepository` + `XEntity` + `XJpa` (profil `postgres`). Ajouter l'entité au test d'intégration si elle a des
   requêtes non triviales.
5. **Liquibase** : `src/main/resources/db/changelog/0NN-<sujet>.yaml` (table, index, contraintes d'unicité) et
   l'`include` dans `db.changelog-master.yaml`. `ddl-auto: validate` échoue si l'entité et le schéma divergent.
6. **Contrôleur** (`<module>/adapter/XController.java`) : `@RestController`, `@PreAuthorize` sur chaque méthode,
   corps `record` avec `@NotNull`, vue `record` **sans donnée personnelle superflue**, sujet du jeton par
   `jwt.getSubject()`. Nouveau chemin public ou administrateur : `SecurityConfig`. Nouvelle exception :
   `GestionErreursApi`. Tests `@WebMvcTest` : 401 sans jeton, 403 pour les autres rôles, codes de succès et d'erreur.
7. **README** du dépôt (tableau des endpoints, section fonctionnelle) et **`docs/JOURNAL.md`** (nouvelle version).
8. **Commit** unique `feat(<scope>): ...` avec tout ce qui précède.

**Web**

1. Service HTTP (`src/app/<domaine>/<domaine>.service.ts`) : URL sur `config.apiUrl`, types des vues, libellés.
2. Composant standalone, formulaire avec validation côté client **identique aux règles du backend**, messages
   d'erreur lus dans `{ erreur }`, redirection vers la connexion si nécessaire, garde de rôle si l'espace est réservé.
3. Route dans `app.routes.ts`, lien dans la barre de navigation (`AppComponent`) selon le rôle.
4. Specs : service (`HttpTestingController`), composant (service factice), barre de navigation.
5. README, `docs/JOURNAL.md`, commit `feat(<scope>-web): ...`.

**Mobile** (si la fonctionnalité concerne les patients)

1. `ApiService` (méthode, identifiants en `String`, `ApiException`), modèle `fromJson` tolérant, utilitaires de
   libellés et de dates.
2. Page (`lib/pages/`), entrée sur l'accueil (`RecherchePage`), bouton « Se connecter » sans jeton, 401 = déconnexion.
3. Tests (`test/`), `FakeApiService` étendu.
4. README, `docs/JOURNAL.md`, commit `feat(<scope>-mobile): ...`.

**Ce dépôt** : si la fonctionnalité change l'architecture (nouveau module, nouvelle table, nouveau flux), mettre à
jour les diagrammes (`docs/diagrammes/src`), [ARCHITECTURE.md](ARCHITECTURE.md), [FONCTIONNALITES.md](FONCTIONNALITES.md)
et [JOURNAL.md](JOURNAL.md).

## 7. Conventions de commit

Format conventionnel, en français **sans accents dans le message** (portabilité des outils), un commit par
fonctionnalité, corps qui explique le *pourquoi* et liste les vérifications faites :

```
type(scope): description courte a l'infinitif ou au nom

Pourquoi ce changement, ce qu'il apporte, les regles metier ajoutees,
les fichiers ou modules touches, ce qui a ete verifie (mvn test, ng test, flutter test).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CCa1DaNUmAZsjfJadZhwzF
```

- **Types** : `feat` (fonctionnalité), `fix` (correctif), `docs`, `test`, `refactor`, `chore` (outillage), `build`
  (image, dépendances), `ci` (workflows).
- **Scopes** : le module ou l'écran (`rendezvous`, `teleconsultation`, `avis-web`, `dawini-mobile`, `keycloak`,
  `docker`, `securite`, `architecture`).
- **Trailers** : les deux lignes finales `Co-Authored-By` et `Claude-Session` sont ajoutées à l'identique quand le
  commit est produit avec l'assistant ; un commit écrit sans assistant ne les porte pas.
- Jamais de secret, de donnée personnelle ni de fichier généré (`target/`, `node_modules/`, `dist/`, `.env`,
  `infra/keycloak/production/`) dans un commit.

Le cycle complet (branche, pull request, CI verte, revue, squash) est décrit dans [../CONTRIBUTING.md](../CONTRIBUTING.md)
et illustré ci-dessous.

![Flux Git : quatre dépôts, branche principale protégée, cycle d'une fonctionnalité](images/flux-git.png)

## 8. Lire et tenir le journal

- Chaque dépôt de code a son `docs/JOURNAL.md` : une section `## vX.Y.0 — Titre` par fonctionnalité (correctif :
  `vX.Y.1`), avec les endpoints ou écrans ajoutés, les règles métier, les tests. La version correspond à un commit
  `feat(...)` ou `fix(...)` ; `git log --format='%h %ad %s' --date=short` donne le hash en face.
- Ce dépôt fusionne les trois journaux dans [JOURNAL.md](JOURNAL.md), par ordre chronologique, avec le dépôt, la
  version et le hash : c'est la vue « produit » de l'avancement.
- Quand on ajoute une fonctionnalité : nouvelle section dans le journal du dépôt concerné **dans le même commit**,
  puis une ligne dans le journal global de ce dépôt (commit `docs(journal): ...`).
- Les numéros de version des journaux sont ceux du produit ; `pom.xml` (0.1.0) et `package.json` (0.1.0) n'ont pas
  été incrémentés au fil des versions, seul `pubspec.yaml` (0.13.0+1) l'a été pour les stores.

## 9. Regénérer les diagrammes de ce dépôt

Les sources Mermaid sont dans `docs/diagrammes/src/*.mmd`, les images dans `docs/images/*.png` (et `.svg`).

```bash
npm install -g @mermaid-js/mermaid-cli
docs/diagrammes/generer.sh                 # tous les diagrammes
docs/diagrammes/generer.sh contexte        # un seul
# Chromium hors du chemin standard ou conteneur sans bac à sable :
PUPPETEER_CONFIG=/chemin/pupp.json docs/diagrammes/generer.sh
```

Règles pour les diagrammes : thème commun (en-tête `%%{init ...}%%` de chaque fichier), aucun emoji, un diagramme
par idée (couper plutôt que densifier), vérifier le PNG après génération, commiter la source et les images ensemble.
