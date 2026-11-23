import { expect, test } from '@playwright/test';
import { CODE_ORDONNANCE, ISSUER_KEYCLOAK, URL_API, URL_WEB } from '../playwright.config';
import { htmlRendu, lireApi, ouvrir, praticiens } from './outils';

/**
 * Le front web Tabibi dans un vrai navigateur (Chromium), face a la pile d'integration REELLE : l'image de
 * tabibi-web lancee devant l'API construite depuis les sources de tabibi-backend, avec PostgreSQL 16 et Keycloak 26.
 * Aucun simulateur, aucune donnee codee en dur : chaque attente est construite a partir de ce que renvoie l'API
 * (outils.ts, lireApi / praticiens), et l'annuaire est peuple par integration/scenario-api.mjs, joue juste avant.
 *
 * Ce fichier remplace le controle en curl de integration/verifier-web.sh : il verifie les memes pages, mais avec
 * le JavaScript execute, l'hydratation attendue, les formulaires reellement remplis et la redirection OIDC suivie.
 */

/** Origine (schema://hote[:port]) de l'API : c'est elle que la CSP du serveur de rendu autorise dans connect-src. */
const ORIGINE_API = new URL(URL_API).origin;

test.describe('Front web face a la pile reelle', () => {
  test("assets/config.json sert l'URL de l'API et l'emetteur Keycloak de la pile", async ({ request }) => {
    const reponse = await request.get('/assets/config.json');

    expect(reponse.status(), `${URL_WEB}/assets/config.json ne repond pas : le conteneur web est-il demarre ?`).toBe(200);
    const config = JSON.parse(await reponse.text());
    expect(config.apiUrl, "assets/config.json ne pointe pas vers l'API de la pile").toBe(URL_API);
    expect(config.keycloakIssuer, "assets/config.json ne pointe pas vers le Keycloak de la pile").toBe(ISSUER_KEYCLOAK);
    expect(config.keycloakClientId).toBe('tabibi-web');
  });

  test("l'accueil est rendu cote serveur, et la page de sa specialite liste chaque praticien de l'API", async ({ request }) => {
    const annuaire = await praticiens();
    expect(
      annuaire.length,
      "l'annuaire de l'API reelle est vide : rien a comparer (integration/scenario-api.mjs a-t-il tourne ?)",
    ).toBeGreaterThan(0);

    // L'accueil (pre-lancement) : le rendu cote serveur a bien eu lieu.
    const accueil = await htmlRendu(request, '/', 'Votre santé ne devrait jamais attendre');
    expect(accueil, "la page / rendue cote serveur n'affiche pas son titre (page sans rendu ?)").toContain(
      'Votre santé ne devrait jamais attendre',
    );

    // Les pages de referencement par specialite listent, rendus cote serveur, les praticiens renvoyes par l'API.
    for (const medecin of annuaire) {
      const chemin = `/specialites/${medecin.specialiteSlug}`;
      const html = await htmlRendu(request, chemin, medecin.nomComplet);
      expect(html, `${chemin} rendue cote serveur ne contient pas « ${medecin.nomComplet} », renvoye par l'API`).toContain(
        medecin.nomComplet,
      );
      expect(html).toContain(`href="/praticiens/${medecin.id}/`);
    }
  });

  test('la fiche publique du premier praticien affiche son nom lu dans l\'API', async ({ page }) => {
    const [premier] = await praticiens();
    expect(premier, "l'annuaire de l'API reelle est vide : aucune fiche a ouvrir").toBeTruthy();

    // La fiche est relue une a une : c'est bien GET /api/medecins/{id} que le serveur de rendu appelle.
    const fiche = await lireApi<{ nomComplet: string }>(`/api/medecins/${premier.id}`);

    await ouvrir(page, `/praticiens/${premier.id}/fiche`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fiche.nomComplet);
    await expect(page).toHaveTitle(new RegExp(echapper(fiche.nomComplet)));
  });

  test('la recherche par specialite filtre reellement la liste', async ({ page }) => {
    const annuaire = await praticiens();
    expect(annuaire.length, "l'annuaire de l'API reelle est vide : rien a filtrer").toBeGreaterThan(0);
    const specialite = annuaire[0].specialiteSlug;

    await ouvrir(page, '/');
    const selecteur = page.locator('select[name="specialite"]');
    const proposees = await selecteur.locator('option').evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value).filter((v) => v),
    );
    test.skip(
      !proposees.includes(specialite),
      `la specialite « ${specialite} » du premier praticien de l'API n'est pas proposee par le formulaire (${proposees.join(', ')})`,
    );

    // Ce que l'API repond avec le meme filtre : c'est l'attente, et elle n'est pas ecrite ici.
    const attendus = await praticiens(specialite);
    expect(attendus.length, `GET /api/medecins?specialite=${specialite} ne renvoie personne`).toBeGreaterThan(0);
    const ecartes = annuaire.filter((m) => !attendus.some((a) => a.id === m.id));

    await selecteur.selectOption(specialite);
    await page.getByRole('button', { name: 'Rechercher' }).click();

    for (const medecin of attendus) {
      await expect(page.getByRole('link', { name: new RegExp(echapper(medecin.nomComplet)) })).toBeVisible();
    }
    // Les praticiens que l'API exclut du filtre disparaissent de la page (liste vide si l'annuaire est homogene).
    for (const medecin of ecartes) {
      await expect(page.getByRole('link', { name: new RegExp(echapper(medecin.nomComplet)) })).toHaveCount(0);
    }
  });

  test("la verification publique d'une ordonnance refuse un code inconnu", async ({ page }) => {
    await ouvrir(page, '/verifier');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vérifier une ordonnance');
    await page.getByPlaceholder('Code de vérification').fill('CODE-INCONNU-0000');
    await page.getByRole('button', { name: 'Vérifier' }).click();

    await expect(page.getByText('Code inconnu : aucune ordonnance ne correspond à ce code.')).toBeVisible();
    await expect(page.getByText('Ordonnance authentique')).toHaveCount(0);
  });

  test("la verification publique accepte le code d'une vraie ordonnance", async ({ page }) => {
    test.skip(
      !CODE_ORDONNANCE,
      "CODE_ORDONNANCE n'est pas fourni : le code de l'ordonnance emise par integration/scenario-api.mjs n'a pas ete transmis, seul le cas du code inconnu est verifie",
    );

    // Le code vient d'une ordonnance reellement emise : l'API le confirme avant que le navigateur ne le saisisse.
    const verification = await lireApi<{ valide: boolean }>(
      `/api/ordonnances/verifier/${encodeURIComponent(CODE_ORDONNANCE)}`,
    );
    expect(verification.valide, `l'API ne reconnait pas le code ${CODE_ORDONNANCE}`).toBe(true);

    await ouvrir(page, '/verifier');
    await page.getByPlaceholder('Code de vérification').fill(CODE_ORDONNANCE);
    await page.getByRole('button', { name: 'Vérifier' }).click();

    await expect(page.getByText(/Ordonnance authentique, émise le/)).toBeVisible();
    await expect(page.getByText('Code inconnu : aucune ordonnance ne correspond à ce code.')).toHaveCount(0);
  });

  test('en phase de test, une page privee mene le visiteur non connecte a la connexion Keycloak', async ({ page }) => {
    // tabibi-web (lancement.ts, CONNEXION_OUVERTE) : depuis le 18/11/2026 la connexion est ouverte (l'inscription
    // libre reste fermee). La fiche privee /medecins/{id} est gardee (connecteGuard) : le visiteur non connecte
    // part vers Keycloak.
    const [premier] = await praticiens();
    expect(premier, "l'annuaire de l'API reelle est vide : aucune fiche privee a ouvrir").toBeTruthy();
    await page.goto(`/medecins/${premier.id}`);
    await page.waitForURL((url) => url.href.startsWith(`${ISSUER_KEYCLOAK}/`), { timeout: 20_000 });
  });

  test("robots.txt et sitemap.xml repondent, et le plan du site liste le premier praticien de l'API", async ({ request }) => {
    const [premier] = await praticiens();
    expect(premier, "l'annuaire de l'API reelle est vide : aucune fiche attendue dans le plan du site").toBeTruthy();

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(robots.headers()['content-type']).toContain('text/plain');
    const texte = await robots.text();
    expect(texte).toContain('User-agent: *');
    expect(texte).toContain('Disallow: /moi');
    expect(texte).toContain('/sitemap.xml');

    // Index des plans (server.ts) : pages fixes FR/AR et une page par lot de 5 000 praticiens, tirees de l'API.
    const index = await request.get('/sitemap.xml');
    expect(index.status()).toBe(200);
    expect(index.headers()['content-type']).toContain('application/xml');
    const xmlIndex = await index.text();
    expect(xmlIndex).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xmlIndex).toContain('sitemap-praticiens-0.xml');

    const plan = await request.get('/sitemap-praticiens-0.xml');
    expect(plan.status()).toBe(200);
    const xml = await plan.text();
    expect(xml, `le plan du site n'annonce pas la fiche /praticiens/${premier.id} de l'API`).toContain(
      `/praticiens/${premier.id}/`,
    );
    expect(xml).not.toContain('/mes-rendez-vous');
  });

  test("l'en-tete Content-Security-Policy autorise l'URL de l'API", async ({ request }) => {
    const reponse = await request.get('/');

    const csp = reponse.headers()['content-security-policy'];
    expect(csp, `aucun en-tete Content-Security-Policy sur ${URL_WEB}/`).toBeTruthy();
    expect(csp, `la CSP n'autorise pas l'origine de l'API ${ORIGINE_API} : ${csp}`).toContain(ORIGINE_API);
    expect(csp).toContain(`connect-src`);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("le lien « العربية » mene a l'accueil arabe (lang ar, sens rtl, titre arabe)", async ({ page }) => {
    await ouvrir(page, '/');
    await page.locator('a[href="/ar"][lang="ar"]').first().click();

    await page.waitForURL((url) => url.pathname === '/ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('main[dir="rtl"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'صحتك لا تحتمل الانتظار.' })).toBeVisible();
  });

});

/** Echappe les caracteres speciaux d'une donnee de l'API avant de la mettre dans une expression reguliere. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
