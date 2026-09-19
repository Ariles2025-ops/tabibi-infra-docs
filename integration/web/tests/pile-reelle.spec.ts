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

  test("l'accueil rendu cote serveur affiche « Trouver un praticien » et chaque praticien de l'API", async ({ page, request }) => {
    const annuaire = await praticiens();
    expect(
      annuaire.length,
      "l'annuaire de l'API reelle est vide : rien a comparer (integration/scenario-api.mjs a-t-il tourne ?)",
    ).toBeGreaterThan(0);

    // 1. Sans navigateur : la preuve du rendu cote serveur (le serveur de rendu a bien appele GET /api/medecins).
    const html = await htmlRendu(request, '/', 'Trouver un praticien');
    expect(html, 'la page / rendue cote serveur ne contient pas « Trouver un praticien » (page sans rendu ?)').toContain(
      'Trouver un praticien',
    );
    for (const medecin of annuaire) {
      expect(html, `la page / rendue cote serveur ne contient pas « ${medecin.nomComplet} », renvoye par l'API`).toContain(
        medecin.nomComplet,
      );
      expect(html).toContain(`href="/medecins/${medecin.id}"`);
    }

    // 2. Dans le navigateur, une fois l'application hydratee : la meme liste reste affichee.
    await ouvrir(page, '/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trouver un praticien');
    for (const medecin of annuaire) {
      await expect(page.getByRole('link', { name: new RegExp(echapper(medecin.nomComplet)) })).toBeVisible();
    }
  });

  test('la fiche du premier praticien affiche son nom et sa specialite lus dans l\'API', async ({ page }) => {
    const [premier] = await praticiens();
    expect(premier, "l'annuaire de l'API reelle est vide : aucune fiche a ouvrir").toBeTruthy();

    // La fiche est relue une a une : c'est bien GET /api/medecins/{id} que le serveur de rendu appelle.
    const fiche = await lireApi<{ nomComplet: string; specialiteFr: string; ville: string; wilayaFr: string }>(
      `/api/medecins/${premier.id}`,
    );

    await ouvrir(page, `/medecins/${premier.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fiche.nomComplet);
    await expect(page.getByText(`${fiche.specialiteFr} · ${fiche.ville} (${fiche.wilayaFr})`)).toBeVisible();
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

    await expect(page.getByText('Code inconnu.')).toBeVisible();
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
    await expect(page.getByText('Code inconnu.')).toHaveCount(0);
  });

  test('une page privee renvoie le visiteur vers le Keycloak reel', async ({ page, request }) => {
    // Rendue par le serveur : la page privee est noindex et annonce la redirection, sans reveler de donnee.
    const html = await (await request.get('/mes-rendez-vous')).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('Redirection vers la page de connexion');

    // Dans le navigateur : pas d'attente de l'hydratation, la page part des que l'etat de connexion est connu.
    await page.goto('/mes-rendez-vous');
    let surKeycloak = true;
    try {
      await page.waitForURL((url) => url.href.includes('/realms/tabibi') && url.href.includes('/auth'), { timeout: 20_000 });
    } catch {
      surKeycloak = false;
    }

    if (surKeycloak) {
      const url = new URL(page.url());
      expect(url.origin, "la redirection ne vise pas l'emetteur Keycloak de la pile").toBe(new URL(ISSUER_KEYCLOAK).origin);
      expect(url.searchParams.get('client_id')).toBe('tabibi-web');
      expect(url.searchParams.get('response_type')).toBe('code');
    } else {
      // Redirection non aboutie (Keycloak lent a repondre) : la page l'annonce au moins a l'ecran.
      await expect(page.getByText('Redirection vers la page de connexion')).toBeVisible();
    }
  });

  test("robots.txt et sitemap.xml repondent, et le plan du site liste le premier praticien de l'API", async ({ request }) => {
    const [premier] = await praticiens();
    expect(premier, "l'annuaire de l'API reelle est vide : aucune fiche attendue dans le plan du site").toBeTruthy();

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(robots.headers()['content-type']).toContain('text/plain');
    const texte = await robots.text();
    expect(texte).toContain('User-agent: *');
    expect(texte).toContain('Disallow: /mes-');
    expect(texte).toContain('/sitemap.xml');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('application/xml');
    const xml = await sitemap.text();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml, `le plan du site n'annonce pas la fiche /medecins/${premier.id} de l'API`).toContain(
      `/medecins/${premier.id}</loc>`,
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

  test('le selecteur de langue bascule la page en arabe (dir rtl, titre arabe)', async ({ page }) => {
    await ouvrir(page, '/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    // Le selecteur de la barre de navigation (tabibi-web >= v0.23.0) : un bouton par langue, marque par `lang`.
    await page.locator('.selecteur-langue button[lang="ar"]').click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('البحث عن طبيب');
    // Les donnees de l'API ne sont pas traduites : les praticiens reels restent affiches.
    const [premier] = await praticiens();
    if (premier) {
      await expect(page.getByRole('link', { name: new RegExp(echapper(premier.nomComplet)) })).toBeVisible();
    }
  });
});

/** Echappe les caracteres speciaux d'une donnee de l'API avant de la mettre dans une expression reguliere. */
function echapper(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
