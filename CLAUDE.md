# CLAUDE.md — règles communes à tout le projet Tabibi

> **À lire en premier** par tout agent (Claude, réparateur, etc.) ou humain qui touche à Tabibi. Ces règles valent
> pour les quatre dépôts : `tabibi-backend` (API Java), `tabibi-web` (site Angular), `tabibi-mobile` (appli Flutter)
> et `tabibi-infra-docs` (ce dépôt : documentation, tests d'intégration, copie du realm Keycloak).
> La liste des agents automatiques est dans [docs/agents.md](docs/agents.md).

## Ce qu'est Tabibi

Une plateforme de prise de rendez-vous médicaux pour l'Algérie : patients, médecins, secrétaires, pharmacies,
administration. **Une seule plateforme** : le site et l'appli partagent la même API (`api.tabibi.doctor`) et les
mêmes comptes Keycloak. Le site public est `https://tabibi.doctor`. Les données manipulées sont des **données de
patients** : la prudence passe avant la vitesse.

Pour comprendre le projet : [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md), [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md),
[docs/SECURITE.md](docs/SECURITE.md).

## Choix voulus — à ne jamais « corriger »

Ce ne sont pas des oublis. Ne les changez pas, même si cela vous paraît incohérent ; en cas de doute, ouvrez un
ticket au lieu de modifier.

- **Pré-lancement** : après connexion, l'utilisateur est mené vers `/bientot`, et un bandeau « Lancement
  prochainement » est affiché.
- **Le chiffre « 75 000 »** reste tel quel.
- **La visio (téléconsultation) est marquée « Bientôt »** : la fonction est visible mais pas encore ouverte.
- **Opticiens et pharmacies** restent tels qu'ils sont.

## Charte

- Vert `#0F7560`, or `#D4A437`, police **Plus Jakarta Sans**.
- Tout texte visible en **français et en arabe** (interface de droite à gauche pour l'arabe). Aucun texte anglais
  oublié, aucun « null » affiché, aucun lien mort.
- Mêmes mots, mêmes statuts, mêmes libellés sur le site et dans l'appli.

## Interdits (aucune exception)

1. **Jamais de push sur `main`.** Tout passe par une branche et une pull request ; les agents travaillent sur des
   branches `claude/…`.
2. **Jamais supprimer, désactiver ou affaiblir un test** pour faire passer la CI. Si un test est faux, corrigez-le
   en expliquant pourquoi dans la PR.
3. **Jamais `android:taskAffinity`** dans le projet Android (`tabibi-mobile`).
4. **Aucun secret dans le code, les journaux, les PR ou les tickets** (clés SSH, jetons, mots de passe, `.env`).
   Les secrets vivent dans les « Secrets » GitHub Actions et sur le serveur. Gitleaks scanne tout l'historique.
5. **Aucune donnée de patient vers l'extérieur** : ni dans un journal, un ticket, une PR, une notification, une
   requête vers un service tiers, ni dans une conversation avec un agent. Les résumés d'erreurs envoyés aux agents ne
   contiennent que le type d'exception et l'emplacement dans le code.
6. **Ne pas toucher à l'authentification ni aux URL de l'API** sans demande explicite d'un humain.
7. **Aucun déploiement à la main** depuis un agent : la mise en ligne est automatique (voir plus bas).

## Comment travailler

- Une modification = une branche = une PR, en **français**, claire pour quelqu'un qui découvre le projet
  (pourquoi, quoi, comment vérifier). Message de commit `type(scope): description` (voir
  [CONTRIBUTING.md](CONTRIBUTING.md)).
- Modifiez le moins de choses possible, ajoutez un test qui reproduit tout défaut corrigé.
- Une PR de la branche `claude/…` est **fusionnée automatiquement** (squash) dès que les contrôles obligatoires sont
  verts : relisez donc votre travail comme s'il partait en production, car c'est le cas.
- Les fichiers `.github/workflows/` ne sont pas modifiables par l'agent `@claude` (limite des droits de l'application
  GitHub) : proposez le changement dans la PR ou le ticket, un humain l'appliquera.

## Comment tester

| Dépôt | Commandes |
|---|---|
| `tabibi-backend` | `mvn -B verify -Dit.docker=true` (JDK 21 ; les tests d'intégration utilisent Docker) |
| `tabibi-web` | `npm ci`, `npx ng build`, `npm test` (Playwright : projets `logique` et `navigateur`) ; `npm run test:logique` pour aller vite |
| `tabibi-mobile` | `flutter pub get`, `flutter analyze`, `flutter test`, `flutter build apk --debug` (Flutter stable, JDK 17) |
| `tabibi-infra-docs` | `integration/lancer.sh` (pile réelle API + Keycloak + PostgreSQL), puis `integration/verifier-web.sh` (Playwright sur le site face à cette pile) |

Détails, variables et dépannage : [docs/GUIDE-DEVELOPPEUR.md](docs/GUIDE-DEVELOPPEUR.md). Un seul outil de test
navigateur dans tout le projet : **Playwright**.

## Comment la mise en ligne marche

La production est sur **un serveur Oracle** (Docker Compose : Caddy, web, backend, Keycloak, PostgreSQL). Ni
Supabase, ni Cloudflare Pages. L'identité est gérée par **Keycloak** (`auth.tabibi.doctor`).

1. Une PR est ouverte ; la **CI** du dépôt doit être **verte** (tests, plus Gitleaks et Trivy).
2. La PR est fusionnée sur `main` (automatiquement pour les branches `claude/…`, par un humain sinon).
3. La CI de `main` publie l'image Docker sur GHCR (`backend` et `web`).
4. Quand la CI de `main` est verte, le workflow **Mise en ligne** se lance seul (backend et web ; pas le mobile) : il
   se connecte en SSH au serveur avec une clé qui ne peut lancer **que** ce déploiement.
5. Le serveur n'accepte que la tête actuelle de `main`, fait une **copie avant** de changer quoi que ce soit.
6. La **porte de vérification** contrôle le site en ligne (version déployée = commit attendu, 69 wilayas, pages
   rendues côté serveur avec de vrais médecins en français et en arabe, vraies 404, liste complète des fiches fermée
   au public, etc. — voir `scripts/verifier-en-ligne.sh` dans `tabibi-web`).
7. Si la porte échoue, le serveur **revient seul en arrière** vers la copie. Le workflow est alors rouge.

Pour relancer une mise en ligne : onglet *Actions* du dépôt, workflow **Mise en ligne**, *Run workflow*.
Pour annuler un changement fautif : `git revert` du commit dans une PR (la mise en ligne repart toute seule).
Le mobile n'est pas déployé automatiquement (publication sur les stores : voir le README de `tabibi-mobile`).

## Quand ça casse

Voir [docs/agents.md](docs/agents.md) : chaque agent y a sa section « Où regarder s'il échoue ». En résumé, regardez
d'abord l'onglet *Actions* du dépôt concerné, puis les tickets « Réparation auto impossible… ».
