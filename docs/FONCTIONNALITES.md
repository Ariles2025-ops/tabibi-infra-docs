# Fonctionnalités par acteur

> **Pourquoi ce document.** C'est la carte fonctionnelle de Tabibi, acteur par acteur : pour chaque fonctionnalité,
> où elle se trouve (endpoints du backend, route du front web, écran de l'application mobile) et son statut. Elle
> permet de répondre vite à « est-ce que le patient peut déjà faire ceci ? » et « où est le code ? ». La
> description technique des endpoints est dans [ARCHITECTURE.md](ARCHITECTURE.md), l'historique dans
> [JOURNAL.md](JOURNAL.md).

Statuts : **Fait** (backend, web et mobile quand le mobile est concerné), **Web seulement** (l'application mobile
est réservée aux patients), **API seulement** (aucun écran ne l'expose encore), **À faire**.

## Sans compte (public)

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Rechercher un praticien par spécialité, wilaya, nom | `GET /api/medecins?specialite=&wilaya=&q=` | `/` (annuaire, rendu côté serveur) | `RecherchePage` (nom, spécialité ; pas encore de filtre wilaya) | Fait |
| Consulter la fiche d'un praticien et ses créneaux disponibles | `GET /api/medecins/{id}`, `GET /api/medecins/{id}/creneaux` | `/medecins/:id` | `FicheMedecinPage` | Fait |
| Voir la moyenne et les derniers avis (anonymes) d'un praticien | `GET /api/medecins/{id}/avis` | `/medecins/:id` (`app-synthese-avis`) | `FicheMedecinPage` | Fait |
| Vérifier l'authenticité d'une ordonnance par son code (pharmacien) | `GET /api/ordonnances/verifier/{code}` | `/verifier` (accepte `?code=`) | `VerifierOrdonnancePage` | Fait |
| Se connecter / créer un compte | Keycloak (OIDC + PKCE) | bouton « Se connecter » | icône de connexion | Fait pour la connexion ; l'auto-inscription des patients est un réglage Keycloak à activer (voir DEPLOIEMENT.md) |

## Patient

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Réserver un créneau de l'agenda d'un médecin (409 si pris entre-temps) | `POST /api/creneaux/{id}/reserver` | `/medecins/:id` | `FicheMedecinPage` | Fait |
| Réserver un horaire libre hors agenda | `POST /api/rendezvous` | aucun écran | aucun écran | API seulement (socle v0.1.0) |
| Voir mes rendez-vous, annuler (le créneau est remis à disposition) | `GET /api/rendezvous/mes`, `POST /api/rendezvous/{id}/annuler` | `/mes-rendez-vous` | `MesRendezVousPage` | Fait |
| Être prévenu : rendez-vous confirmé, annulé par le cabinet, rappel la veille, créneau disponible, message, réponse de pharmacie, téléconsultation | `Notifieur` (canal interne) | cloche + `/notifications` | `MesNotificationsPage`, compteur sur l'accueil | Fait (canal interne) ; SMS et e-mail à faire |
| Lire mes notifications, marquer lue, tout marquer lu | `GET /api/notifications/mes`, `GET .../non-lues/nombre`, `POST .../{id}/lue`, `POST .../toutes-lues` | `/notifications` | `MesNotificationsPage` | Fait |
| Mes ordonnances, détail (médicaments, posologie, durée), code de vérification | `GET /api/ordonnances/mes`, `GET /api/ordonnances/{id}` | `/mes-ordonnances`, `/ordonnances/:id` (impression) | `MesOrdonnancesPage`, `DetailOrdonnancePage` (copier le code) | Fait |
| Télécharger l'ordonnance en PDF (QR code vers la vérification publique) | `GET /api/ordonnances/{id}/pdf` (backend v0.23.0) | pas encore de bouton | pas encore | API seulement |
| Téléconsultation : donner mon consentement puis rejoindre la salle vidéo | `GET /api/teleconsultations/mes`, `GET /api/teleconsultations/{id}`, `POST /api/teleconsultations/{id}/consentir` | `/teleconsultations` | `MesTeleconsultationsPage` (navigateur externe) | Fait |
| Écrire à un médecin déjà consulté, lire et envoyer des messages | `POST /api/conversations`, `GET /api/conversations`, `GET /api/conversations/{id}/messages`, `POST /api/conversations/{id}/messages` | `/medecins/:id` (« Écrire au médecin »), `/messagerie`, `/messagerie/:id` | `FicheMedecinPage`, `MesConversationsPage`, `ConversationPage` | Fait |
| Donner mon avis (note 1 à 5, commentaire) après un rendez-vous honoré ; voir mes avis | `POST /api/avis`, `GET /api/avis/mes` | `/mes-rendez-vous` (« Donner mon avis »), `/avis/nouveau/:rendezVousId`, `/mes-avis` | `MesRendezVousPage`, `DeposerAvisPage`, `MesAvisPage` | Fait |
| Dawini : demander un médicament aux pharmacies de ma wilaya, voir les réponses, clôturer | `POST /api/dawini/besoins`, `GET /api/dawini/besoins/mes`, `GET /api/dawini/besoins/{id}/reponses`, `POST /api/dawini/besoins/{id}/cloturer` | `/dawini`, `/dawini/:id` | `DawiniPage`, `ReponsesBesoinPage` | Fait |
| M'inscrire sur la liste d'attente d'un médecin, voir mes listes, me retirer | `POST /api/medecins/{id}/liste-attente`, `GET /api/liste-attente/mes`, `POST /api/liste-attente/{id}/retirer` | `/medecins/:id`, `/liste-attente` | `FicheMedecinPage`, `MesListesAttentePage` | Fait |
| Mon profil (nom, téléphone, date de naissance, wilaya, langue) | `GET /api/moi/profil`, `PUT /api/moi/profil` | `/moi/profil` | `MonProfilPage` | Fait |
| Mon compte (identité et rôles du jeton, identifiant à copier) | `GET /api/moi` | `/moi` | icône de connexion (« Connecté : nom ») | Fait |

## Médecin

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Candidater à l'annuaire (nom, spécialité, wilaya, ville, numéro d'ordre, téléphone), suivre ma candidature | `POST /api/medecin/candidature`, `GET /api/medecin/candidature` | `/medecin/candidature` | hors périmètre | Web seulement |
| Mon agenda (tous statuts), marquer un rendez-vous honoré, annuler un rendez-vous (patient prévenu) | `GET /api/medecin/rendezvous`, `POST /api/rendezvous/{id}/honorer`, `POST /api/medecin/rendezvous/{id}/annuler` | `/medecin/agenda` | hors périmètre | Web seulement |
| Ouvrir un créneau (date, heure, durée 5 à 120 min) ; la liste d'attente est alertée | `POST /api/medecin/creneaux` | `/medecin/disponibilites` | hors périmètre | Web seulement |
| Rédiger une ordonnance (lignes médicament / posologie / durée), voir mes ordonnances rédigées | `POST /api/ordonnances`, `GET /api/medecin/ordonnances`, `GET /api/ordonnances/{id}` | `/medecin/ordonnance/nouvelle`, `/medecin/ordonnances`, `/ordonnances/:id` | hors périmètre | Web seulement |
| Annuler une ordonnance | statut `ANNULEE` prévu, aucun endpoint | aucun | aucun | À faire |
| Proposer une téléconsultation sur un rendez-vous confirmé, démarrer (après consentement), terminer, annuler, ouvrir la salle | `POST /api/medecin/teleconsultations`, `GET /api/medecin/teleconsultations`, `POST /api/teleconsultations/{id}/demarrer`, `.../terminer`, `.../annuler` | `/medecin/agenda` (proposer), `/medecin/teleconsultations` | hors périmètre | Web seulement |
| Répondre aux messages de mes patients | `GET /api/conversations`, `GET`/`POST /api/conversations/{id}/messages` | `/messagerie`, `/messagerie/:id` | hors périmètre | Web seulement |
| Voir les avis reçus, signaler un avis à l'administrateur | `GET /api/medecins/{moi}/avis`, `POST /api/avis/{id}/signaler` | `/medecin/avis` | hors périmètre | Web seulement |
| Voir ma liste d'attente (patients inscrits, les plus anciens d'abord) | `GET /api/medecin/liste-attente` | `/medecin/liste-attente` | hors périmètre | Web seulement |
| Rattacher une secrétaire (par l'identifiant de son compte), lister, retirer | `POST /api/medecin/secretaires`, `GET /api/medecin/secretaires`, `POST /api/medecin/secretaires/{id}/retirer` | `/medecin/secretaires` | hors périmètre | Web seulement |
| Notifications, profil, compte | comme le patient | `/notifications`, `/moi/profil`, `/moi` | hors périmètre | Web seulement |
| Voir le nom du patient dans l'agenda et sur l'ordonnance | l'API n'expose que l'identifiant (abrégé à l'écran) | | | À faire (prochaine étape citée dans les README) |

## Secrétaire (rattachée par le médecin)

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Voir les cabinets auxquels je suis rattachée, choisir un médecin | `GET /api/secretaire/medecins` | `/secretaire` | hors périmètre | Web seulement |
| Agenda du médecin, marquer honoré, annuler (patient prévenu, créneau libéré) | `GET /api/secretaire/medecins/{medecinId}/rendezvous`, `POST /api/secretaire/rendezvous/{id}/honorer`, `POST /api/secretaire/rendezvous/{id}/annuler` | `/secretaire` | hors périmètre | Web seulement |
| Ouvrir un créneau dans l'agenda du médecin | `POST /api/secretaire/medecins/{medecinId}/creneaux` | `/secretaire` | hors périmètre | Web seulement |
| Communiquer son identifiant de compte au médecin pour le rattachement | `GET /api/moi` | `/moi` (bouton « Copier ») | hors périmètre | Web seulement |
| Être prévenue d'un rattachement ou d'un retrait | `Notifieur` | `/notifications` | hors périmètre | Web seulement |

## Pharmacie

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Voir les demandes de médicaments ouvertes de ma wilaya (sans identité de patient) | `GET /api/dawini/besoins?wilaya=` | `/pharmacie` | hors périmètre | Web seulement |
| Répondre à une demande (nom de la pharmacie, disponible, prix en DA, commentaire) ; le patient est prévenu | `POST /api/dawini/besoins/{id}/reponses` | `/pharmacie` (nom mémorisé localement) | hors périmètre | Web seulement |
| Voir les réponses déjà données à une demande | `GET /api/dawini/besoins/{id}/reponses` | `/pharmacie` | hors périmètre | Web seulement |
| Vérifier une ordonnance présentée au comptoir | `GET /api/ordonnances/verifier/{code}` | `/verifier` | `VerifierOrdonnancePage` | Fait (public) |

## Administrateur

| Fonctionnalité | Backend | Web | Mobile | Statut |
|---|---|---|---|---|
| Tableau de bord : candidatures en attente, validées, refusées | `GET /api/admin/statistiques` | `/admin` | hors périmètre | Web seulement |
| Examiner les candidatures, valider (le médecin est publié dans l'annuaire et prévenu), refuser avec motif | `GET /api/admin/candidatures?statut=`, `POST /api/admin/candidatures/{id}/valider`, `POST .../refuser` | `/admin/candidatures` | hors périmètre | Web seulement |
| Modérer les avis (signalés par défaut) : masquer, rétablir | `GET /api/admin/avis?statut=`, `POST /api/admin/avis/{id}/masquer`, `POST .../retablir` | `/admin/avis` | hors périmètre | Web seulement |
| Déclencher les rappels de rendez-vous des 24 prochaines heures | `POST /api/admin/rappels/executer` | `/admin` | hors périmètre | Web seulement |
| Consulter le journal des accès (tous, ou ceux d'un utilisateur) | `GET /api/admin/audit?limite=`, `GET /api/admin/audit/sujet/{id}` | aucun écran | hors périmètre | API seulement |
| Gérer les comptes, les rôles, la MFA | console Keycloak | `https://auth.DOMAINE/admin/` | | Fait (hors application) |

## Automatismes (sans acteur)

| Fonctionnalité | Backend | Statut |
|---|---|---|
| Rappel de rendez-vous 24 h avant, une seule fois par rendez-vous confirmé, toutes les heures | `PlanificateurRappels`, `RappelService`, `TABIBI_RAPPELS_ACTIFS` | Fait |
| Alerte de la liste d'attente quand un créneau s'ouvre ou se libère | port `AlerteCreneau`, `ListeAttenteService` | Fait |
| Journal des accès à l'API (qui, quoi, quand, statut, IP tronquée) | `FiltreAudit`, table `journal_acces` | Fait (purge à prévoir) |
| Limitation de débit des points publics (annuaire, vérification, publications) : 429 et `Retry-After` | `FiltreLimiteDebit`, `LimiteurDebit`, `tabibi.limite-debit.*` (backend v0.24.0) | Fait (par instance) |
| Référencement des pages publiques : titres, descriptions, 404, `robots.txt`, `sitemap.xml` | web v0.20.0 (`SeoService`, `server.ts`) | Fait |
| Sauvegarde quotidienne des bases | `infra/sauvegarde/pg_dump.sh` (cron à planifier) | Fait (script) |

## Ce qui est vérifié automatiquement (tests)

| Niveau | Où | Ce qui est prouvé |
|---|---|---|
| Unitaire et tranche, backend | `tabibi-backend`, `mvn test` (63 classes) : domaine, services avec faux ports, `@WebMvcTest` avec `SecurityConfig` | règles métier, transitions, 401 / 403 par rôle, codes HTTP ; `RealmKeycloakTest` : le realm versionné est conforme |
| Scénario de bout en bout, backend | `ScenarioApiTest` (`@SpringBootTest`, adaptateurs en mémoire, `JwtDecoder` simulé, backend v0.24.1) | application complète sans base : parcours créneau, réservation, notifications, honoré, avis, ordonnance, vérification, PDF réel, 429 |
| Intégration base, backend | `mvn verify -Dit.docker=true` (Testcontainers PostgreSQL) | requêtes JPA non triviales sur un vrai PostgreSQL |
| Modules purs, web | `tabibi-web`, `npm run test:logique` (Playwright, projet `logique` : 39 tests dans node, sans navigateur) | dictionnaires i18n complets, formatage, validation et bornes des `*.formats.ts`, configuration lue à l'exécution |
| Navigateur, web | `tabibi-web`, `npm run test:navigateur` (Playwright, projet `navigateur` : 257 tests dans Chromium dont 19 parcours, web v0.24.0) sur le build de production servi par `server.ts` face à une API simulée | écrans, formulaires, appels HTTP réellement envoyés, gardes de rôle, 400 / 403 / 404 / 409, SEO et `sitemap.xml`, i18n rendue et `dir=rtl`, parcours de bout en bout |
| Tests, mobile | `tabibi-mobile`, `flutter test` : modèles, utilitaires, pages avec `FakeApiService` | écrans patient, tolérance des modèles |
| **Intégration réelle des trois briques** | `tabibi-infra-docs`, `integration/lancer.sh` puis `verifier-web.sh` ; workflow `integration` (push, pull request, hebdomadaire) | API construite depuis les sources en profil `postgres` (Liquibase sur PostgreSQL 16), jetons du vrai Keycloak 26 acceptés avec les rôles, parcours complet (créneau, candidature validée, annuaire, réservation 201 / 409, notifications, honoré, avis et synthèse publique, ordonnance, vérification publique et PDF, 401 / 403), image web dont le rendu serveur appelle la vraie API (`/`, fiche, `config.json`, CSP) |

Pas encore : connexion OIDC réelle menée jusqu'au bout dans le navigateur (la pile réelle vérifie le départ vers
Keycloak, pas l'authentification d'un compte), application mobile contre l'API réelle, charge, restauration d'une
sauvegarde (voir [DEPLOIEMENT.md](DEPLOIEMENT.md), section 16).

## Ce qui n'existe pas encore

- Envoi de SMS et d'e-mails (port `Notifieur` prêt, adaptateurs à écrire) ; notifications push sur mobile.
- Nom du patient dans les écrans du médecin et de la secrétaire, sélecteur de wilayas (le code est saisi).
- Écran d'administration du journal des accès ; annulation d'une ordonnance ; export et effacement d'un compte
  (droits des personnes) ; durée de conservation appliquée.
- Espaces médecin, secrétaire, pharmacie et administrateur sur mobile (choix : application patient d'abord).
- Bouton de téléchargement du PDF de l'ordonnance sur le web et le mobile (l'API le fournit depuis backend v0.23.0) ;
  stockage sécurisé et rafraîchissement du jeton sur mobile ; icône et écran de lancement de l'application ;
  instance Jitsi dédiée ; paiement en ligne (non prévu).
