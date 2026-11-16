# Les agents de Tabibi : qui tourne, quand, avec quels droits

> **Pourquoi ce document.** Tabibi est entretenu en grande partie par des **agents automatiques** (GitHub Actions,
> dont plusieurs pilotés par Claude). Ce guide dit, pour chacun : quand il se déclenche, ce qu'il a le droit de
> faire, ce qu'il n'a pas le droit de faire, et où regarder quand il échoue. Les règles communes sont dans
> [CLAUDE.md](../CLAUDE.md) ; l'état réel des agents est dans les fichiers `.github/workflows/` de chaque dépôt (en
> cas de divergence, **le workflow fait foi**).

## Vue d'ensemble

| Agent | Backend | Web | Mobile | Infra-docs | Déclencheur |
|---|:-:|:-:|:-:|:-:|---|
| [Claude `@claude`](#1-claude-claude) | oui | oui | oui | oui | `@claude` dans un ticket ou une PR |
| [Réparation auto](#2-réparation-auto) | oui | oui | oui | oui | un contrôle échoue sur `main` |
| [Chasse aux erreurs](#3-chasse-aux-erreurs) | oui | oui | — | — | chaque jour à 05:30 UTC |
| [Cohérence plateforme](#4-cohérence-plateforme) | — | oui | oui | — | toutes les heures |
| [Fusion auto](#5-fusion-auto) | oui | oui | oui | — | PR de branche `claude/…` |
| [Mise en ligne](#6-mise-en-ligne) | oui | oui | — | — | CI verte sur `main` |
| [Sécurité](#7-sécurité) | oui | oui | oui | oui (site) | PR, `main`, chaque lundi |
| [Dependabot](#8-dependabot) | oui | oui | oui | — | chaque semaine |

Le fil conducteur : **les agents ouvrent des PR sur des branches `claude/…`, la CI les vérifie, la fusion et la mise
en ligne sont automatiques si tout est vert.** Un humain (ou un agent) n'a donc jamais besoin de pousser sur `main`.

```
erreur ou idée ─► agent ─► branche claude/… ─► PR ─► CI verte ─► fusion auto ─► CI de main ─► Mise en ligne ─► porte de vérification
                                                       └─ rouge : la PR reste ouverte, rien ne part
```

**Droits communs à tous les agents** : jamais de push sur `main`, jamais de test supprimé ou désactivé, aucun
secret touché, aucune donnée de patient transmise à l'extérieur, aucun déploiement lancé à la main. Les sections
ci-dessous n'indiquent donc que ce qui est **propre** à chaque agent.

**Secrets nécessaires** (Settings → Secrets and variables → Actions) : `CLAUDE_CODE_OAUTH_TOKEN` (agents Claude),
`TABIBI_DEPLOY_SSH_KEY` (mise en ligne), `TABIBI_ERREURS_SSH_KEY` (chasse aux erreurs), `JETON_DEPOTS` (optionnel,
clone des dépôts privés par la CI d'intégration). Un secret expiré ou absent est la première cause d'échec d'un agent.

---

## 1. Claude `@claude`

- **Où** : `claude.yml` dans les quatre dépôts.
- **Quand** : dès qu'un ticket (ouverture, assignation), un commentaire, une revue de PR ou un commentaire de revue
  contient `@claude`.
- **A le droit de** : lire le code, modifier des fichiers, lancer les builds et tests du dépôt (`npm`, `ng`, `mvn`,
  `flutter`, `dart`, `node`, `git`), commenter le ticket, ouvrir une PR vers `main` depuis une branche `claude/…`
  (titre et description en français, `Closes #N`). Limité à 60 tours et 60 minutes.
- **N'a pas le droit de** : pousser sur `main` ; modifier `.github/workflows/` (droits de l'application GitHub) ;
  approuver une PR ; lancer un déploiement ; exécuter des commandes hors de la liste autorisée.
- **S'il échoue** : onglet *Actions* → workflow **Claude** → l'exécution liée au ticket (le lien « View job run » est
  dans le commentaire de Claude). Causes fréquentes : `CLAUDE_CODE_OAUTH_TOKEN` expiré, demande trop vaste (limite de
  tours atteinte : découper le ticket), commande hors liste autorisée (ajouter l'outil dans `claude_args`).

## 2. Réparation auto

- **Où** : `reparation-auto.yml` (backend, web, mobile, infra-docs).
- **Quand** : quand le workflow de CI (`ci` ; `CI` côté mobile) ou `Securite` se termine (côté infra-docs : `integration`) en **échec sur `main`**.
- **A le droit de** : lire les journaux (`gh run view --log-failed`) ; si c'est une panne passagère (réseau, service
  externe), **relancer** l'exécution (`gh run rerun --failed`) et s'arrêter ; sinon corriger le code ou les tests sur
  une branche `claude/reparation-<id>` et ouvrir une PR qui explique la cause en français.
- **N'a pas le droit de** : désactiver ou supprimer un test pour passer au vert ; toucher aux secrets ; déployer.
- **S'il échoue** : l'agent crée lui-même un ticket « **Réparation auto impossible : <nom du contrôle>** » avec le
  lien de l'exécution. C'est l'endroit où regarder en premier ; un humain (ou `@claude` dans ce ticket) prend le relais.

## 3. Chasse aux erreurs

- **Où** : `chasse-aux-erreurs.yml` (backend et web).
- **Quand** : chaque jour à 05:30 UTC, ou à la main (*Run workflow*).
- **Comment** : une connexion SSH en lecture au serveur renvoie le **résumé des erreurs des dernières 24 h** (type
  d'exception, composant, premier emplacement dans le code, nombre — **aucune donnée personnelle**). Le backend lit
  les conteneurs `tabibi-backend-1` et `tabibi-keycloak-1`, le web lit `tabibi-web-1`. S'il n'y a aucune erreur,
  l'agent Claude ne se lance pas.
- **A le droit de** : corriger les erreurs qui viennent d'un vrai défaut du code, ajouter le test qui le reproduit,
  ouvrir **une** PR `claude/erreurs-<id>` ; ouvrir un ticket pour une erreur externe qui revient plus de 20 fois.
- **N'a pas le droit de** : changer quoi que ce soit pour une erreur qui ne vient pas du code (réseau, service
  externe, client qui envoie n'importe quoi) ; supprimer un test ; déployer ; demander plus que le résumé anonymisé.
- **S'il échoue** : *Actions* → **Chasse aux erreurs**. Étape « Résumé des erreurs » en rouge = problème de clé
  `TABIBI_ERREURS_SSH_KEY`, d'empreinte du serveur ou serveur injoignable. Étape Claude en rouge = voir
  [Claude `@claude`](#1-claude-claude).

## 4. Cohérence plateforme

- **Où** : `coherence.yml` (web : à la minute 15 de chaque heure ; mobile : à la minute 45).
- **Quand** : toutes les heures. Une garde saute l'exécution si une PR `claude/coherence…` est déjà ouverte (**une
  seule à la fois**).
- **A le droit de** : comparer le site et l'appli (l'autre dépôt est cloné en **lecture seule**) ; choisir 1 à 5
  problèmes (écrans ou fonctions manquants d'un côté, libellés différents, anglais oublié, « null », lien mort, parcours
  illogique) et les corriger **dans son propre dépôt**, avec tests, dans une PR `claude/coherence-<id>`. Ce qui doit
  changer dans l'autre dépôt est écrit dans la description de la PR (section « Côté tabibi-mobile » ou « Côté
  tabibi-web »). S'il n'y a rien d'utile, il ne fait rien.
- **N'a pas le droit de** : modifier l'autre dépôt ; changer les **choix voulus** (pré-lancement, « 75 000 », visio
  « Bientôt », opticiens et pharmacies) ; toucher à l'authentification, aux URL de l'API ou aux secrets ; s'écarter de
  la charte ; ajouter `android:taskAffinity`.
- **S'il échoue** : *Actions* → **Coherence plateforme**. Étape de clone en rouge = dépôt de l'autre moitié
  inaccessible. Si les PR s'accumulent ou se contredisent, fermer la PR en trop : la garde empêche d'en ouvrir une
  nouvelle tant qu'une reste ouverte.

## 5. Fusion auto

- **Où** : `fusion-auto.yml` (backend, web, mobile).
- **Quand** : à l'ouverture, la réouverture, la mise à jour ou le passage en « prête » d'une PR dont la branche
  commence par `claude/` (hors brouillon).
- **A le droit de** : activer la **fusion automatique en squash** : GitHub fusionne la PR **dès que les vérifications
  obligatoires sont vertes** (tests, Gitleaks, Trivy).
- **N'a pas le droit de** : fusionner une PR dont les contrôles sont rouges ou absents ; fusionner une branche qui ne
  commence pas par `claude/` ; déployer (la mise en ligne est un autre agent).
- **S'il échoue** : *Actions* → **Fusion auto agent**. Une PR qui ne se fusionne pas est presque toujours une PR dont
  un contrôle est rouge (lire l'onglet *Checks* de la PR), ou dont la fusion automatique n'est pas autorisée dans les
  réglages du dépôt (Settings → General → *Allow auto-merge*).

## 6. Mise en ligne

- **Où** : `mise-en-ligne.yml` (backend et web ; le mobile n'est pas déployé automatiquement).
- **Quand** : après chaque exécution **réussie de la CI sur un push sur `main`** ; ou à la main (*Run workflow*).
  Une seule mise en ligne à la fois (`concurrency`, sans annulation).
- **Comment** : connexion SSH au serveur Oracle avec `TABIBI_DEPLOY_SSH_KEY`, une clé qui ne peut lancer **que** la
  commande de déploiement (`backend <sha>` ou `web <sha>`). Le serveur : n'accepte que la **tête actuelle de `main`**,
  fait une **copie avant**, déploie, passe la **porte de vérification**, et **revient seul en arrière** si elle échoue.
- **A le droit de** : déployer le commit exactement vérifié par la CI.
- **N'a pas le droit de** : déployer autre chose que la tête de `main` ; exécuter une autre commande sur le serveur ;
  déployer un commit dont la CI est rouge.
- **S'il échoue** : *Actions* → **Mise en ligne** → journal de l'étape « Déploiement sur le serveur » (les lignes
  `OK` / `ECHEC` de la porte de vérification y figurent). Un retour arrière automatique laisse la version précédente
  en ligne : le site fonctionne, il faut corriger puis refaire une PR. Vérifier aussi `https://tabibi.doctor/assets/version.txt`
  (doit afficher le commit attendu). Pour réessayer sans nouveau commit : *Run workflow*.

## 7. Sécurité

- **Où** : `securite.yml` (backend, web, mobile) ; `securite-site.yml` (infra-docs).
- **Quand** : à chaque PR, chaque push sur `main` et chaque lundi à 05:00 UTC. L'analyse du site en ligne
  (`securite-site.yml`) tourne le lundi à 05:30 UTC.
- **Ce qu'elle fait** : **Gitleaks** cherche des secrets dans **tout l'historique** ; **Trivy** liste les failles
  connues des dépendances (hautes et critiques) ; **OWASP ZAP** fait une analyse **passive** de `https://tabibi.doctor`
  (lit les en-têtes, cookies, fuites : n'attaque rien, ne charge pas le serveur).
- **A le droit de** : faire échouer un contrôle sur un **secret détecté** ou une faille **critique corrigeable**
  (ce qui bloque la fusion). Les autres failles sont seulement rapportées. Le rapport ZAP ne fait jamais échouer.
- **N'a pas le droit de** : attaquer le site (analyse active), écrire dans le code, ouvrir des tickets ZAP
  (`allow_issue_writing: false`).
- **S'il échoue** : *Actions* → **Securite** → job « Secrets (Gitleaks) » ou « Failles connues (Trivy) ». Un secret
  trouvé : **le révoquer et le remplacer immédiatement** (le supprimer du code ne suffit pas, il reste dans
  l'historique), puis corriger. Une faille Trivy : monter la version de la dépendance (Dependabot le propose souvent
  déjà). Un faux positif Gitleaks documenté va dans `.gitleaksignore` (mobile) — jamais pour cacher un vrai secret.
  Le rapport ZAP est dans le résumé de l'exécution.

## 8. Dependabot

- **Où** : `.github/dependabot.yml` (backend : Maven, Actions, Docker ; web : npm, Actions, Docker ; mobile : pub, Gradle, Actions).
- **Quand** : chaque semaine.
- **A le droit de** : ouvrir des PR de mise à jour de dépendances (qui passent la CI comme les autres).
- **N'a pas le droit de** : fusionner seul (ses PR ne commencent pas par `claude/` : **la fusion auto ne les prend pas
  en charge**) ni de déployer.
- **Que faire** : fusionner la PR si la CI est verte, après avoir lu les notes de version pour une montée de version
  majeure (Keycloak, PostgreSQL, Spring, Angular, Flutter). Une PR Dependabot rouge : demander à `@claude` de la
  corriger en commentaire, ou la fermer.
- **S'il échoue** : *Insights → Dependency graph → Dependabot* du dépôt donne l'état et les erreurs de chaque mise à
  jour.

---

## Aide-mémoire : « quelque chose ne va pas, par où commencer ? »

1. Le **site est-il en ligne ?** `https://tabibi.doctor/assets/version.txt` doit répondre le dernier commit déployé.
2. Quel workflow est rouge ? Onglet *Actions* du dépôt concerné, filtrer sur `main`.
3. Y a-t-il un ticket « Réparation auto impossible… » ? Il contient le lien de l'exécution fautive.
4. Une PR `claude/…` est-elle bloquée ? Lire l'onglet *Checks* de la PR.
5. Un secret a-t-il expiré (`CLAUDE_CODE_OAUTH_TOKEN`, clés SSH) ? C'est la cause la plus fréquente d'un agent qui ne
   démarre pas.
6. Le workflow `integration` de ce dépôt est rouge un lundi sans commit récent ? Il signale une **dérive entre les
   dépôts** (API, Keycloak ou front qui ne s'entendent plus) : voir [GUIDE-DEVELOPPEUR.md](GUIDE-DEVELOPPEUR.md).
