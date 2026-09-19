#!/usr/bin/env node
/**
 * Scenario d'integration reel de Tabibi : API + Keycloak + PostgreSQL, sans simulateur.
 *
 * Il obtient de vrais jetons aupres de Keycloak (Resource Owner Password sur le client public tabibi-web, autorise
 * dans le realm de developpement seulement) pour les comptes de demonstration, puis enchaine le parcours complet
 * d'un rendez-vous a travers l'API, telle qu'elle tourne en conteneur avec sa base :
 *   identite (/api/moi et roles), ouverture d'un creneau par le medecin, publication du medecin dans l'annuaire
 *   (candidature + validation par l'administrateur, si l'annuaire ne le connait pas encore : en profil postgres
 *   l'annuaire demarre vide), reservation par le patient, notification, rendez-vous honore, avis verifie et synthese
 *   publique, ordonnance et verification publique par code, refus d'un acces hors role (403) et sans jeton (401).
 *
 * Node 20 ou plus, aucune dependance (fetch natif). Chaque etape affiche OK ou ECHEC ; le script s'arrete au premier
 * echec avec le code de sortie 1. Variables : TABIBI_API_URL (http://localhost:8080), TABIBI_KEYCLOAK_ISSUER
 * (http://localhost:8081/realms/tabibi), TABIBI_ATTENTE_S (delai maximal d'attente du demarrage, 240 s).
 *
 *   node integration/scenario-api.mjs
 */

const API = sansBarreFinale(process.env.TABIBI_API_URL || 'http://localhost:8080');
const ISSUER = sansBarreFinale(process.env.TABIBI_KEYCLOAK_ISSUER || 'http://localhost:8081/realms/tabibi');
const URL_JETON = `${ISSUER}/protocol/openid-connect/token`;
const CLIENT_ID = 'tabibi-web';
const ATTENTE_MAX_MS = Number(process.env.TABIBI_ATTENTE_S || 240) * 1000;

/** Comptes de demonstration du realm de tabibi-backend (identifiants fixes : sujet du jeton = identifiant metier). */
const COMPTES = {
  medecin: { utilisateur: 'medecin.demo', motDePasse: 'medecin', role: 'MEDECIN', id: '00000000-0000-0000-0000-000000000001' },
  patient: { utilisateur: 'patient.demo', motDePasse: 'patient', role: 'PATIENT', id: '11111111-1111-1111-1111-111111111111' },
  admin: { utilisateur: 'admin.demo', motDePasse: 'admin', role: 'ADMIN', id: '33333333-3333-3333-3333-333333333333' },
};

/** Fiche publique deposee pour medecin.demo : la meme que le premier praticien de demonstration de l'annuaire en memoire. */
const CANDIDATURE_MEDECIN = {
  nomComplet: 'Dr Amina Belkacem',
  specialiteSlug: 'cardiologue',
  specialiteFr: 'Cardiologue',
  wilayaCode: '16',
  wilayaFr: 'Alger',
  ville: 'Alger-Centre',
  numeroOrdre: 'ORD-16-0001',
  telephone: '0550000001',
};

// ---------------------------------------------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------------------------------------------

function sansBarreFinale(url) {
  return url.replace(/\/+$/, '');
}

class Echec extends Error {}

/** Interrompt l'etape courante avec un message d'echec si la condition est fausse. */
function verifier(condition, message) {
  if (!condition) throw new Echec(message);
}

let numero = 0;

/** Execute une etape nommee, affiche OK ou ECHEC, et arrete le scenario au premier echec (code de sortie 1). */
async function etape(nom, action) {
  numero += 1;
  const libelle = `${String(numero).padStart(2, '0')}. ${nom}`;
  try {
    const detail = await action();
    console.log(`OK     ${libelle}${detail ? ` : ${detail}` : ''}`);
  } catch (e) {
    const motif = e instanceof Echec ? e.message : `${e?.stack || e}`;
    console.log(`ECHEC  ${libelle} : ${motif}`);
    process.exit(1);
  }
}

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Attend qu'une URL reponde avec le statut voulu (demarrage des conteneurs) ; echoue apres ATTENTE_MAX_MS. */
async function attendre(url, statut, delaiMs = ATTENTE_MAX_MS) {
  const fin = Date.now() + delaiMs;
  let dernier = 'aucune reponse';
  while (Date.now() < fin) {
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (reponse.status === statut) return `${url} -> ${statut}`;
      dernier = `statut ${reponse.status}`;
    } catch (e) {
      dernier = e?.cause?.code || e?.name || String(e);
    }
    await pause(2000);
  }
  throw new Echec(`${url} ne repond pas ${statut} apres ${Math.round(delaiMs / 1000)} s (dernier etat : ${dernier})`);
}

/**
 * Appel de l'API : methode, chemin (relatif a l'API), jeton facultatif, corps JSON facultatif.
 * Renvoie { statut, corps } ; le corps est decode en JSON quand c'est possible, sinon laisse en texte.
 */
async function appel(methode, chemin, { jeton, corps } = {}) {
  const entetes = { Accept: 'application/json' };
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  const reponse = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
    signal: AbortSignal.timeout(30000),
  });
  const texte = await reponse.text();
  let decode = texte;
  try {
    decode = texte ? JSON.parse(texte) : null;
  } catch {
    // corps non JSON (page d'erreur, vide) : on garde le texte
  }
  return { statut: reponse.status, corps: decode };
}

/** Comme appel(), mais exige un statut precis : sinon l'etape echoue avec le corps de la reponse. */
async function appelAttendu(methode, chemin, statutAttendu, options = {}) {
  const r = await appel(methode, chemin, options);
  verifier(
    r.statut === statutAttendu,
    `${methode} ${chemin} : statut ${r.statut} au lieu de ${statutAttendu} (${resume(r.corps)})`,
  );
  return r.corps;
}

function resume(corps) {
  const texte = typeof corps === 'string' ? corps : JSON.stringify(corps);
  return texte && texte.length > 300 ? `${texte.slice(0, 300)}...` : texte;
}

/** Jeton d'acces par mot de passe (grant_type=password) sur le client public tabibi-web. */
async function jeton(compte) {
  const reponse = await fetch(URL_JETON, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: compte.utilisateur,
      password: compte.motDePasse,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const corps = await reponse.json().catch(() => ({}));
  verifier(reponse.status === 200, `jeton de ${compte.utilisateur} : statut ${reponse.status} (${resume(corps)})`);
  verifier(typeof corps.access_token === 'string' && corps.access_token.length > 0, `jeton de ${compte.utilisateur} absent`);
  return corps.access_token;
}

/** Charge utile d'un JWT (sans verification : la signature est le travail de l'API). */
function chargeUtile(jwt) {
  const partie = jwt.split('.')[1] || '';
  return JSON.parse(Buffer.from(partie, 'base64url').toString('utf8'));
}

// ---------------------------------------------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------------------------------------------

const jetons = {};
const etat = {};

console.log(`Scenario d'integration Tabibi : API ${API}, Keycloak ${ISSUER}`);

await etape("L'API repond sur /actuator/health", () => attendre(`${API}/actuator/health`, 200));

await etape('Le realm tabibi est importe dans Keycloak', () => attendre(`${ISSUER}`, 200));

await etape('Jetons Keycloak (grant password, client tabibi-web) pour medecin.demo, patient.demo, admin.demo', async () => {
  for (const [nom, compte] of Object.entries(COMPTES)) {
    jetons[nom] = await jeton(compte);
    const charge = chargeUtile(jetons[nom]);
    verifier(charge.sub === compte.id, `${compte.utilisateur} : sujet ${charge.sub} au lieu de ${compte.id}`);
    verifier(charge.iss === ISSUER, `${compte.utilisateur} : emetteur ${charge.iss} au lieu de ${ISSUER}`);
  }
  return `emetteur ${ISSUER}`;
});

await etape("GET /api/moi : l'API accepte les jetons et lit les roles du realm", async () => {
  const roles = [];
  for (const [nom, compte] of Object.entries(COMPTES)) {
    const moi = await appelAttendu('GET', '/api/moi', 200, { jeton: jetons[nom] });
    verifier(moi.sujet === compte.id, `${compte.utilisateur} : sujet ${moi.sujet}`);
    verifier(moi.nom === compte.utilisateur, `${compte.utilisateur} : nom ${moi.nom}`);
    verifier(Array.isArray(moi.roles) && moi.roles.includes(compte.role), `${compte.utilisateur} : roles ${JSON.stringify(moi.roles)}`);
    roles.push(`${compte.utilisateur}=${compte.role}`);
  }
  return roles.join(', ');
});

await etape('Sans jeton, /api/moi refuse (401)', async () => {
  await appelAttendu('GET', '/api/moi', 401);
});

await etape('Le medecin ouvre un creneau (POST /api/medecin/creneaux, 201) sans etre encore dans l\'annuaire', async () => {
  const debut = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  debut.setUTCMinutes(0, 0, 0);
  const creneau = await appelAttendu('POST', '/api/medecin/creneaux', 201, {
    jeton: jetons.medecin,
    corps: { debut: debut.toISOString(), dureeMinutes: 30 },
  });
  verifier(typeof creneau.id === 'string', `creneau sans identifiant : ${resume(creneau)}`);
  verifier(creneau.medecinId === COMPTES.medecin.id, `medecinId ${creneau.medecinId}`);
  verifier(creneau.disponible === true, 'le creneau ouvert devrait etre disponible');
  etat.creneau = creneau;
  return `creneau ${creneau.id} le ${creneau.debut}`;
});

await etape('Le patient voit le creneau (GET /api/medecins/{id}/creneaux)', async () => {
  const creneaux = await appelAttendu('GET', `/api/medecins/${COMPTES.medecin.id}/creneaux`, 200, { jeton: jetons.patient });
  verifier(Array.isArray(creneaux), `liste attendue : ${resume(creneaux)}`);
  const vu = creneaux.find((c) => c.id === etat.creneau.id);
  verifier(vu, `le creneau ${etat.creneau.id} n'apparait pas parmi ${creneaux.length} creneau(x)`);
  verifier(vu.disponible === true, 'le creneau devrait etre disponible');
  return `${creneaux.length} creneau(x) disponible(s)`;
});

await etape("Le medecin est publie dans l'annuaire (fiche existante, ou candidature validee par l'administrateur)", async () => {
  const fiche = await appel('GET', `/api/medecins/${COMPTES.medecin.id}`);
  if (fiche.statut === 200) {
    etat.medecin = fiche.corps;
    return `fiche deja publiee : ${fiche.corps.nomComplet}`;
  }
  verifier(fiche.statut === 404, `GET /api/medecins/${COMPTES.medecin.id} : statut ${fiche.statut}`);

  const depot = await appel('POST', '/api/medecin/candidature', { jeton: jetons.medecin, corps: CANDIDATURE_MEDECIN });
  verifier(depot.statut === 201 || depot.statut === 409, `depot de candidature : statut ${depot.statut} (${resume(depot.corps)})`);
  let candidatureId = depot.statut === 201 ? depot.corps.id : null;
  if (!candidatureId) {
    // Candidature deja en attente (relance du scenario sur une pile conservee) : on la retrouve cote administrateur.
    const enAttente = await appelAttendu('GET', '/api/admin/candidatures?statut=EN_ATTENTE', 200, { jeton: jetons.admin });
    const mienne = enAttente.find((c) => c.medecinId === COMPTES.medecin.id);
    verifier(mienne, 'aucune candidature en attente pour medecin.demo alors que le depot repond 409');
    candidatureId = mienne.id;
  }
  const validee = await appelAttendu('POST', `/api/admin/candidatures/${candidatureId}/valider`, 200, { jeton: jetons.admin });
  verifier(validee.statut === 'VALIDEE', `statut ${validee.statut} apres validation`);
  etat.candidatureValidee = true;

  const publiee = await appelAttendu('GET', `/api/medecins/${COMPTES.medecin.id}`, 200);
  verifier(publiee.nomComplet === CANDIDATURE_MEDECIN.nomComplet, `nom ${publiee.nomComplet}`);
  etat.medecin = publiee;

  const notifications = await appelAttendu('GET', '/api/notifications/mes', 200, { jeton: jetons.medecin });
  verifier(notifications.some((n) => n.sujet === 'Candidature validee'), 'le medecin devrait etre notifie de la validation');
  return `candidature ${candidatureId} validee, fiche ${publiee.nomComplet} publiee, medecin notifie`;
});

await etape("L'annuaire public liste le medecin (GET /api/medecins, sans jeton)", async () => {
  const liste = await appelAttendu('GET', '/api/medecins', 200);
  verifier(liste.some((m) => m.id === COMPTES.medecin.id), `medecin.demo absent de l'annuaire (${liste.length} praticien(s))`);
  return `${liste.length} praticien(s) dans l'annuaire`;
});

await etape('Le patient reserve le creneau (POST /api/creneaux/{id}/reserver, 201)', async () => {
  const rdv = await appelAttendu('POST', `/api/creneaux/${etat.creneau.id}/reserver`, 201, { jeton: jetons.patient });
  verifier(typeof rdv.id === 'string', `rendez-vous sans identifiant : ${resume(rdv)}`);
  verifier(rdv.statut === 'CONFIRME', `statut ${rdv.statut}`);
  verifier(rdv.patientId === COMPTES.patient.id, `patientId ${rdv.patientId}`);
  verifier(rdv.medecinId === COMPTES.medecin.id, `medecinId ${rdv.medecinId}`);
  verifier(rdv.creneauId === etat.creneau.id, `creneauId ${rdv.creneauId}`);
  etat.rendezVous = rdv;
  return `rendez-vous ${rdv.id} ${rdv.statut}`;
});

await etape("Le creneau n'est plus propose, et une seconde reservation est refusee (409)", async () => {
  const creneaux = await appelAttendu('GET', `/api/medecins/${COMPTES.medecin.id}/creneaux`, 200);
  verifier(!creneaux.some((c) => c.id === etat.creneau.id), 'le creneau reserve est encore propose');
  const refus = await appelAttendu('POST', `/api/creneaux/${etat.creneau.id}/reserver`, 409, { jeton: jetons.patient });
  verifier(refus && typeof refus.erreur === 'string', `corps d'erreur attendu { erreur } : ${resume(refus)}`);
  return refus.erreur;
});

await etape('Le patient retrouve son rendez-vous (GET /api/rendezvous/mes)', async () => {
  const mes = await appelAttendu('GET', '/api/rendezvous/mes', 200, { jeton: jetons.patient });
  const trouve = mes.find((r) => r.id === etat.rendezVous.id);
  verifier(trouve, `rendez-vous ${etat.rendezVous.id} absent (${mes.length} rendez-vous)`);
  verifier(trouve.statut === 'CONFIRME', `statut ${trouve.statut}`);
  return `${mes.length} rendez-vous`;
});

await etape('Le patient et le medecin ont recu une notification (GET /api/notifications/mes non vide)', async () => {
  const patient = await appelAttendu('GET', '/api/notifications/mes', 200, { jeton: jetons.patient });
  verifier(Array.isArray(patient) && patient.length > 0, 'aucune notification pour le patient');
  verifier(patient.some((n) => n.sujet === 'Rendez-vous confirme'), `sujets : ${patient.map((n) => n.sujet).join(' | ')}`);
  verifier(patient.every((n) => n.destinataireId === COMPTES.patient.id), "une notification d'un autre destinataire est visible");
  const medecin = await appelAttendu('GET', '/api/notifications/mes', 200, { jeton: jetons.medecin });
  verifier(medecin.some((n) => n.sujet === 'Nouveau rendez-vous'), `sujets medecin : ${medecin.map((n) => n.sujet).join(' | ')}`);
  return `patient : ${patient.length}, medecin : ${medecin.length}`;
});

await etape('Le medecin honore le rendez-vous (POST /api/rendezvous/{id}/honorer)', async () => {
  const honore = await appelAttendu('POST', `/api/rendezvous/${etat.rendezVous.id}/honorer`, 200, { jeton: jetons.medecin });
  verifier(honore.statut === 'HONORE', `statut ${honore.statut}`);
  const agenda = await appelAttendu('GET', '/api/medecin/rendezvous', 200, { jeton: jetons.medecin });
  verifier(agenda.some((r) => r.id === etat.rendezVous.id && r.statut === 'HONORE'), "le rendez-vous honore n'est pas dans l'agenda");
  return 'HONORE';
});

await etape('Le patient depose un avis (POST /api/avis, 201)', async () => {
  const avis = await appelAttendu('POST', '/api/avis', 201, {
    jeton: jetons.patient,
    corps: { rendezVousId: etat.rendezVous.id, note: 5, commentaire: 'Consultation attentive, a l\'heure.' },
  });
  verifier(typeof avis.id === 'string', `avis sans identifiant : ${resume(avis)}`);
  verifier(avis.statut === 'PUBLIE', `statut ${avis.statut}`);
  verifier(avis.patientId === undefined, "la vue du patient ne doit pas repeter son identifiant");
  etat.avis = avis;
  return `avis ${avis.id} note 5`;
});

await etape('La synthese publique du medecin montre cet avis (GET /api/medecins/{id}/avis, sans jeton)', async () => {
  const synthese = await appelAttendu('GET', `/api/medecins/${COMPTES.medecin.id}/avis`, 200);
  verifier(synthese.nombre >= 1, `nombre ${synthese.nombre}`);
  const publie = synthese.avis.find((a) => a.id === etat.avis.id);
  verifier(publie, "l'avis depose n'est pas dans la synthese publique");
  verifier(publie.note === 5, `note ${publie.note}`);
  verifier(publie.patientId === undefined && publie.rendezVousId === undefined, 'la vue publique ne doit reveler ni patient ni rendez-vous');
  verifier(typeof synthese.moyenne === 'number', `moyenne ${synthese.moyenne}`);
  return `${synthese.nombre} avis, moyenne ${synthese.moyenne}`;
});

await etape('Le medecin redige une ordonnance (POST /api/ordonnances, 201)', async () => {
  const ordonnance = await appelAttendu('POST', '/api/ordonnances', 201, {
    jeton: jetons.medecin,
    corps: {
      patientId: COMPTES.patient.id,
      rendezVousId: etat.rendezVous.id,
      lignes: [{ medicament: 'Amlodipine 5 mg', posologie: '1 comprime le matin', duree: '30 jours' }],
    },
  });
  verifier(typeof ordonnance.codeVerification === 'string' && ordonnance.codeVerification.length > 0, `code absent : ${resume(ordonnance)}`);
  verifier(ordonnance.statut === 'EMISE', `statut ${ordonnance.statut}`);
  const mes = await appelAttendu('GET', '/api/ordonnances/mes', 200, { jeton: jetons.patient });
  verifier(mes.some((o) => o.id === ordonnance.id), "le patient ne voit pas l'ordonnance");
  etat.ordonnance = ordonnance;
  return `ordonnance ${ordonnance.id}, code ${ordonnance.codeVerification}`;
});

await etape('La verification publique de l\'ordonnance repond 200 (GET /api/ordonnances/verifier/{code}, sans jeton)', async () => {
  const resultat = await appelAttendu('GET', `/api/ordonnances/verifier/${encodeURIComponent(etat.ordonnance.codeVerification)}`, 200);
  verifier(resultat.valide === true, `valide ${resultat.valide}`);
  verifier(resultat.patientId === undefined && resultat.medecinId === undefined, 'la verification publique ne doit reveler personne');
  await appelAttendu('GET', '/api/ordonnances/verifier/XXXXXXXX', 404);
  return `valide, statut ${resultat.statut} ; code inconnu -> 404`;
});

await etape("L'ordonnance imprimable est un vrai PDF (GET /api/ordonnances/{id}/pdf, backend >= v0.23.0)", async () => {
  const reponse = await fetch(`${API}/api/ordonnances/${etat.ordonnance.id}/pdf`, {
    headers: { Authorization: `Bearer ${jetons.patient}` },
    signal: AbortSignal.timeout(30000),
  });
  if (reponse.status === 404) {
    return 'endpoint absent de cette version de l\'API (anterieure a v0.23.0) : etape sautee';
  }
  verifier(reponse.status === 200, `statut ${reponse.status}`);
  const type = reponse.headers.get('content-type') || '';
  verifier(type.startsWith('application/pdf'), `content-type ${type}`);
  const octets = Buffer.from(await reponse.arrayBuffer());
  verifier(octets.subarray(0, 5).toString('latin1') === '%PDF-', 'le corps ne commence pas par %PDF-');
  verifier(octets.length > 1000, `PDF trop petit : ${octets.length} octets`);
  return `${octets.length} octets, ${type}`;
});

await etape('Un acces hors role est refuse : patient sur /api/admin/statistiques (403), administrateur accepte (200)', async () => {
  await appelAttendu('GET', '/api/admin/statistiques', 403, { jeton: jetons.patient });
  await appelAttendu('POST', '/api/medecin/creneaux', 403, {
    jeton: jetons.patient,
    corps: { debut: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(), dureeMinutes: 30 },
  });
  const statistiques = await appelAttendu('GET', '/api/admin/statistiques', 200, { jeton: jetons.admin });
  verifier(typeof statistiques.candidaturesValidees === 'number', `statistiques inattendues : ${resume(statistiques)}`);
  if (etat.candidatureValidee) {
    verifier(statistiques.candidaturesValidees >= 1, `candidaturesValidees ${statistiques.candidaturesValidees}`);
  }
  return `candidatures validees : ${statistiques.candidaturesValidees}`;
});

console.log(`\nScenario termine : ${numero} etapes OK (API ${API}, Keycloak ${ISSUER}).`);
