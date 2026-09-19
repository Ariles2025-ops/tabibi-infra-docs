import { APIRequestContext, Page, Response } from '@playwright/test';
import { URL_API } from '../playwright.config';

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
