import { expect, test } from '@playwright/test';
import { COMPTES, lireResultatScenario, seConnecter } from './outils';

/**
 * Espaces connectes, dans un vrai navigateur, face a la pile d'integration REELLE : connexion par le formulaire
 * Keycloak du realm tabibi avec les comptes de demonstration, puis les donnees creees par
 * integration/scenario-api.mjs (lues dans integration/resultat-scenario.json). Le pre-lancement n'est pas modifie :
 * seConnecter() utilise l'acces equipe du front, uniquement dans ce navigateur de test.
 */
const resultat = lireResultatScenario();
const MOTIF_SANS_SCENARIO =
  "integration/resultat-scenario.json absent : jouer d'abord le scenario API (integration/lancer.sh, GARDER_LA_PILE=1)";

test.describe('espaces connectes', () => {
  test.skip(!resultat, MOTIF_SANS_SCENARIO);

  test("medecin : l'espace s'ouvre, l'agenda affiche le rendez-vous du scenario", async ({ page }) => {
    await seConnecter(page, COMPTES.medecin, '/medecin/agenda');

    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();
    await expect(page.getByText('Chargement…')).toHaveCount(0);
    // Le rendez-vous du scenario a ete honore ; il est affiche aujourd'hui (« À venir »), ou « Passés » si le
    // scenario a franchi minuit.
    const aVenir = page.getByRole('tab', { name: /À venir/ });
    if (/\(0\)/.test((await aVenir.textContent()) ?? '')) await page.getByRole('tab', { name: /Passés/ }).click();
    await expect(page.locator('li .badge-statut', { hasText: 'Honoré' }).first()).toBeVisible();
  });

  test("medecin : la page des ordonnances liste l'ordonnance du scenario", async ({ page }) => {
    await seConnecter(page, COMPTES.medecin, '/medecin/ordonnances');

    await expect(page.getByRole('heading', { level: 1, name: 'Mes ordonnances rédigées' })).toBeVisible();
    await expect(page.locator('code', { hasText: resultat!.codeOrdonnance })).toBeVisible();
    await expect(page.getByText('Aucune ordonnance rédigée pour le moment.')).toHaveCount(0);
  });

  test("secretaire : l'espace affiche l'agenda du medecin rattache", async ({ page }) => {
    test.skip(!resultat!.secretaireRattachee, "le scenario n'a pas rattache de secretaire");

    await seConnecter(page, COMPTES.secretaire, '/secretaire');
    await expect(page.getByRole('heading', { level: 1, name: 'Espace secrétaire' })).toBeVisible();
    await page.getByLabel('Médecin').selectOption(resultat!.medecinId);

    await expect(page.getByRole('heading', { level: 2, name: 'Agenda' })).toBeVisible();
    const aVenir = page.getByRole('tab', { name: /À venir/ });
    await expect(aVenir).toBeVisible();
    if (/\(0\)/.test((await aVenir.textContent()) ?? '')) await page.getByRole('tab', { name: /Passés/ }).click();
    await expect(page.locator('li.rendez-vous .badge-statut', { hasText: 'Honoré' }).first()).toBeVisible();
  });

  test('pharmacie : l\'espace s\'ouvre et affiche la liste des besoins', async ({ page }) => {
    test.skip(!resultat!.besoinMedicament, "le scenario n'a pas publie de demande de medicament");

    await seConnecter(page, COMPTES.pharmacie, '/pharmacie');
    await expect(page.getByRole('heading', { level: 1, name: 'Espace pharmacie' })).toBeVisible();

    await page.locator('select[name="wilayaCode"]').selectOption(resultat!.besoinWilayaCode!);
    await page.getByRole('button', { name: 'Afficher les demandes' }).click();

    await expect(page.getByText(resultat!.besoinMedicament!)).toBeVisible();
  });
});
