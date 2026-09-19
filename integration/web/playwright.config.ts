import { defineConfig, devices } from '@playwright/test';

/**
 * Verification du front web Tabibi dans un vrai navigateur, face a la pile d'integration REELLE
 * (PostgreSQL + Keycloak + API construite depuis les sources de tabibi-backend + image de tabibi-web).
 *
 * Pas de `webServer` ici : ni le front ni l'API ne sont demarres par Playwright. La pile est deja en route quand
 * ces tests s'executent (integration/lancer.sh puis le conteneur web, ou le workflow .github/workflows/integration.yml) ;
 * les tests ne font que s'y brancher. Les attentes sont construites a partir des vraies donnees renvoyees par l'API
 * (tests/outils.ts, lireApi) : aucune liste de praticiens n'est codee en dur.
 *
 * Variables :
 *   URL_WEB          front web a verifier                  (defaut http://localhost:4200)
 *   URL_API          API reelle interrogee pour les attentes (defaut http://localhost:8080)
 *   ISSUER_KEYCLOAK  emetteur Keycloak attendu             (defaut http://localhost:8081/realms/tabibi)
 *   CODE_ORDONNANCE  code d'une vraie ordonnance emise par le scenario API (facultatif : sans lui, le cas valide
 *                    de la page /verifier est saute)
 *   CHROME_BIN       Chrome / Chromium deja installe, au lieu de celui de Playwright (facultatif)
 * Les anciens noms TABIBI_WEB_URL, TABIBI_API_URL et TABIBI_KEYCLOAK_ISSUER (verifier-web.sh, lancer.sh) restent
 * acceptes pour ne pas casser les habitudes.
 */

function sansBarreFinale(url: string): string {
  return url.replace(/\/+$/, '');
}

function variable(noms: string[], defaut: string): string {
  for (const nom of noms) {
    const valeur = process.env[nom];
    if (valeur && valeur.trim()) return sansBarreFinale(valeur.trim());
  }
  return defaut;
}

export const URL_WEB = variable(['URL_WEB', 'TABIBI_WEB_URL'], 'http://localhost:4200');
export const URL_API = variable(['URL_API', 'TABIBI_API_URL'], 'http://localhost:8080');
export const ISSUER_KEYCLOAK = variable(['ISSUER_KEYCLOAK', 'TABIBI_KEYCLOAK_ISSUER'], 'http://localhost:8081/realms/tabibi');

/** Code de verification d'une ordonnance reellement emise par integration/scenario-api.mjs, s'il nous a ete transmis. */
export const CODE_ORDONNANCE = (process.env['CODE_ORDONNANCE'] || '').trim();

const chromeBin = process.env['CHROME_BIN'];

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  // La pile est reelle : un rendu cote serveur peut depasser son delai a la toute premiere requete.
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: URL_WEB,
    locale: 'fr-FR',
    timezoneId: 'Africa/Algiers',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Le front et l'API sont sur localhost en clair : pas de certificat a valider.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Sans bac a sable : necessaire en conteneur (execution en root) ; sans effet ailleurs.
        launchOptions: { executablePath: chromeBin || undefined, chromiumSandbox: false },
      },
    },
  ],
});
