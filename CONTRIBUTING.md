# Workflow de contribution

## Regle d'or
**Un commit par fonctionnalite, avec ses tests.** Messages `type(scope): description`
(`feat`, `fix`, `docs`, `test`, `refactor`, `chore`).

## Branche `main` protegee
- Pas de push direct : tout passe par une Pull Request.
- CI verte obligatoire (build + tests) avant fusion.
- Revue requise ; fusion en squash (historique lineaire).

## Cycle
1. Brancher : `git checkout -b feat/<scope>-<sujet>`
2. Coder + **tests**.
3. `git commit` (message conventionnel).
4. Pousser + ouvrir une PR ; attendre la CI verte.
5. Squash & merge → deploiement.

## Traçabilite
Chaque fonctionnalite = un commit + une entree dans `docs/JOURNAL.md` du depot concerne.
