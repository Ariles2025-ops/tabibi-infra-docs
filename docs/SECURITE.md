# Sécurité de Tabibi

> **Pourquoi ce document.** Tabibi manipule des données de santé. Ce document dit contre quoi on se protège (modèle
> de menace), ce qui est **réellement en place dans le code** (avec le nom des classes et des fichiers, pour que
> chacun puisse vérifier), comment Keycloak est durci, comment les secrets sont gérés, et ce qu'il reste à faire
> avant d'ouvrir la production. Il complète la section « Sécurité » de [ARCHITECTURE.md](ARCHITECTURE.md).

## Sommaire

1. [Modèle de menace](#1-modèle-de-menace)
2. [Mesures en place](#2-mesures-en-place)
3. [Durcissement de Keycloak](#3-durcissement-de-keycloak)
4. [Gestion des secrets](#4-gestion-des-secrets)
5. [Ce qu'il reste à faire avant la production](#5-ce-quil-reste-à-faire-avant-la-production)

## 1. Modèle de menace

**Ce que l'on protège (actifs).**
- Les données de santé et personnelles des patients : rendez-vous, ordonnances (médicaments, posologies), messages
  échangés avec un médecin, avis, besoins de médicaments, profils (nom, téléphone, date de naissance).
- Les identités (comptes Keycloak, mots de passe, facteurs MFA) et les jetons.
- L'intégrité de l'annuaire (un médecin publié est un médecin validé par l'administrateur avec un numéro d'ordre).
- La disponibilité du service (un cabinet qui ne peut plus lire son agenda).

**Qui peut attaquer, et comment.**

| Attaquant | Scénarios | Réponse principale |
|---|---|---|
| Internet (inconnu) | force brute sur la connexion, vol de mots de passe, injection, exploitation d'un port ouvert, écoute réseau | Keycloak durci (verrouillage, politique de mots de passe, MFA), TLS partout, seuls 80 et 443 exposés, requêtes paramétrées (JPA), validation des entrées |
| Utilisateur authentifié curieux (patient A) | lire les rendez-vous, ordonnances ou messages du patient B en devinant un identifiant | règle de propriétaire dans chaque cas d'usage (403), identifiants UUID non devinables |
| Pharmacie | identifier le patient derrière un besoin Dawini, lire des données de santé | `patientId` jamais exposé aux pharmacies, réponses sans détail dans les notifications |
| Faux médecin | apparaître dans l'annuaire, rédiger des ordonnances | candidature validée par l'administrateur (numéro d'ordre exigé), rôle MEDECIN attribué dans Keycloak |
| Secrétaire d'un autre cabinet | agir sur l'agenda d'un médecin qui ne l'a pas rattachée | rattachement vérifié à chaque action (`CabinetService.verifierAcces`) |
| Site tiers malveillant (navigateur de la victime) | appels vers l'API avec le jeton de la victime (CSRF), injection de script (XSS) | API sans cookie (jeton en en-tête, `credentials: false`), CORS restreint, CSP et en-têtes de sécurité du serveur web, Angular échappe le HTML |
| Compromission du serveur ou d'une sauvegarde | lecture de la base, des dumps | secrets hors du dépôt, sauvegardes en `chmod 700` et copie chiffrée hors site (à mettre en place), chiffrement au repos (à faire) |
| Administrateur de la plateforme | accès légitime mais très large | rôle ADMIN séparé, MFA à imposer, journal des accès, aucune donnée de santé dans les écrans d'administration (les avis signalés montrent des identifiants, pas des dossiers) |
| Exploitation (journaux, supervision) | données de santé qui fuient dans les logs | jamais de corps de requête ni de contenu de message dans les journaux ; IP tronquée |

## 2. Mesures en place

Tout ce qui suit existe dans le code au 19 septembre 2026.

### Identité et jetons (Keycloak, `infra/keycloak/tabibi-realm.json`)

- OIDC **Authorization Code + PKCE S256** pour les deux clients publics (`tabibi-web`, `tabibi-mobile`) ; flux
  implicite désactivé ; aucun secret client (rien à voler dans un navigateur ou une application mobile).
- Redirections et origines **explicites** (`http://localhost:4200/*`, `https://tabibi.example/*`,
  `dz.tabibi.app:/oauthredirect`), jamais `*`.
- Jeton d'accès de **5 minutes**, session inactive close après **30 minutes**, 10 heures au plus, pas de « se
  souvenir de moi », `sslRequired: external`.
- **Force brute** : 5 échecs, attente croissante de 60 s jusqu'à 15 min, jamais de verrouillage permanent.
- **Mots de passe** : 10 caractères minimum, chiffre, minuscule, majuscule, différent du nom d'utilisateur.
- **MFA TOTP** disponible pour tout utilisateur (6 chiffres, 30 s).
- Les comptes de démonstration sont importés **hachés** (PBKDF2-SHA512, 210 000 itérations), jamais en clair, et
  **retirés du realm de production** par `infra/keycloak/realm-production.py`, qui désactive aussi le flux « mot de
  passe direct » et remplace le domaine d'exemple.
- `RealmKeycloakTest` (backend) vérifie chacun de ces réglages à chaque `mvn test`.

### API (`tabibi-backend`)

- **Resource server JWT** (`SecurityConfig`) : signature vérifiée avec les clés du realm (JWKS, lues sur le réseau
  interne en production), issuer attendu `TABIBI_KEYCLOAK_ISSUER`, sessions `STATELESS`, CSRF désactivé parce
  qu'aucun cookie n'est utilisé.
- **Rôles** : `KeycloakRoleConverter` traduit `realm_access.roles` en `ROLE_*` ; `@EnableMethodSecurity` et un
  `@PreAuthorize` sur **chaque** endpoint protégé ; `/api/admin/**` verrouillé au rôle ADMIN par chemin en plus
  (défense en profondeur) ; seuls `GET /api/medecins/**`, `GET /api/ordonnances/verifier/**`,
  `/actuator/health/**` et Swagger sont publics.
- **Règle de propriétaire** dans les cas d'usage : `RendezVous.appartientA`, `RendezVous.estAvec`,
  `Ordonnance.estAccessiblePar`, `Teleconsultation.peutAccederALaSalle`, `Conversation.participe`, `Avis.estDe` /
  `concerne`, `BesoinMedicament.estDe`, `Rattachement.concerneMedecin` ; `AccesRefuseException` devient 403.
- **Transitions d'état contrôlées** dans les entités (409 `TransitionInvalideException`) : on ne peut pas honorer
  un rendez-vous annulé, démarrer une téléconsultation sans consentement, répondre deux fois à un besoin, etc.
- **Validation des entrées** : `@NotNull` sur les corps, règles de longueur et de format dans le domaine
  (message 2000, commentaire 500, téléphone algérien, date de naissance passée, wilaya 4, note 1 à 5).
- **CORS** (`CorsProprietes`) : origines de `TABIBI_CORS_ORIGINES` seulement, sur `/api/**`, méthodes
  GET / POST / PUT / DELETE / OPTIONS, en-têtes `Authorization` et `Content-Type`, `credentials: false`.
- **Consentement explicite** : `Teleconsultation.consentir` daté ; `TeleconsultationService.lienSalle` renvoie
  `null` au patient tant qu'il n'a pas consenti ; le médecin ne peut pas démarrer sans.
- **Salles vidéo non devinables** : `GenerateurSalle` (128 bits de `SecureRandom`) ; **codes d'ordonnance**
  `CodeVerification` (8 caractères `SecureRandom`, alphabet sans O / 0 / I / 1, unicité vérifiée).
- **Anonymisation des vues publiques** : `SyntheseAvis` et `AvisPublicVue` sans `patientId` ni `rendezVousId` ;
  `BesoinVue` sans `patientId` pour les pharmacies ; `ResultatVerification` sans aucune donnée personnelle ; le code
  saisi n'est pas répété dans le message d'erreur.
- **Aucune donnée de santé dans les notifications** : « Nouveau message » sans le contenu, « Réponse d'une
  pharmacie » sans détail ; `NotifieurInterne` ne journalise que l'identifiant, le destinataire et le sujet.
- **Journal des accès** (`FiltreAudit`, `EntreeAudit`, table `journal_acces`) : sujet, méthode, chemin sans
  paramètres, statut, IP **tronquée** (`AdresseIp` : dernier octet IPv4, 64 bits IPv6), horodatage, durée ; jamais
  le corps ; échec d'écriture jamais bloquant ; consultable par `GET /api/admin/audit`.
- **En-têtes de proxy** : `server.forward-headers-strategy=native` sous le profil `postgres` pour lire l'adresse du
  client posée par Caddy (proxys internes seulement).
- **Erreurs uniformes** : `GestionErreursApi`, jamais de trace de pile renvoyée au client.
- **Supervision minimale** : `/actuator/health` (+ liveness / readiness) sans détail ; le reste d'Actuator est
  protégé, seuls `health` et `info` sont exposés.

### Front web (`tabibi-web`)

- Jeton en mémoire de l'application, ajouté par `authInterceptor` sur les seuls appels contenant `/api/` ;
  pas de cookie de session applicatif.
- `requireHttps` dès que l'issuer est en `https://` (`creerAuthConfig`).
- Gardes de rôle (`medecinGuard`, `adminGuard`, `pharmacieGuard`, `secretaireGuard`) : confort d'interface,
  l'autorisation réelle reste côté API.
- Serveur express (`server.ts`, image `node:20-alpine`, utilisateur `node`) : `Content-Security-Policy`
  (`default-src 'self'`, `connect-src` limité à l'API et Keycloak, `frame-ancestors 'none'`, `object-src 'none'`,
  `script-src 'self'` : aucun script inline, l'état de transfert SSR est un `<script type="application/json">` non
  exécutable), `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy
  strict-origin-when-cross-origin`, `Permissions-Policy camera=(), microphone=(), geolocation=()`, `X-Powered-By`
  retiré, `trust proxy`, `index.csr.html` et `config.json` jamais mis en cache ; hors navigateur, l'OIDC n'est
  jamais configuré et aucune page privée ne rend de donnée.
- Identifiants de patients abrégés à l'écran des médecins et secrétaires (huit caractères), jamais d'UUID complet
  affiché comme donnée de patient.

### Application mobile (`tabibi-mobile`)

- Connexion par le navigateur système (AppAuth) et PKCE ; aucun secret dans l'application ; schéma de redirection
  propre `dz.tabibi.app`.
- Adresses fournies à la compilation (`--dart-define`) ; les valeurs `http://` par défaut ne servent qu'à
  l'émulateur.
- Le lien de téléconsultation n'est ouvert que s'il est en `http(s)` et si la session est planifiée ou en cours.
- Fiche store : politique de confidentialité et déclarations de collecte limitées au nécessaire (documentées dans le
  README du dépôt).

### Infrastructure (`docker-compose.prod.yml`, `infra/`)

- **TLS partout** (Caddy, Let's Encrypt), HSTS un an avec sous-domaines, `nosniff`, `Referrer-Policy`, en-tête
  `Server` retiré.
- **Seuls 80 et 443 exposés** ; PostgreSQL, Keycloak et l'API ne sont joignables que sur le réseau interne
  `interne` ; le port de gestion de Keycloak (9000) n'est pas routé.
- **Keycloak en mode `start`** (production) derrière le proxy (`KC_PROXY_HEADERS=xforwarded`,
  `KC_HOSTNAME=https://auth.DOMAINE`), avec une **base dédiée** `keycloak` et un rôle PostgreSQL séparé
  (`infra/postgres/init/01-keycloak.sh`) : les identités et les données de patients ne partagent pas un schéma.
- **Images** : utilisateur sans privilège `tabibi` dans l'image de l'API, JRE minimal Alpine, `HEALTHCHECK`,
  contexte de construction réduit (`.dockerignore`), tags `sha-<commit>` pour un déploiement reproductible.
- **Sauvegardes** : `infra/sauvegarde/pg_dump.sh` (format custom compressé, répertoire `chmod 700`, rotation 14
  jours) ; consigne de copie chiffrée hors du serveur.
- **Mises à jour** : Dependabot hebdomadaire (Maven, npm, GitHub Actions, images Docker) sur les trois dépôts.

## 3. Durcissement de Keycloak

Ce qui est déjà dans le realm est listé plus haut. Pour passer en production :

1. **Générer le realm de production** : `infra/keycloak/realm-production.py <domaine>` (dans `tabibi-backend`) ;
   il retire les cinq comptes de démonstration, met `directAccessGrantsEnabled` à `false` sur tous les clients,
   remplace `tabibi.example` par le domaine réel et retire les adresses `localhost`. Le résultat
   (`infra/keycloak/production/tabibi-realm.json`, ignoré par git) est ce que monte `docker-compose.prod.yml`.
2. **Administrateur** : `KC_BOOTSTRAP_ADMIN_*` crée un compte temporaire ; créer un administrateur permanent
   (avec MFA), puis supprimer le compte de démarrage.
3. **Imposer la MFA aux rôles ADMIN et MEDECIN** : console d'administration, *Authentication > Flows*, dupliquer
   le flux `browser`, dans « Browser - Conditional OTP » ajouter « Condition - user role » (ADMIN, puis MEDECIN) et
   passer « OTP Form » à *Required*, puis *Bind flow* sur le flux navigateur. À la prochaine connexion, l'utilisateur
   reçoit l'action requise « Configure OTP ».
4. **Vérifier après import** que les comptes de démonstration n'existent pas (*Users*) ; sinon les supprimer
   (`kcadm.sh delete users/<id> -r tabibi`).
5. **Le realm n'est importé qu'au premier démarrage** (base vide) : ensuite, les réglages se changent dans la
   console et doivent être reportés dans `tabibi-realm.json` du dépôt (source unique versionnée) pour rester
   reproductibles.
6. Ce dépôt garde une **copie du realm** (`infra/keycloak/tabibi-realm.json`) identique à celle du backend ; le
   backend reste la source de vérité (testée par `RealmKeycloakTest`).

## 4. Gestion des secrets

| Secret | Où il vit | Règle |
|---|---|---|
| Mots de passe PostgreSQL (`POSTGRES_PASSWORD`, `KEYCLOAK_DB_PASSWORD`) et administrateur Keycloak | `.env` du serveur, à côté de `docker-compose.prod.yml` | jamais commité (`.gitignore`), généré par `openssl rand -base64 32`, lisible par root seulement (`chmod 600`) |
| Clés de signature des jetons | base `keycloak` (générées par Keycloak) | sauvegardées avec la base ; jamais exportées |
| Jetons d'accès des utilisateurs | mémoire du navigateur / de l'application | 5 minutes de validité ; jamais journalisés |
| Comptes de démonstration | realm de développement seulement | ne doivent **jamais** exister en production |
| Jeton GHCR côté CI | `GITHUB_TOKEN` automatique du workflow (`packages: write`) | aucun secret à créer |
| Jeton GHCR côté serveur (si le paquet est privé) | `docker login ghcr.io` avec un jeton `read:packages` | portée minimale, révocable |
| Clé de signature Android (`tabibi-release.jks`, `key.properties`) | hors du dépôt (`.gitignore`) | sauvegardée en lieu sûr ; perte = impossibilité de mettre à jour l'application |
| Certificats TLS | volume `caddy-data` | renouvelés automatiquement |
| Sauvegardes (`/var/backups/tabibi`) | serveur, `chmod 700` | copie chiffrée hors site |

Règles : aucun secret dans le code, les images, les journaux, les messages de commit ou la documentation ; les
fichiers d'exemple (`.env.example`) portent des valeurs vides ou fictives.

## 5. Ce qu'il reste à faire avant la production

Par ordre de priorité, avec une formulation volontairement prudente sur le droit (à valider avec un conseil).

1. **Conformité à la loi algérienne 18-07** (protection des données à caractère personnel) et, pour d'éventuels
   utilisateurs en Europe, au RGPD : recenser les traitements (registre), informer les patients (politique de
   confidentialité, finalités, durée de conservation), recueillir les consentements nécessaires (les données de santé
   sont sensibles), organiser les droits d'accès, de rectification et d'effacement, désigner un responsable,
   accomplir les formalités auprès de l'autorité compétente et **décider de la localisation des données** (hébergement
   en Algérie ou conditions d'un transfert). Rien de cela n'est codé aujourd'hui : il manque au minimum un endpoint
   d'export et d'effacement d'un compte, et une durée de conservation appliquée aux tables.
2. **Chiffrement au repos** : volume ou disque chiffré sur le VPS (LUKS ou option de l'hébergeur), sauvegardes
   chiffrées (`age` ou `gpg`) avant copie hors site, et réflexion sur un chiffrement applicatif du contenu des
   messages et des ordonnances (les colonnes `contenu` et `lignes_json` sont en clair en base).
3. **Sauvegardes testées** : planifier la commande cron de `pg_dump.sh`, **exécuter une restauration complète sur
   une machine vierge** au moins une fois avant l'ouverture puis régulièrement, mesurer le temps de reprise.
4. **MFA imposée** aux rôles ADMIN et MEDECIN (procédure ci-dessus), et recommandée aux secrétaires et pharmacies.
5. **Test d'intrusion** par un tiers (application web, API, Keycloak, serveur) et correction des constats ; en
   attendant, passer les images dans un scanner de vulnérabilités (Trivy ou équivalent) dans la CI.
6. **Durcissement du serveur** : accès SSH par clé seulement, pare-feu (seuls 22, 80, 443), mises à jour
   automatiques de sécurité, `fail2ban` sur SSH, supervision et alertes (espace disque, `/actuator/health`,
   expiration des certificats), journaux centralisés sans donnée de santé.
7. **Limitation de débit** sur les endpoints publics (annuaire, vérification d'ordonnance) et sur Keycloak,
   au niveau de Caddy ou d'un pare-feu applicatif.
8. **Rétention du journal des accès** : la table `journal_acces` n'est jamais purgée ; ajouter une suppression
   périodique (par exemple au-delà d'un an) et une politique d'accès à ce journal.
9. **Mobile** : stocker le jeton dans `flutter_secure_storage` (dépendance présente, non utilisée : le jeton est
   aujourd'hui gardé en mémoire), gérer le rafraîchissement du jeton, signer les versions release à partir de secrets
   GitHub, fournir la politique de confidentialité aux stores.
10. **Compose de production** : transmettre `DOMAINE` (ou les variables `TABIBI_*`) au service `web` pour que
    l'image écrive la bonne configuration et la bonne CSP (navigateur et rendu serveur) ; sans cela, le front
    retombe sur les adresses localhost.
11. **Instance Jitsi dédiée** (`TABIBI_TELECONSULTATION_BASE_URL`) pour ne pas faire transiter les
    téléconsultations par l'instance publique, et information claire des patients sur le tiers utilisé.
12. **Séparation des environnements** : une recette isolée (`.env` distinct, realm distinct) avant toute mise en
    production, et un processus de revue des changements de configuration Keycloak.
