/* Vérifie le carnet d'exercices d'une séance de renforcement. */
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
p.on('dialog', d => { ko++; console.log('  ÉCHEC boîte native demandée'); d.dismiss(); });
await p.addInitScript(([d]) => {
  localStorage.setItem('suz-forme-onglet', 'sport');
  localStorage.setItem('suz-forme-v1', JSON.stringify({
    profil: { prenom:'Suzon', sexe:'f', age:29, taille:168, depart:77, objectif:66, debut:d,
              fin:'2027-04-08', activite:1.375, rythme:0.5, seances:3, freq:{}, perso:{}, plats:{} },
    jours: { [d]: { date:d, poids:77, heure:'07:30', tour:null, eau:0,
      sport:[{ n:'Musculation modérée', m:50, met:3.5, k:224 },
             { n:'Course à pied', m:30, met:9.8, k:368, d:5 }],
      repas:{ petitdej:[], dejeuner:[], diner:[], collation:[] } } }
  }));
}, [auj]);
await p.goto('file:///home/user/Suz/perte-de-poids.html');
await p.addStyleTag({ content: "@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64," + b64 + ") format('woff2')}" });
await p.waitForTimeout(800);

console.log('=== seules les séances de renfo se détaillent ===');
t('la musculation propose le carnet', await p.isVisible('[data-exo-seance="0"]'));
t('la course à pied non', !(await p.$('[data-exo-seance="1"]')));
t('le bouton invite à détailler', (await p.textContent('[data-exo-seance="0"]')).includes('Détailler'), await p.textContent('[data-exo-seance="0"]'));

console.log('=== noter une machine ===');
await p.click('[data-exo-seance="0"]');
await p.waitForTimeout(250);
t('le formulaire s\'ouvre', await p.isVisible('#exoNom'));
await p.fill('#exoNom', 'Presse à cuisses');
await p.fill('#exoSeries', '4');
await p.fill('#exoReps', '12');
await p.fill('#exoPoids', '45');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const e1 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].ex, auj);
t('l\'exercice est enregistré', e1 && e1.length === 1, JSON.stringify(e1));
t('avec ses séries, reps et poids', e1[0].n === 'Presse à cuisses' && e1[0].s === 4 && e1[0].r === 12 && e1[0].kg === 45, JSON.stringify(e1[0]));
t('la ligne l\'affiche', (await p.textContent('#sportListe')).includes('4 × 12'), '');
t('et le poids aussi', (await p.textContent('#sportListe')).includes('45 kg'), '');
t('le formulaire reste ouvert pour le suivant', await p.isVisible('#exoNom'));
t('le nom est vidé', (await p.inputValue('#exoNom')) === '', await p.inputValue('#exoNom'));
t('les séries sont gardées', (await p.inputValue('#exoSeries')) === '4', await p.inputValue('#exoSeries'));

console.log('=== poids du corps, et volume ===');
await p.fill('#exoNom', 'Gainage');
await p.fill('#exoSeries', '3');
await p.fill('#exoReps', '30');
await p.fill('#exoPoids', '');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
t('un exercice sans poids passe', (await p.textContent('#sportListe')).includes('poids du corps'), '');
// 4 x 12 x 45 = 2160, le gainage n'ajoute rien
t('le volume est le tonnage soulevé', (await p.textContent('.exo-vol')).replace(/\s/g, '').includes('2160kg'), await p.textContent('.exo-vol'));
t('la séance annonce ses exercices', (await p.textContent('#sportListe')).includes('2 exercices'), '');
t('les calories n\'ont pas bougé', (await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].k, auj)) === 224);

console.log('=== corriger et refermer ===');
await p.click('[data-exo-annule]');
await p.waitForTimeout(250);
t('annuler referme le formulaire', !(await p.isVisible('#exoNom')));
t('le bouton propose d\'en ajouter', (await p.textContent('[data-exo-seance="0"]')).includes('Ajouter'), await p.textContent('[data-exo-seance="0"]'));
await p.click('[data-del-exo="0"][data-i="1"]');
await p.waitForTimeout(400);
const e2 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].ex, auj);
t('un exercice se retire', e2.length === 1 && e2[0].n === 'Presse à cuisses', JSON.stringify(e2));

console.log('=== la séance emporte son carnet ===');
await p.click('[data-del-sport="0"]');
await p.waitForTimeout(400);
const sp = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport, auj);
t('supprimer la séance emporte ses exercices', sp.length === 1 && sp[0].n === 'Course à pied', JSON.stringify(sp.map(x => x.n)));
t('aucun carnet ne reste affiché', !(await p.$('[data-exo-seance]')));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
