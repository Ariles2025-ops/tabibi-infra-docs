# Architecture Tabibi — resume

> Version illustree (diagrammes) : `architecture-cible.html`.

## Principes
1. **Securite d'abord** — Keycloak (OAuth2/OIDC), JWT, Spring Security, roles, chiffrement, audit.
2. **Portabilite** — JPA + Liquibase (base remplacable), Docker (hebergeur remplacable).
3. **Testabilite** — chaque fonctionnalite avec ses tests (unitaire, integration, e2e).
4. **Clarte** — architecture hexagonale, decoupage par domaine, doc vivante.
5. **Progressivite** — fonctionnalite par fonctionnalite, tracee par git.

## Back-end (hexagonal)
- **Domaine** (entites + regles + ports) ne depend de rien.
- **Cas d'usage** (services applicatifs) orchestrent le domaine.
- **Adaptateurs** : REST (entrant), JPA/PostgreSQL & notifieurs (sortants).
- Modules : identite, annuaire, rendezvous, ordonnances, teleconsultation, dawini, messagerie, administration.

## Securite
- Keycloak emet un JWT signe (roles PATIENT/MEDECIN/SECRETAIRE/ADMIN, MFA).
- L'API valide le JWT (JWKS) et applique l'autorisation par role. Aucun secret durable cote client.

## Donnees
- PostgreSQL, schema versionne par Liquibase. Noyau : utilisateur, medecin, cabinet, creneau,
  rendez_vous, ordonnance, avis, dawini (demandes/reponses), pharmacie.

## Tests
- Unitaire (JUnit + Mockito) · Integration (Testcontainers + PostgreSQL) · API (MockMvc/REST Assured)
  · Front (Karma) / Mobile (flutter test) · Bout en bout (Playwright).
