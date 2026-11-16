import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APIRequestContext, Page, Response, expect } from '@playwright/test';
import { URL_API, URL_WEB } from '../playwright.config';

/** Fiche publique d'un praticien, telle que la renvoie GET /api/medecins de l'API reelle. */
export interface Medecin {
  id: string;
  nomComplet: string;
  specialiteSlug: string;
  specialiteFr: string;
  wilayaCode: string;
  wilayaFr: string;
  ville: string;
}

/**
 * Ouvre une page et attend l'hydratation : le HTML rendu par le serveur est affiche avant que le JavaScript ne
 * s'execute, et un clic ou une saisie faits trop tot sont perdus (le formulaire de l'annuaire, par exemple, ferait
 * une soumission native et rechargerait la page). Angular retire l'attribut `ngh` de `<app-root>` une fois
 * l'application hydratee : c'est le signal attendu. Renvoie la reponse HTTP de la navigation (statut).
 */
export async function ouvrir(page: Page, url: string): Promise<Response | null> {
  const reponse = await page.goto(url);
  await page.locator('app-root:not([ngh])').waitFor();
  return reponse;
}

/**
 * Interroge l'API REELLE (celle que le front appelle) pour construire les attentes des tests a partir des vraies
 * donnees : aucune liste de praticiens, de specialites ou d'identifiants n'est codee en dur ici. Echoue avec un
 * message explicite si l'API ne repond pas 200 : c'est alors la pile, pas le front, qui est en cause.
 */
export async function lireApi<T>(chemin: string): Promise<T> {
  const url = `${URL_API}${chemin}`;
  const reponse = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  const texte = await reponse.text();
  if (reponse.status !== 200) {
    throw new Error(`GET ${url} : statut ${reponse.status} au lieu de 200 (${resume(texte)})`);
  }
  try {
    return JSON.parse(texte) as T;
  } catch {
    throw new Error(`GET ${url} : reponse non JSON (${resume(texte)})`);
  }
}

/** L'annuaire public de l'API reelle, filtre facultativement par specialite (le meme filtre que le formulaire). */
export async function praticiens(specialiteSlug?: string): Promise<Medecin[]> {
  const filtre = specialiteSlug ? `?specialite=${encodeURIComponent(specialiteSlug)}` : '';
  return lireApi<Medecin[]>(`/api/medecins${filtre}`);
}

/**
 * HTML brut d'une page, sans navigateur : c'est la preuve du rendu cote serveur (le JavaScript n'a pas tourne).
 * Le serveur de rendu renvoie la page sans rendu plutot qu'une erreur quand il depasse son delai (server.ts de
 * tabibi-web) : on reessaie tant que le marqueur attendu n'est pas la, comme le faisait le controle en curl.
 */
export async function htmlRendu(
  request: APIRequestContext,
  chemin: string,
  marqueur: string,
  essais = 10,
): Promise<string> {
  let html = '';
  for (let essai = 1; essai <= essais; essai += 1) {
    const reponse = await request.get(chemin, { timeout: 30_000 });
    html = await reponse.text();
    if (html.includes(marqueur)) return html;
    if (essai < essais) await new Promise((suite) => setTimeout(suite, 3000));
  }
  return html;
}

function resume(texte: string): string {
  return texte && texte.length > 300 ? `${texte.slice(0, 300)}...` : texte;
}

/** Resultat ecrit par integration/scenario-api.mjs (voir son en-tete) : identifiants et donnees vivantes de la pile. */
export interface ResultatScenario {
  medecinId: string;
  rendezVousId: string;
  ordonnanceId: string;
  codeOrdonnance: string;
  secretaireRattachee?: boolean;
  besoinId?: string;
  besoinMedicament?: string;
  besoinWilayaCode?: string;
}

/** Lit FICHIER_RESULTAT (defaut integration/resultat-scenario.json) ; null si le scenario n'a pas ete joue. */
export function lireResultatScenario(): ResultatScenario | null {
  const chemin = process.env['FICHIER_RESULTAT'] || resolve(__dirname, '../../resultat-scenario.json');
  try {
    return JSON.parse(readFileSync(chemin, 'utf8')) as ResultatScenario;
  } catch {
    return null;
  }
}

/** Comptes de demonstration du realm tabibi (les memes que scenario-api.mjs). */
export const COMPTES = {
  medecin: { utilisateur: 'medecin.demo', motDePasse: 'medecin' },
  secretaire: { utilisateur: 'secretaire.demo', motDePasse: 'secretaire' },
  pharmacie: { utilisateur: 'pharmacie.demo', motDePasse: 'pharmacie' },
};

/**
 * Se connecte pour de vrai : ouvre `chemin` (page gardee) ; le front envoie vers le formulaire Keycloak du realm
 * tabibi, on y saisit le compte, puis Keycloak ramene sur `chemin`.
 *
 * Pre-lancement : en production la connexion mene a /bientot (PRELANCEMENT dans src/app/lancement.ts de tabibi-web).
 * On n'y touche pas : on utilise l'acces equipe prevu par ce meme fichier (cle localStorage « tabibi.equipe » a 1,
 * l'equivalent de https://.../?equipe=1) UNIQUEMENT dans le navigateur de test, donc seulement dans la pile
 * d'integration ; l'image du web et la valeur de production restent inchangees.
 */
export async function seConnecter(page: Page, compte: { utilisateur: string; motDePasse: string }, chemin: string): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tabibi.equipe', '1');
    } catch {
      // origine sans stockage : sans importance
    }
  });
  await page.goto(chemin);
  await page.locator('input[name="username"]').fill(compte.utilisateur, { timeout: 30_000 });
  await page.locator('input[name="password"]').fill(compte.motDePasse);
  await page.locator('input[name="password"]').press('Enter');
  const origineWeb = new URL(URL_WEB).origin;
  await page.waitForURL((url) => url.origin === origineWeb && url.pathname.startsWith(chemin), { timeout: 30_000 });
  await page.locator('app-root:not([ngh])').waitFor();
  expect(new URL(page.url()).pathname, 'redirige vers /bientot : le pre-lancement ferme encore la connexion').not.toBe('/bientot');
}
