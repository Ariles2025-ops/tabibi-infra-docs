# Journal global des fonctionnalités

> **Pourquoi ce document.** Chaque dépôt de code tient son propre `docs/JOURNAL.md` (une section par version) ;
> ce journal-ci les fusionne en une seule chronologie, avec le dépôt, la version, le hash du commit et un résumé,
> pour voir d'un coup d'oeil comment le produit a été construit et retrouver le commit d'une fonctionnalité. Le
> détail (règles métier, endpoints, tests) reste dans le journal du dépôt concerné. Ordre chronologique des commits
> (dates UTC), état au 19 septembre 2026 : backend 23 commits (v0.22.0), web 20 commits (v0.19.0), mobile 14 commits
> (v0.13.0), infra-docs.

## Comment lire

- **Dépôt** : `backend` (`tabibi-backend`), `web` (`tabibi-web`), `mobile` (`tabibi-mobile`), `infra` (ce dépôt).
- **Version** : celle du journal du dépôt (`vX.Y.0` fonctionnalité, `vX.Y.1` correctif) ; `git show <hash>` donne
  le commit complet, avec son corps qui liste les vérifications.
- Les trois dépôts avancent **en parallèle sur la même fonctionnalité** : d'abord l'API, puis l'écran web, puis
  l'écran mobile quand le patient est concerné.

## 18 septembre 2026 : socle, annuaire, rendez-vous, ordonnances, espace médecin

| Date | Dépôt | Version | Commit | Résumé |
|---|---|---|---|---|
| 2026-09-18 | backend | v0.1.0 | `8cf3134` | Socle : API sécurisée JWT / Keycloak (rôles PATIENT, MEDECIN, SECRETAIRE, ADMIN), réservation d'un rendez-vous sur horaire libre, adaptateur en mémoire, tests unitaires et de sécurité, docker-compose (PostgreSQL + Keycloak), CI GitHub Actions |
| 2026-09-18 | backend | v0.2.0 | `61d07fd` | Persistance : adaptateur JPA / PostgreSQL derrière `RendezVousRepository` (profil `postgres`), Liquibase 001 (`utilisateur`, `rendez_vous`), test d'intégration Testcontainers |
| 2026-09-18 | web | v0.1.0 | `c86810d` | Socle Angular 18 standalone, connexion Keycloak (angular-oauth2-oidc, client `tabibi-web`), intercepteur JWT, écran `/api/moi` |
| 2026-09-18 | mobile | v0.1.0 | `053f2de` | Socle Flutter (iOS + Android), connexion Keycloak native (flutter_appauth), appel `/api/moi`, thème Tabibi Material 3 |
| 2026-09-18 | infra | — | `137d4d0` | Dépôt infra-docs : architecture cible (HTML), docker-compose de dev, realm Keycloak, workflow Git |
| 2026-09-18 | backend | v0.3.0 | `5e3ae9a` | Annuaire : recherche publique de praticiens `GET /api/medecins?specialite=&wilaya=&q=` sans jeton, adaptateurs mémoire (seed) et JPA, Liquibase 002 |
| 2026-09-18 | web | v0.2.0 | `d54e169` | Annuaire : écran d'accueil public de recherche (spécialité, wilaya, nom) ; `/moi` |
| 2026-09-18 | mobile | v0.2.0 | `8bd6b73` | Annuaire : écran d'accueil de recherche (nom, spécialité) |
| 2026-09-18 | web | v0.3.0 | `6ebf00b` | Réservation : fiche du praticien et créneaux, bouton « Réserver » (409 « créneau pris »), `/mes-rendez-vous` avec annulation, `AuthService` (initialisation OIDC unique), dates en français |
| 2026-09-18 | backend | v0.4.0 | `252ad14` | Créneaux : fiche `GET /api/medecins/{id}` et créneaux disponibles `GET /api/medecins/{id}/creneaux`, module `creneaux`, Liquibase 003 |
| 2026-09-18 | backend | v0.5.0 | `ad63b7b` | Gestion des rendez-vous : `POST /api/creneaux/{id}/reserver`, `GET /api/rendezvous/mes`, `POST /api/rendezvous/{id}/annuler` (créneau remis à disposition), `GestionErreursApi` (`{ erreur }`, 403 / 404 / 409), Liquibase 004 |
| 2026-09-18 | mobile | v0.3.0 | `c970f87` | Réservation : fiche médecin et créneaux, réservation avec connexion à la volée, « Mes rendez-vous » avec annulation, session partagée, `ApiException`, `FakeApiService` pour les tests |
| 2026-09-18 | backend | v0.5.1 | `1fa03d9` | Correctif : l'API démarre sans base hors profil `postgres` (auto-configuration JPA / Liquibase exclue) |
| 2026-09-18 | web | v0.4.0 | `167e6b5` | Ordonnances : `/mes-ordonnances`, `/ordonnances/:id` (détail, impression), `/verifier` (vérification publique) |
| 2026-09-18 | backend | v0.6.0 | `65abf35` | Ordonnances : rédaction par le médecin (`POST /api/ordonnances`), `GET /api/ordonnances/mes`, détail patient ou médecin auteur, vérification publique par code de 8 caractères sans donnée personnelle, Liquibase 005 |
| 2026-09-18 | mobile | v0.4.0 | `0f6c3ba` | Ordonnances : « Mes ordonnances », détail (code de vérification à copier, lignes), vérification publique d'un code |
| 2026-09-18 | web | v0.5.0 | `cb9dda4` | Espace médecin : `RoleService`, `medecinGuard`, agenda (honorer, rédiger une ordonnance), disponibilités (ouvrir un créneau), formulaire d'ordonnance à lignes dynamiques, ordonnances rédigées |
| 2026-09-18 | backend | v0.7.0 | `53a65ee` | Espace médecin : agenda `GET /api/medecin/rendezvous`, `POST /api/rendezvous/{id}/honorer` (`TransitionInvalide` 409), ouverture de créneau `POST /api/medecin/creneaux` (futur, 5 à 120 min), `GET /api/medecin/ordonnances` |
| 2026-09-18 | backend | v0.8.0 | `1bd2d65` | Notifications : boîte de réception (`/api/notifications/*`), port `Notifieur` et `NotifieurInterne`, branchement sur la réservation et l'annulation, `FormatDate` (heure d'Algérie), Liquibase 007 |
| 2026-09-18 | backend | v0.9.0 | `7efc917` | Téléconsultation : salles Jitsi Meet non devinables, consentement explicite du patient avant remise du lien, planifier / consentir / démarrer / terminer / annuler, Liquibase 006 |
| 2026-09-18 | backend | v0.10.0 | `6ade583` | Administration : candidature du médecin, validation (publication dans l'annuaire) ou refus motivé par l'administrateur, statistiques, verrou `/api/admin/**`, comptes de démonstration Keycloak, Liquibase 008 |
| 2026-09-18 | mobile | v0.5.0 | `4f1d143` | Notifications : « Mes notifications » (marquer lue, tout marquer lu, tirer pour rafraîchir), entrée « Notifications (n) » sur l'accueil |
| 2026-09-18 | mobile | v0.6.0 | `cef96cb` | Téléconsultation : « Mes téléconsultations », carte de consentement, « Rejoindre » dans le navigateur externe (url_launcher) |
| 2026-09-18 | web | v0.6.0 | `312b010` | Notifications : cloche dans la barre de navigation (compteur relu toutes les 60 s), `/notifications` ; infrastructure de test Karma / Jasmine et workflow CI |

## 19 septembre 2026 : téléconsultation web, administration, messagerie, avis, Dawini

| Date | Dépôt | Version | Commit | Résumé |
|---|---|---|---|---|
| 2026-09-19 | web | v0.7.0 | `61fe225` | Téléconsultation : consentement du patient et lien de salle (`/teleconsultations`), pilotage par le médecin (proposer depuis l'agenda, démarrer, terminer, annuler) |
| 2026-09-19 | backend | v0.11.0 | `1ddc48a` | Messagerie : conversation patient-médecin après un rendez-vous commun, messages (2000 caractères), lecture qui marque lu, notification sans le contenu, Liquibase 009 |
| 2026-09-19 | mobile | v0.7.0 | `47c7539` | Messagerie : liste des conversations, fil avec bulles, envoi, ouverture depuis la fiche du médecin, sujet du jeton |
| 2026-09-19 | web | v0.8.0 | `6ca7b2b` | Administration : `adminGuard`, tableau de bord `/admin`, examen des candidatures (valider, refuser avec motif), candidature du médecin `/medecin/candidature` |
| 2026-09-19 | backend | v0.12.0 | `e9e96f2` | Avis : avis vérifié sur un rendez-vous honoré (un seul), synthèse publique anonymisée `GET /api/medecins/{id}/avis`, signalement par le médecin, modération (masquer, rétablir), Liquibase 010 |
| 2026-09-19 | mobile | v0.8.0 | `35453ee` | Avis : « Donner mon avis » depuis un rendez-vous honoré, « Mes avis », moyenne et derniers avis sur la fiche |
| 2026-09-19 | backend | v0.13.0 | `1f23e39` | Dawini : rôle PHARMACIE, besoins de médicaments des patients par wilaya (sans identité pour les pharmacies), réponses des pharmacies (une par besoin), clôture, notification au patient, Liquibase 011 |
| 2026-09-19 | mobile | v0.9.0 | `a7078c2` | Dawini : demander un médicament, mes demandes, réponses des pharmacies, clôture |
| 2026-09-19 | backend | v0.14.0 | `5e82ed1` | Profil : `GET` / `PUT /api/moi/profil` (nom, téléphone algérien, date de naissance, wilaya, langue fr / ar / kab / en), Liquibase 012 |
| 2026-09-19 | web | v0.9.0 | `852199c` | Messagerie : `/messagerie` (non lus), fil `/messagerie/:id` relu toutes les 30 s, « Écrire au médecin » sur la fiche |
| 2026-09-19 | mobile | v0.9.1 | `341fc5c` | Correctif : identifiants UUID traités comme des chaînes sur toute l'application (fiches, créneaux, noms de praticiens) |
| 2026-09-19 | backend | v0.15.0 | `4eccf80` | Liste d'attente : inscription par médecin, mes inscriptions, retrait, liste du médecin ; port `AlerteCreneau` : chaque inscrit est prévenu quand un créneau s'ouvre ou se libère ; Liquibase 013 |
| 2026-09-19 | web | v0.10.0 | `ad6b213` | Avis : dépôt (`/avis/nouveau/:rendezVousId`), « Mes avis », synthèse publique sur la fiche, avis reçus et signalement (`/medecin/avis`), modération (`/admin/avis`) |
| 2026-09-19 | backend | v0.16.0 | `9e9f6d0` | Cabinet : secrétaires rattachées à un médecin (rattacher, lister, retirer), espace secrétaire (agenda, créneaux, honorer, annuler pour le médecin), annulation d'un rendez-vous par le médecin, compte `secretaire.demo`, Liquibase 014 |
| 2026-09-19 | web | v0.11.0 | `49cd6ec` | Dawini : `/dawini` (demandes et réponses), `/dawini/:id`, espace pharmacie `/pharmacie` (`pharmacieGuard`, nom de pharmacie mémorisé) |
| 2026-09-19 | backend | v0.17.0 | `a860191` | Rappels : rappel de rendez-vous 24 h avant, une seule fois (`rappel_envoye_le`, Liquibase 015), planificateur horaire, horloge injectée, déclenchement manuel par l'administrateur |
| 2026-09-19 | web | v0.12.0 | `9417001` | Configuration à l'exécution : `ConfigService` et `assets/config.json` (API, Keycloak) chargés par `APP_INITIALIZER`, `<base href>`, plus aucune origine codée en dur |
| 2026-09-19 | mobile | v0.10.0 | `6f5d39a` | Configuration par environnement : `Configuration` (`--dart-define` : API, issuer, client, redirection), valeurs par défaut de l'émulateur Android |
| 2026-09-19 | web | v0.13.0 | `b427a4d` | Mon profil : `/moi/profil` avec validation côté client identique au backend |
| 2026-09-19 | web | v0.14.0 | `b745b21` | Liste d'attente : inscription depuis la fiche, `/liste-attente`, `/medecin/liste-attente` |
| 2026-09-19 | mobile | v0.11.0 | `8fc3667` | Mon profil : formulaire (nom, téléphone, date de naissance, wilaya, langue) |
| 2026-09-19 | backend | v0.18.0 | `acca60a` | Sécurité : CORS configurable (`TABIBI_CORS_ORIGINES`, `CorsProprietes`) sur `/api/**`, sans cookies |
| 2026-09-19 | mobile | v0.12.0 | `9f3cc3c` | Liste d'attente : inscription depuis la fiche, « Mes listes d'attente » avec retrait |
| 2026-09-19 | web | v0.15.0 | `11d34ef` | Cabinet : `/medecin/secretaires` (rattacher, retirer), annulation par le médecin dans l'agenda, espace secrétaire `/secretaire` (`secretaireGuard`), identifiant de compte à copier dans « Mon compte » |
| 2026-09-19 | web | v0.16.0 | `bccea88` | Administration : bouton « Exécuter les rappels maintenant » sur `/admin` |
| 2026-09-19 | mobile | v0.13.0 | `40bc155` | Intégration continue GitHub Actions (analyse, tests, APK de débogage), `tool/preparer_android.sh`, préparation des stores (signature, `dz.tabibi.app`, fiches), `.gitignore` des clés |
| 2026-09-19 | backend | v0.19.0 | `e412bae` | Journal des accès : `FiltreAudit` (sujet, méthode, chemin, statut, IP tronquée, durée ; jamais le corps), consultation par l'administrateur, Liquibase 016 |
| 2026-09-19 | backend | v0.20.0 | `3e8c786` | Image de production (Dockerfile multi-étapes, utilisateur sans privilège, healthcheck) et orchestration complète `docker-compose.prod.yml` (PostgreSQL, Keycloak, API, web, Caddy TLS), `.env.example`, script de sauvegarde `pg_dump.sh`, sondes liveness / readiness |
| 2026-09-19 | backend | v0.21.0 | `1de20fb` | CI : publication de l'image sur GHCR (`latest`, `sha-<commit>`) après `mvn verify`, Dependabot |
| 2026-09-19 | backend | v0.22.0 | `ae58723` | Durcissement du realm Keycloak : force brute, politique de mots de passe, OTP, durées de jeton et de session, PKCE, client `tabibi-mobile`, comptes de démonstration hachés, `realm-production.py`, `RealmKeycloakTest` |
| 2026-09-19 | web | v0.16.1 | `af6f5e8` | Correctif : durée maximale d'un créneau alignée sur l'API (5 à 120 minutes) dans `/medecin/disponibilites` |
| 2026-09-19 | web | v0.17.0 | `92bcfa7` | Image Docker : nginx avec `assets/config.json` et CSP générés au démarrage (`TABIBI_*` ou `DOMAINE`), cache immuable des bundles, en-têtes de sécurité, `outputHashing` |
| 2026-09-19 | web | v0.18.0 | `40410ff` | CI : publication de l'image `ghcr.io/<org>/tabibi-web` (`latest`, `sha-<commit>`) après `build-test`, Dependabot |
| 2026-09-19 | web | v0.19.0 | `fea168b` | Rendu côté serveur des pages publiques (`@angular/ssr`, `server.ts` express avec secours sans rendu, hydratation et cache de transfert), garde-fous hors navigateur, image `node:20-alpine` à la place de nginx, 271 specs |
| 2026-09-19 | infra | — | (ce dépôt) | Documentation complète : architecture avec diagrammes, choix techniques, sécurité, déploiement, guide du développeur, fonctionnalités, journal global, realm à jour |

## Ce que dit ce journal

- **57 commits** de fonctionnalités en deux jours : 23 backend, 20 web, 14 mobile, plus ce dépôt.
- Chaque fonctionnalité a été livrée **API d'abord**, puis web, puis mobile pour le patient, avec ses tests et
  son entrée de journal : la trace est complète du besoin au commit.
- Les derniers commits du backend et du web sont consacrés à la **mise en production** (images, orchestration,
  registre, durcissement, rendu côté serveur) ; le mobile est prêt pour les stores (CI, signature documentée).
