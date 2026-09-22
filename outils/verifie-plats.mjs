/* Vérifie les plats enregistrés et les deux menus de raccourcis. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-Suz/6f3b596d-29a7-57f6-baff-3d0352d76890/scratchpad/';
const b64 = fs.readFileSync(S + 'fraunces.woff2').toString('base64');
const auj = new Date().toISOString().slice(0, 10);
let ok = 0, ko = 0;
const t = (n, c, d) => { if (c) { ok++; console.log('  ok   ' + n); } else { ko++; console.log('  ÉCHEC ' + n + (d ? ' — ' + d : '')); } };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1100, height: 950 }, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
p.on('pageerror', e => { ko++; console.log('  ÉCHEC erreur JavaScript — ' + e.message); });
await p.addInitScript(([d]) => {
  localStorage.setItem('suz-forme-onglet', 'alim');
  localStorage.setItem('suz-forme-v1', JSON.stringify({
    profil: { prenom:'Suzon', sexe:'f', age:29, taille:168, depart:77, objectif:66, debut:d,
              fin:'2027-04-08', activite:1.375, rythme:0.5, seances:3,
              freq:{ 'Riz blanc cuit': 4, 'Pomme': 2, 'Kiwi': 1 }, perso:{}, plats:{} },
    jours: { [d]: { date:d, poids:77, heure:'07:30', tour:null, eau:0, sport:[],
      repas:{ petitdej:[], collation:[],
              diner:[{ n:'Pâtes cuites', d:'200 g', k:262, p:9, g:52, l:1.4, gr:200 },
                     { n:'Jambon blanc', d:'50 g', k:54, p:10, g:0.5, l:1.5, gr:50 },
                     { n:'Emmental', d:'30 g', k:114, p:8.4, g:0, l:9, gr:30 },
                     { n:'Flan au caramel', d:'100 g', k:132, p:3.2, g:21, l:3.8, gr:100 }],
              dejeuner:[] } } }
  }));
}, [auj]);
await p.goto('file:///home/user/Suz/perte-de-poids.html');
await p.addStyleTag({ content: "@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64," + b64 + ") format('woff2')}" });
await p.waitForTimeout(800);

console.log('=== les raccourcis tiennent en deux menus ===');
t('les pastilles ont disparu', !(await p.$('#favoris')));
t('le menu des fréquents est là', await p.isVisible('#favSel'));
const opts = await p.$$eval('#favSel option', e => e.map(o => o.value));
t('seuls les aliments repris deux fois y entrent', opts.includes('Riz blanc cuit') && opts.includes('Pomme') && !opts.includes('Kiwi'), JSON.stringify(opts));
t('le menu des plats est caché tant qu\'il n\'y en a pas', !(await p.isVisible('#platSel')));

console.log('=== enregistrer un repas comme plat ===');
t('le dîner propose d\'en faire un plat', await p.isVisible('[data-plat-repas="diner"]'));
t('un repas vide ne le propose pas', !(await p.isVisible('[data-plat-repas="petitdej"]')));
await p.click('[data-plat-repas="diner"]');
await p.waitForTimeout(250);
t('le champ de nom s\'ouvre', await p.isVisible('#platNom'));
t('chaque ligne porte une case', (await p.$$('[data-plat-i]')).length === 4, String((await p.$$('[data-plat-i]')).length));
t('tout est coché au départ', (await p.$$eval('[data-plat-i]', e => e.every(x => x.checked))));
t('le résumé compte les lignes', (await p.textContent('#platResume')).includes('4 aliments retenus sur 4'), await p.textContent('#platResume'));
// le flan est un dessert, il ne fait pas partie du plat
await p.uncheck('[data-plat-i="3"]');
await p.waitForTimeout(150);
t('décocher met à jour le résumé', (await p.textContent('#platResume')).includes('3 aliments retenus sur 4'), await p.textContent('#platResume'));
t('et le total suit', (await p.textContent('#platResume')).includes('430 kcal'), await p.textContent('#platResume'));
await p.fill('#platNom', 'Pâtes au jambon');
await p.click('[data-plat-ok]');
await p.waitForTimeout(400);
const pr = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('le plat est enregistré', !!pr['Pâtes au jambon'], JSON.stringify(Object.keys(pr)));
t('il ne garde que les trois cochés', pr['Pâtes au jambon'].items.length === 3, JSON.stringify(pr['Pâtes au jambon'].items.map(x => x.n)));
t('le dessert décoché en est exclu', !pr['Pâtes au jambon'].items.some(x => x.n.startsWith('Flan')));
t('le menu des plats apparaît', await p.isVisible('#platSel'));
const po = await p.$$eval('#platSel option', e => e.map(o => o.textContent));
t('il annonce le total et le nombre', po.some(x => x.includes('430 kcal') && x.includes('3 aliments')), JSON.stringify(po));

console.log('=== reposer le plat dans un autre repas ===');
await p.selectOption('#foodRepas', 'dejeuner');
await p.selectOption('#platSel', 'Pâtes au jambon');
await p.waitForTimeout(500);
const j = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].repas, auj);
t('les trois lignes arrivent au déjeuner', j.dejeuner.length === 3, JSON.stringify(j.dejeuner.map(x => x.n)));
t('avec leurs valeurs', j.dejeuner[0].k === 262 && j.dejeuner[2].p === 8.4, JSON.stringify(j.dejeuner[0]));
t('le dîner n\'a pas bougé', j.diner.length === 4);
t('le menu se remet sur « Choisir »', (await p.inputValue('#platSel')) === '', await p.inputValue('#platSel'));
t('le total du jour suit', (await p.textContent('#repasTotal')).includes('992'), await p.textContent('#repasTotal'));

console.log('=== la recette est une copie, pas un renvoi ===');
await p.click('[data-edit-repas="dejeuner"][data-i="0"]');
await p.waitForTimeout(250);
await p.fill('#editKcal', '400');
await p.click('[data-edit-ok]');
await p.waitForTimeout(400);
const pr2 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('corriger la ligne ne réécrit pas le plat', pr2['Pâtes au jambon'].items[0].k === 262, String(pr2['Pâtes au jambon'].items[0].k));

console.log('=== supprimer un plat ===');
t('la suppression est à côté du menu', await p.isVisible('#platsGere'));
t('elle est repliée au départ', !(await p.evaluate(() => document.getElementById('platsGere').open)));
await p.evaluate(() => document.querySelector('#platsGere summary').click());
await p.waitForTimeout(250);
t('le plat y est listé', (await p.textContent('#platsGestion')).includes('Pâtes au jambon'));
t('avec ses aliments en clair', (await p.textContent('#platsGestion')).includes('Jambon blanc'));

// refuser la confirmation ne supprime rien
p.once('dialog', d => d.dismiss());
await p.click('[data-del-plat]');
await p.waitForTimeout(400);
const pr3 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('annuler la confirmation garde le plat', !!pr3['Pâtes au jambon'], JSON.stringify(Object.keys(pr3)));

p.once('dialog', d => d.accept());
await p.click('[data-del-plat]');
await p.waitForTimeout(400);
const pr4 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('confirmer le supprime', !pr4['Pâtes au jambon'], JSON.stringify(Object.keys(pr4)));
t('le menu des plats disparaît avec lui', !(await p.isVisible('#platSel')));
t('et le bloc de suppression aussi', !(await p.isVisible('#platsGere')));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
