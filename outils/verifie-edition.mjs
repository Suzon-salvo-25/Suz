/* Vérifie la modification d'une ligne de repas et la saisie libre.
 *
 *   node outils/verifie-edition.mjs
 *
 * Complète outils/verifie.mjs, qui couvre le stockage et la mise en page
 * mais pas ces deux parcours de saisie.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-Suz/6f3b596d-29a7-57f6-baff-3d0352d76890/scratchpad/';
const b64 = fs.readFileSync(S + 'fraunces.woff2').toString('base64');
const auj = new Date().toISOString().slice(0, 10);
let ok = 0, ko = 0;
const t = (nom, cond, det) => { if (cond) { ok++; console.log('  ok   ' + nom); }
  else { ko++; console.log('  ÉCHEC ' + nom + (det ? ' — ' + det : '')); } };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
p.on('pageerror', e => { ko++; console.log('  ÉCHEC erreur JavaScript — ' + e.message); });
await p.addInitScript(([d]) => {
  localStorage.setItem('suz-forme-onglet', 'alim');
  localStorage.setItem('suz-forme-v1', JSON.stringify({
    profil: { prenom:'Suzon', sexe:'f', age:29, taille:168, depart:77, objectif:66, debut:d,
              fin:'2027-04-08', activite:1.375, rythme:0.5, seances:3, freq:{}, perso:{} },
    jours: { [d]: { date:d, poids:77, heure:'07:30', tour:null, eau:0, sport:[],
      repas:{ petitdej:[{ n:'Riz blanc cuit', d:'150 g', k:195, p:4, g:42, l:0.5, gr:150 }],
              dejeuner:[], diner:[], collation:[] } } }
  }));
}, [auj]);
await p.goto('file:///home/user/Suz/perte-de-poids.html');
await p.addStyleTag({ content: "@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64," + b64 + ") format('woff2')}" });
await p.waitForTimeout(800);

const ouvreRepas = (k) => p.evaluate(x => {
  const d = document.querySelector('details.meal[data-repas="' + x + '"]');
  if (d && !d.open) d.open = true;
}, k);

console.log('=== modifier une ligne existante ===');
t('les repas sont repliés au départ', await p.evaluate(() =>
  [...document.querySelectorAll('details.meal')].every(d => !d.open)));
await ouvreRepas('petitdej');
await p.click('[data-edit-repas="petitdej"]');
await p.waitForTimeout(200);
t('le formulaire s\'ouvre', await p.isVisible('#editNom'));
t('la quantité est pré-remplie', (await p.inputValue('#editQte')) === '150', await p.inputValue('#editQte'));
await p.fill('#editQte', '200');
await p.waitForTimeout(150);
t('changer la quantité recalcule les calories', (await p.inputValue('#editKcal')) === '260', await p.inputValue('#editKcal'));
t('et recalcule les glucides', (await p.inputValue('#editGluc')).startsWith('56'), await p.inputValue('#editGluc'));
await p.click('[data-edit-ok]');
await p.waitForTimeout(400);
const txt = await p.textContent('#repasListe');
t('la ligne affiche la nouvelle valeur', txt.includes('260 kcal'), txt.slice(0, 90));
t('le formulaire est refermé', !(await p.isVisible('#editNom')));
const stock = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].repas.petitdej[0], auj);
t('enregistré sur l\'appareil', stock.k === 260 && stock.gr === 200, JSON.stringify(stock));

console.log('=== corriger une valeur à la main ===');
await p.click('[data-edit-repas="petitdej"]');
await p.waitForTimeout(200);
await p.fill('#editProt', '9,5');
await p.click('[data-edit-ok]');
await p.waitForTimeout(400);
const s2 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].repas.petitdej[0], auj);
t('la virgule décimale est acceptée', s2.p === 9.5, JSON.stringify(s2.p));

console.log('=== saisie libre avec macros ===');
await p.click('#libreBloc summary');
await p.fill('#libreNom', 'Compote pomme vanille');
await p.fill('#libreKcal', '60');
await p.selectOption('#libreBase', '100');
await p.fill('#libreQte', '120');
await p.fill('#libreProt', '0,4');
await p.fill('#libreGluc', '14,2');
await p.fill('#libreLip', '0,2');
await p.click('#libreAdd');
await p.waitForTimeout(400);
const s3 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].repas.petitdej, auj);
const c = s3.find(x => x.n.startsWith('Compote'));
t('l\'aliment libre est ajouté', !!c);
t('ses macros sont retenues', c && c.g === 17 && c.p === 0.5, JSON.stringify(c));
t('sa quantité est retenue', c && c.gr === 120, c && String(c.gr));
await ouvreRepas('petitdej');
await p.click('[data-edit-repas="petitdej"][data-i="1"]');
await p.waitForTimeout(200);
t('un aliment libre s\'édite aussi', await p.isVisible('#editKcal'));
t('sans champ quantité, il n\'est pas dans la base', !(await p.isVisible('#editQte')));
await p.screenshot({ path: S + 'shots/edition.png', clip: { x: 0, y: 150, width: 1100, height: 620 } });

console.log('=== changer une ligne de repas ===');
await ouvreRepas('petitdej');
await p.click('[data-edit-repas="petitdej"][data-i="0"]');
await p.waitForTimeout(200);
t('le formulaire porte un choix de repas', await p.isVisible('#editRepas'));
t('il montre le repas actuel', (await p.inputValue('#editRepas')) === 'petitdej', await p.inputValue('#editRepas'));
await p.selectOption('#editRepas', 'collation');
await p.click('[data-edit-ok]');
await p.waitForTimeout(400);
const s4 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].repas, auj);
t('la ligne a quitté le petit-déjeuner', !s4.petitdej.some(x => x.n === 'Riz blanc cuit'), JSON.stringify(s4.petitdej.map(x => x.n)));
t('elle est arrivée dans la collation', s4.collation.some(x => x.n === 'Riz blanc cuit'), JSON.stringify(s4.collation.map(x => x.n)));
t('ses valeurs ont suivi', (s4.collation.find(x => x.n === 'Riz blanc cuit') || {}).k === 260,
  JSON.stringify(s4.collation.find(x => x.n === 'Riz blanc cuit')));
t('le total du jour ne bouge pas', (await p.textContent('#repasTotal')).includes('332'), await p.textContent('#repasTotal'));

console.log('=== plus de niveau d\'activité, la marche fait l\'objectif ===');
await p.evaluate(() => document.getElementById('profilBtn').click());
await p.waitForTimeout(400);
t('le réglage a disparu', !(await p.$('#pActivite')));
await p.evaluate(() => document.querySelector('[data-tab="alim"]').click());
await p.waitForTimeout(400);
// femme, 29 ans, 168 cm, 77 kg : Mifflin donne 1514 kcal, × 1,15 = 1741,
// déficit 550, donc 1191, sous le plancher de 1200.
const objSans = await p.evaluate(() => document.getElementById('kcalCible').textContent);
t('sans kilomètres, l\'objectif tombe au plancher', objSans.replace(/\s/g, '').includes('1200'), objSans);
t('et l\'en-tête dit quoi faire', (await p.textContent('#alimHint')).includes('Note tes kilomètres'), await p.textContent('#alimHint'));

console.log('=== les kilomètres de la journée ===');
await p.evaluate(() => document.querySelector('[data-tab="sport"]').click());
await p.waitForTimeout(300);
t('la carte des kilomètres est là', await p.isVisible('#marcheKm'));
t('aucune durée ne lui est demandée', !(await p.isVisible('#marcheKm ~ #sportDuree')));
await p.fill('#marcheKm', '6,4');
await p.waitForTimeout(150);
// 0,5 kcal par kg et par km, à 77 kg : 6,4 x 77 x 0,5 = 246
t('les calories suivent 0,5 kcal/kg/km', (await p.textContent('#marcheKcal')) === '246', await p.textContent('#marcheKcal'));
await p.click('#marcheSave');
await p.waitForTimeout(400);
const s5 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport, auj);
t('la marche est enregistrée sans durée', s5.length === 1 && s5[0].jour === 1 && s5[0].m === 0, JSON.stringify(s5));
await p.evaluate(() => document.querySelector('[data-tab="alim"]').click());
await p.waitForTimeout(400);
// 1741 + 246 − 550 = 1437, le plancher ne joue plus
const objAvec = await p.evaluate(() => document.getElementById('kcalCible').textContent);
t('les kilomètres font monter l\'objectif', objAvec.replace(/\s/g, '').includes('1437'), objAvec);
await p.evaluate(() => document.querySelector('[data-tab="sport"]').click());
await p.waitForTimeout(300);
t('sa distance est retenue', s5[0].d === 6.4, String(s5[0] && s5[0].d));
await p.fill('#marcheKm', '9,1');
await p.click('#marcheSave');
await p.waitForTimeout(400);
const s6 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport, auj);
t('un nouveau total remplace, il ne s\'ajoute pas', s6.length === 1 && s6[0].d === 9.1, JSON.stringify(s6));
const sem = await p.textContent('#sportStats');
t('elle ne compte pas comme une séance', /Séances<\/span><div class="big">0/.test(await p.innerHTML('#sportStats')), sem.slice(0, 120));
await p.click('#marcheDel');
await p.waitForTimeout(400);
const s7 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport, auj);
t('elle s\'efface', s7.length === 0, JSON.stringify(s7));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
