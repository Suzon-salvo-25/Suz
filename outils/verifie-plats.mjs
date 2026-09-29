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

const ouvreRepas = (k) => p.evaluate(x => {
  const d = document.querySelector('details.meal[data-repas="' + x + '"]');
  if (d && !d.open) d.open = true;
}, k);

console.log('=== les raccourcis ne tiennent que l\'historique ===');
t('les pastilles ont disparu', !(await p.$('#favoris')));
const grp = await p.$$eval('#favSel optgroup', e => e.map(o => o.label));
t('aucune famille piochée dans la base', grp.length === 0, JSON.stringify(grp));
t('un dîner seul ne remplit pas le menu', !(await p.isVisible('#favSel')), 'le menu devrait rester caché');

// on note deux aliments au petit-déjeuner et un en collation
await ouvreRepas('petitdej');
await p.selectOption('#foodRepas', 'petitdej');
for (const [nom, q] of [['Pain de mie', '2'], ['Yaourt nature', '1']]) {
  await p.fill('#foodSearch', nom);
  await p.waitForTimeout(350);
  await p.click('#foodResults button');
  await p.fill('#pickQte', q);
  await p.click('#pickAdd');
  await p.waitForTimeout(350);
}
await p.selectOption('#foodRepas', 'collation');
await p.fill('#foodSearch', 'Amande');
await p.waitForTimeout(350);
await p.click('#foodResults button');
await p.click('#pickAdd');
await p.waitForTimeout(400);
await p.fill('#foodSearch', '');
await p.waitForTimeout(200);

const opts = await p.$$eval('#favSel option', e => e.map(o => o.value).filter(Boolean));
t('le menu apparaît', await p.isVisible('#favSel'));
t('il porte le petit-déjeuner noté', opts.includes('Pain de mie') && opts.includes('Yaourt nature'), JSON.stringify(opts));
t('et la collation notée', opts.includes('Amande'), JSON.stringify(opts));
t('rien du dîner n\'y entre', !opts.includes('Pâtes cuites') && !opts.includes('Flan au caramel'), JSON.stringify(opts));
t('rien d\'autre non plus', opts.length === 3, JSON.stringify(opts));
// tous notés une fois : à égalité, l'ordre est alphabétique
t('à égalité, l\'ordre est alphabétique', opts.join(',') === 'Amande,Pain de mie,Yaourt nature', JSON.stringify(opts));

// reposer un raccourci de la base rouvre le choix de quantité
await p.selectOption('#favSel', 'Amande');
await p.waitForTimeout(300);
t('choisir un raccourci propose la quantité', await p.isVisible('#pickAdd'));
await p.click('#pickAdd');
await p.waitForTimeout(400);
const opts2 = await p.$$eval('#favSel option', e => e.map(o => o.value).filter(Boolean));
t('repris deux fois, il passe devant', opts2[0] === 'Amande', JSON.stringify(opts2));
t('et n\'apparaît qu\'une fois', opts2.filter(o => o === 'Amande').length === 1, JSON.stringify(opts2));

console.log('=== le filtre de type a disparu ===');
t('plus de « Type de produit »', !(await p.$('[data-filtre]')));
t('la recherche marche toujours', await (async () => {
  await p.fill('#foodSearch', 'yaourt');
  await p.waitForTimeout(350);
  return (await p.$$('#foodResults li')).length > 0;
})());
await p.fill('#foodSearch', '');
await p.waitForTimeout(250);
t('le menu des plats est caché tant qu\'il n\'y en a pas', !(await p.isVisible('#platSel')));


console.log('=== enregistrer un repas comme plat ===');
t('un repas replié cache son contenu', !(await p.isVisible('[data-plat-repas="diner"]')));
t('mais son résumé dit ce qu\'il porte', (await p.textContent('details.meal[data-repas="diner"] summary')).includes('4 aliments'),
  await p.textContent('details.meal[data-repas="diner"] summary'));
await ouvreRepas('diner');
t('le dîner propose d\'en faire un plat', await p.isVisible('[data-plat-repas="diner"]'));
t('un repas vide ne le propose pas', !(await p.isVisible('[data-plat-repas="dejeuner"]')));
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
t('le total du jour grimpe du plat posé', /\d/.test(await p.textContent('#repasTotal')), await p.textContent('#repasTotal'));

console.log('=== la recette est une copie, pas un renvoi ===');
await ouvreRepas('dejeuner');
await p.click('[data-edit-repas="dejeuner"][data-i="0"]');
await p.waitForTimeout(250);
await p.fill('#editKcal', '400');
await p.click('[data-edit-ok]');
await p.waitForTimeout(400);
const pr2 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('corriger la ligne ne réécrit pas le plat', pr2['Pâtes au jambon'].items[0].k === 262, String(pr2['Pâtes au jambon'].items[0].k));

console.log('=== gérer ses plats ===');
t('la gestion est à côté du menu', await p.isVisible('#platsGere'));
t('elle est repliée au départ', !(await p.evaluate(() => document.getElementById('platsGere').open)));
await p.evaluate(() => document.querySelector('#platsGere summary').click());
await p.waitForTimeout(250);
t('le plat y est listé', (await p.textContent('#platsGestion')).includes('Pâtes au jambon'));
t('avec ses aliments en clair', (await p.textContent('#platsGestion')).includes('Jambon blanc'));

// aucune boîte native : elles ne s'ouvrent pas dans l'iframe de l'artefact
let boites = 0;
p.on('dialog', d => { boites++; d.dismiss(); });

console.log('=== modifier un plat ===');
await p.click('[data-edit-plat]');
await p.waitForTimeout(250);
t('le formulaire s\'ouvre', await p.isVisible('#platEditNom'));
t('le nom est pré-rempli', (await p.inputValue('#platEditNom')) === 'Pâtes au jambon', await p.inputValue('#platEditNom'));
t('chaque aliment porte sa croix', (await p.$$('[data-plat-retire]')).length === 3, String((await p.$$('[data-plat-retire]')).length));
await p.click('[data-plat-retire="2"]');
await p.waitForTimeout(250);
t('retirer un aliment le sort du formulaire', (await p.$$('[data-plat-retire]')).length === 2);
t('le total du formulaire suit', (await p.textContent('.plat-edit .edit-aide')).includes('316 kcal'), await p.textContent('.plat-edit .edit-aide'));
await p.fill('#platEditNom', 'Pâtes jambon simple');
await p.click('[data-plat-enr]');
await p.waitForTimeout(400);
const pm = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('le plat est renommé', !!pm['Pâtes jambon simple'] && !pm['Pâtes au jambon'], JSON.stringify(Object.keys(pm)));
t('et allégé de son aliment', pm['Pâtes jambon simple'].items.length === 2, JSON.stringify(pm['Pâtes jambon simple'].items.map(x => x.n)));
t('le menu reprend le nouveau nom', (await p.textContent('#platSel')).includes('Pâtes jambon simple'));

console.log('=== supprimer un plat ===');
await p.click('[data-del-plat]');
await p.waitForTimeout(250);
t('la question se pose dans la ligne', await p.isVisible('[data-del-oui]'));
await p.click('[data-del-non]');
await p.waitForTimeout(300);
const pr3 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('annuler garde le plat', !!pr3['Pâtes jambon simple'], JSON.stringify(Object.keys(pr3)));
t('la ligne revient à la normale', !(await p.isVisible('[data-del-oui]')));

await p.click('[data-del-plat]');
await p.waitForTimeout(250);
await p.click('[data-del-oui]');
await p.waitForTimeout(400);
const pr4 = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')).profil.plats);
t('confirmer le supprime', !pr4['Pâtes jambon simple'], JSON.stringify(Object.keys(pr4)));
t('le menu des plats disparaît avec lui', !(await p.isVisible('#platSel')));
t('et le bloc de gestion aussi', !(await p.isVisible('#platsGere')));
t('aucune boîte native n\'a été demandée', boites === 0, String(boites));

console.log('=== « Tout effacer » se confirme aussi dans la page ===');
await p.evaluate(() => document.getElementById('profilBtn').click());
await p.waitForTimeout(400);
await p.click('#wipeBtn');
await p.waitForTimeout(250);
t('la confirmation apparaît', await p.isVisible('#wipeOui'));
await p.click('#wipeNon');
await p.waitForTimeout(250);
t('annuler la referme', !(await p.isVisible('#wipeOui')) && (await p.isVisible('#wipeBtn')));
await p.click('#wipeBtn');
await p.click('#wipeOui');
await p.waitForTimeout(500);
const vide = await p.evaluate(() => JSON.parse(localStorage.getItem('suz-forme-v1')));
t('confirmer efface tout', Object.keys(vide.jours).length === 0, JSON.stringify(Object.keys(vide.jours)));
t('toujours aucune boîte native', boites === 0, String(boites));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
