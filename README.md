# Tabibi — infra & documentation

Organisation **Tabibi** — plateforme de rendez-vous medical (Algerie). Reconstruction
professionnelle : back-end Spring Boot, web Angular, mobile Flutter, identite Keycloak,
base PostgreSQL. Ce depot porte l'**orchestration** et la **documentation vivante**.

## Depots
| Depot | Role | Stack |
|---|---|---|
| `tabibi-backend` | API metier | Spring Boot 3.4 / Java 21, JPA, Liquibase |
| `tabibi-web` | Front web | Angular 18 (+ SSR a venir) |
| `tabibi-mobile` | App mobile | Flutter (iOS + Android) |
| `tabibi-infra-docs` | Infra + docs | Docker, Keycloak, diagrammes |

## Lancer l'environnement complet (dev)
```bash
docker compose up -d      # PostgreSQL + Keycloak (realm tabibi importe)
# puis, dans tabibi-backend :  mvn spring-boot:run  (profil postgres pour la base)
# puis, dans tabibi-web :      npm install && npm start
```

## Architecture
- Vue complete avec diagrammes : `docs/architecture-cible.html` (ouvrir dans un navigateur).
- Resume technique : `docs/ARCHITECTURE.md`.

## Deploiement
Etape 1 (economique) : un VPS UE/Francfort, Docker Compose (Postgres + Keycloak + API + reverse proxy).
Etape 2 (scalable) : base managee + conteneurs/Kubernetes. Portable car tout est conteneurise.
