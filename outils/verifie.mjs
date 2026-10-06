/* Harnais de vérification du Carnet de Forme.
 *
 *   node outils/verifie.mjs
 *
 * Il ouvre la page dans Chromium avec un FAUX SERVEUR qui imite le vrai sur
 * les trois points qui ont causé les bugs les plus coûteux :
 *   - ses documents sont GELÉS, comme ceux que renvoie la capacité db ;
 *   - ses écritures sont LENTES, ce qui ouvre la fenêtre de course ;
 *   - il REDIFFUSE son état en boucle, ce qui écrasait les saisies.
 *
 * Un test qui passe sans ce faux serveur ne prouve rien : les trois défauts
 * n'apparaissaient que sur la version publiée.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'file://' + path.join(RACINE, 'perte-de-poids.html');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                   '-' + String(d.getDate()).padStart(2, '0');
const AUJ = ymd(new Date());

let reussis = 0, echecs = 0;
const verifie = (nom, ok, detail) => {
  if (ok) { reussis++; console.log('  ok   ' + nom); }
  else { echecs++; console.log('  ÉCHEC ' + nom + (detail ? ' — ' + detail : '')); }
};

const fauxServeur = (jour) => {
  localStorage.setItem('suz-forme-onglet', 'alim');
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const CLE = 'faux-serveur';
  const base = JSON.parse(sessionStorage.getItem(CLE) || 'null') || {
    'profil/moi': { prenom: 'Suzon', sexe: 'f', age: 29, taille: 168, depart: 77,
                    objectif: 66, debut: jour, activite: 1.375, rythme: 0.5, seances: 3,
                    freq: { 'Blanc de poulet': 12 }, perso: {} },
    ['jours/' + jour]: { date: jour, poids: 77, heure: '07:30', tour: null, eau: 0,
      repas: { petitdej: [], dejeuner: [], diner: [], collation: [] }, sport: [] }
  };
  const sauve = () => sessionStorage.setItem(CLE, JSON.stringify(base));
  sauve();
  const aboP = [], aboJ = [];
  const copie = (p) => gel(JSON.parse(JSON.stringify(base[p])));
  const jours = () => Object.keys(base).filter((p) => p.startsWith('jours/'))
                        .map((p) => ({ id: p.slice(6), data: () => copie(p) }));
  const diffP = () => aboP.forEach((n) => n({ exists: true, data: () => copie('profil/moi') }));
  const diffJ = () => aboJ.forEach((n) => n({ docs: jours() }));
  const db = {
    doc: (p) => ({
      set: (v) => new Promise((r) => setTimeout(() => {
        base[p] = JSON.parse(JSON.stringify(v)); sauve();
        p === 'profil/moi' ? diffP() : diffJ(); r();
      }, 600)),
      delete: () => Promise.resolve(),
      onSnapshot: (n) => {
        if (p === 'profil/moi') { aboP.push(n); setTimeout(diffP, 60); setInterval(diffP, 300); }
        return () => {};
      }
    }),
    collection: () => ({
      onSnapshot: (n) => { aboJ.push(n); setTimeout(diffJ, 70); setInterval(diffJ, 300); return () => {}; }
    })
  };
  const sample = () => {};
  sample.json = () => new Promise((r) => setTimeout(() => r({
    nom: 'Galette de sarrasin (artisanale)', kcal: 172, proteines: 5.1, glucides: 31.4,
    lipides: 3.2, portion_g: 120, portion_nom: '1 galette', confiance: 'moyenne',
    note: 'Valeur simulée par le harnais.'
  }), 200));
  sample.limits = () => Promise.resolve({ maxPromptBytes: 65536 });
  window.claude = { use: (n) => Promise.resolve(n === 'db' ? db : n === 'sample' ? sample : null) };
};

const nav = await chromium.launch({ executablePath: CHROME });

for (const largeur of [1000, 390]) {
  console.log('\n=== ' + largeur + ' px ===');
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 1000 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(fauxServeur, AUJ);
  await pg.goto(PAGE);
  await pg.waitForTimeout(1000);

  const banniere = () => pg.evaluate(() => !!document.querySelector('[role=alert]'));
  const total = () => pg.evaluate(() => document.getElementById('kcalMange').textContent);
  const contient = (t) => pg.evaluate((x) => document.getElementById('repasListe').textContent.includes(x), t);

  /* Une ligne de résultat doit se lire en entier : « Pâtes sèches, st… »
     ne dit pas sur quoi on clique. Et ce qu'on mange passe avant ce qu'il y
     avait dans le paquet. */
  await pg.fill('#foodSearch', 'pates');
  await pg.waitForTimeout(350);
  const noms = await pg.$$eval('#foodResults .rn', (e) => e.map((x) => x.textContent.trim()));
  verifie('le premier résultat est l\'aliment de base', noms[0] === 'Pâtes cuites', noms[0]);
  const iCuites = noms.findIndex((n) => /cuites/.test(n));
  const iCrues = noms.findIndex((n) => /crues/.test(n));
  verifie('le cuit passe avant le cru', iCuites !== -1 && (iCrues === -1 || iCuites < iCrues),
          iCuites + ' contre ' + iCrues);
  verifie('aucun nom n\'est tronqué', await pg.$$eval('#foodResults .rn',
    (e) => e.every((x) => x.scrollWidth <= x.clientWidth + 1)), '');
  verifie('la portion est dite quand elle n\'est pas 100 g',
    (await pg.textContent('#foodResults li:first-child .rq')).includes('1 assiette'),
    await pg.textContent('#foodResults li:first-child .rq'));

  // ajout depuis la recherche, avec des favoris venus du serveur gelé
  await pg.fill('#foodSearch', 'blanc de poulet');
  await pg.waitForTimeout(350);
  await pg.click('#foodResults button');
  await pg.click('#pickAdd');
  await pg.waitForTimeout(400);
  verifie('ajout depuis la recherche', await contient('Blanc de poulet'));
  verifie('aucune bannière d\'erreur', !(await banniere()));

  // l'ajout survit aux rediffusions du serveur
  await pg.waitForTimeout(1600);
  verifie('ajout conservé après rediffusions', await contient('Blanc de poulet'),
          'total ' + (await total()));

  // saisie libre, avec virgule décimale
  await pg.click('#libreBloc summary');
  await pg.fill('#libreNom', 'yaourt maison');
  await pg.fill('#libreKcal', '62,5');
  await pg.click('#libreAdd');
  await pg.waitForTimeout(400);
  verifie('saisie libre à virgule décimale', await contient('yaourt maison'));

  // pesée à virgule, puis persistance du profil
  await pg.click('#tab-poids');
  await pg.fill('#poidsInput', '76,4');
  await pg.click('#poidsSave');
  await pg.waitForTimeout(400);
  verifie('pesée enregistrée', (await pg.evaluate(() =>
    document.getElementById('toast').textContent)).includes('76,4'));

  await pg.click('#profilBtn');
  await pg.waitForTimeout(300);
  await pg.fill('#pTaille', '170');
  await pg.waitForTimeout(2400);
  verifie('profil non écrasé par le serveur',
    (await pg.evaluate(() => document.getElementById('pTaille').value)) === '170');

  await pg.reload();
  await pg.waitForTimeout(1300);
  verifie('profil conservé au rechargement',
    (await pg.evaluate(() => document.getElementById('pTaille').value)) === '170');

  // séance de sport aux unités Strava
  await pg.click('#tab-sport');
  await pg.fill('#sportDist', '8,42');
  await pg.fill('#sportDuree', '45:12');
  await pg.waitForTimeout(300);
  verifie('allure calculée depuis la distance',
    (await pg.evaluate(() => document.getElementById('sportApercu').innerText)).includes('5:22'));

  // pas de débordement horizontal, sur tous les onglets
  let deborde = false;
  for (const t of ['alim', 'poids', 'sport']) {
    await pg.click('#tab-' + t);
    await pg.waitForTimeout(300);
    if (await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) deborde = true;
  }
  verifie('aucun débordement horizontal', !deborde);
  verifie('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await ctx.close();
}

/* Sous la moyenne, les pesées reliées une à une, en orange pâle. Tant que la
   courbe ne lisse pas, elle passe déjà par chaque pesée : pas de doublon. */
console.log('\n=== la courbe pesée par pesée ===');
const courbe = async (n) => {
  const ctx = await nav.newContext({ viewport: { width: 430, height: 1000 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([auj, nb]) => {
    const jour = (k) => new Date(Date.parse(auj + 'T12:00:00Z') - k * 86400000).toISOString().slice(0, 10);
    const jours = {};
    for (let i = 0; i <= nb; i++) {
      const d = jour(nb - i);
      jours[d] = { date: d, poids: +(78 - i * 0.07 + Math.sin(i * 1.3) * 0.45).toFixed(1), heure: '07:30',
                   eau: 0, sport: [], repas: { petitdej: [], dejeuner: [], diner: [], collation: [] } };
    }
    localStorage.setItem('suz-forme-onglet', 'poids');
    localStorage.setItem('suz-forme-v1', JSON.stringify({
      profil: { prenom: 'Suzon', sexe: 'f', age: 29, taille: 168, depart: 78, objectif: 66, debut: jour(nb),
                fin: '2027-04-08', activite: 1.375, rythme: 0.5, seances: 3, freq: {}, perso: {}, plats: {} },
      jours }));
  }, [AUJ, n]);
  await pg.goto(PAGE);
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(() => {
    const b = document.querySelector('#chartHolder .courbe-brute');
    return { pts: b ? b.getAttribute('points').trim().split(/\s+/).length : 0,
             legende: document.getElementById('chartLegend').textContent };
  });
  await ctx.close();
  return Object.assign(r, { erreurs });
};
const longue = await courbe(22);
verifie('la moyenne a sa courbe pesée par pesée', longue.pts === 23, String(longue.pts));
verifie('et la légende la nomme', longue.legende.includes('Pesée par pesée'), longue.legende);
verifie('sans tiret cadratin dans la légende', !longue.legende.includes('\u2014'), longue.legende);
const courte = await courbe(3);
verifie('pas de doublon tant que la courbe ne lisse pas', courte.pts === 0 &&
        !courte.legende.includes('Pesée par pesée'), courte.pts + ' / ' + courte.legende);
verifie('aucune erreur sur la courbe', !longue.erreurs.length && !courte.erreurs.length,
        longue.erreurs.concat(courte.erreurs).join(' | '));

/* « Je me suis pesée ce matin à 76,0, pourquoi on me dit 76,3 ? » La barre
   de parcours affichait la moyenne sous le mot « toi », sans le dire. Les
   pesées ci-dessous sont celles de Suzon : 76,0 le jour même, 76,3 de
   moyenne sur sept jours. */
console.log('\n=== mon parcours part de la balance ===');
{
  const ctx = await nav.newContext({ viewport: { width: 430, height: 1000 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([auj]) => {
    const jour = (k) => new Date(Date.parse(auj + 'T12:00:00Z') - k * 86400000).toISOString().slice(0, 10);
    const kgs = [77.2, 76.9, 76.6, 76.5, 76.4, 76.2, 76.3, 76.1, 76.0];
    const jours = {};
    kgs.forEach((kg, i) => {
      const d = jour(8 - i);
      jours[d] = { date: d, poids: kg, heure: '07:50', eau: 0, sport: [],
                   repas: { petitdej: [], dejeuner: [], diner: [], collation: [] } };
    });
    localStorage.setItem('suz-forme-onglet', 'poids');
    localStorage.setItem('suz-forme-v1', JSON.stringify({
      profil: { prenom: 'Suzon', sexe: 'f', age: 29, taille: 168, depart: 77.2, objectif: 60, debut: jour(8),
                fin: '2027-04-08', activite: 1.375, rythme: 0.5, seances: 3, freq: {}, perso: {}, plats: {} },
      jours }));
  }, [AUJ]);
  await pg.goto(PAGE);
  await pg.waitForTimeout(900);
  const barre = (await pg.textContent('#parcours')).replace(/\s+/g, ' ');
  const ecart = (await pg.textContent('#ecartJour')).replace(/\s+/g, ' ');
  verifie('« toi » est la pesée du jour, pas la moyenne', /toi\s*76,0 kg/.test(barre), barre);
  verifie('les kilos restants partent de la balance',
          (await pg.textContent('#parcoursHint')) === '16,0 kg restants', await pg.textContent('#parcoursHint'));
  // « Je veux une comparaison à la pesée du jour, pas à la moyenne. »
  // Prévu 76,6 ce jour-là, pesée 76,0 : 0,6 kg d'avance, pas 0,3.
  verifie('l\'écart se mesure sur la pesée du jour', ecart.startsWith('−0,6 kg'), ecart);
  verifie('et le verdict aussi', ecart.includes('En avance sur la trajectoire') &&
          ecart.includes('Tu es 0,6 kg sous la courbe prévue'), ecart);
  verifie('la phrase nomme la pesée du jour', ecart.includes('ta pesée du jour : 76,0 kg'), ecart);
  verifie('la moyenne n\'y est plus mêlée', !ecart.includes('moyenne'), ecart);
  verifie('aucune erreur sur le parcours', !erreurs.length, erreurs.join(' | '));
  await ctx.close();
}

await nav.close();
console.log('\n' + reussis + ' vérifications passées, ' + echecs + ' en échec');
process.exit(echecs ? 1 : 0);
