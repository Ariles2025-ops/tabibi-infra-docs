# Contribuer à Tabibi

> **Pourquoi ce document.** Les règles communes aux quatre dépôts (`tabibi-backend`, `tabibi-web`, `tabibi-mobile`,
> `tabibi-infra-docs`) pour que l'historique reste lisible, que rien n'arrive sur la branche principale sans tests
> verts ni revue, et que chaque fonctionnalité soit retrouvable. Le détail technique (installer, tester, ajouter
> une fonctionnalité, format des commits) est dans [docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md).

![Flux Git : quatre dépôts, branche principale protégée, cycle d'une fonctionnalité](docs/images/flux-git.png)

## Règle d'or

**Une fonctionnalité = une branche = un commit (avec ses tests, son README et son entrée de journal) = une pull
request.** Message conventionnel `type(scope): description` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`,
`build`, `ci`), en français sans accents, avec un corps qui explique le pourquoi et liste les vérifications.

## Branche principale protégée

- La branche principale s'appelle `main` sur GitHub (les workflows publient les images seulement depuis `main` ;
  un dépôt local encore sur `master` est renommé au premier push : `git branch -M main`).
- **Pas de push direct** : tout passe par une pull request.
- **CI verte obligatoire** avant fusion : `mvn verify` (backend), `npm ci` + `ng build` + `ng test` (web),
  `flutter analyze` + `flutter test` + APK (mobile), et le workflow `integration` de ce dépôt (pile réelle API +
  Keycloak + PostgreSQL + web, rejoué chaque lundi : un rouge du lundi signale une dérive entre dépôts). Aucun test
  désactivé pour « faire passer » la CI.
- **Revue requise** : au moins une approbation d'un autre membre ; la revue vérifie l'architecture (domaine sans
  Spring, port avant adaptateur), la sécurité (rôle **et** règle de propriétaire, aucune donnée personnelle dans les
  vues publiques, les notifications, les journaux), les tests et la documentation.
- **Fusion en squash** : historique linéaire, un commit par fonctionnalité sur `main`, message conservé.
- Dependabot ouvre des pull requests de mise à jour chaque semaine : les fusionner quand la CI est verte, après
  lecture des notes de version pour les changements majeurs.

## Cycle

1. Brancher depuis `main` : `git checkout -b feat/<scope>-<sujet>` (`fix/...`, `docs/...`).
2. Coder **avec les tests**, mettre à jour le README du dépôt et `docs/JOURNAL.md` (nouvelle version).
3. Vérifier en local (commande de test du dépôt), puis un seul commit conventionnel.
4. Pousser, ouvrir la pull request (description : quoi, pourquoi, comment vérifier), attendre la CI verte.
5. Revue, corrections éventuelles (amender le commit de la branche : la branche n'est pas partagée).
6. Squash and merge, suppression de la branche ; l'image GHCR `latest` et `sha-<commit>` est publiée par la CI
   (backend, web) et déployée par `docker compose pull && up -d` (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)).

## Traçabilité

- Chaque fonctionnalité = un commit + une entrée dans `docs/JOURNAL.md` du dépôt concerné + une ligne dans le
  journal global [docs/JOURNAL.md](docs/JOURNAL.md) de ce dépôt (et une mise à jour de
  [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md) si le périmètre fonctionnel change).
- Les commits produits avec l'assistant portent les deux trailers `Co-Authored-By` et `Claude-Session`.
- Jamais de secret (`.env`, mots de passe, clés de signature, `infra/keycloak/production/`) ni de donnée
  personnelle dans un commit, une pull request ou un ticket.

## Ce dépôt en particulier

- Les diagrammes se modifient dans `docs/diagrammes/src/*.mmd` et se regénèrent avec `docs/diagrammes/generer.sh` ;
  source et images vont dans le même commit.
- `infra/keycloak/tabibi-realm.json` est une copie de celui de `tabibi-backend` (source de vérité, testée) : le
  mettre à jour à chaque changement du realm.
- `docker-compose.yml` reste aligné sur celui de `tabibi-backend` (mêmes images, même realm monté).
