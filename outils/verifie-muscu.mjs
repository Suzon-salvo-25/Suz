/* Vérifie la séance de salle : carnet d'exercices, cardio à l'intérieur,
 * et dépense calculée depuis ce qui a été fait.
 *
 *   node outils/verifie-muscu.mjs
 */
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
    jours: { [d]: { date:d, poids:77, heure:'07:30', eau:0,
      sport:[{ n:'Musculation', m:60, met:3.5, k:270 },
             { n:'Course à pied', m:30, met:9.8, k:368, d:5 }],
      repas:{ petitdej:[], dejeuner:[], diner:[], collation:[] } } }
  }));
}, [auj]);
await p.goto('file:///home/user/Suz/perte-de-poids.html');
await p.addStyleTag({ content: "@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64," + b64 + ") format('woff2')}" });
await p.waitForTimeout(800);

console.log('=== une seule musculation, plus de « modérée » ni « intense » ===');
const choix = await p.$$eval('#sportSel option', e => e.map(o => o.textContent));
t('« Musculation » est proposée', choix.includes('Musculation'), '');
t('« Musculation modérée » ne l\'est plus', !choix.includes('Musculation modérée'), '');
t('« Musculation intense » non plus', !choix.includes('Musculation intense'), '');

console.log('=== la séance de salle porte sa durée et son carnet ===');
t('le carnet est proposé', await p.isVisible('[data-exo-seance="0"]'));
t('la durée est corrigeable', await p.isVisible('.salle-duree'));
t('une sortie course n\'a pas de carnet', !(await p.$('[data-exo-seance="1"]')));
await p.click('[data-exo-seance="0"]');
await p.waitForTimeout(250);
t('le formulaire s\'ouvre en mode fonte', await p.isVisible('#exoSeries'));
t('les machines sont suggérées', (await p.$$eval('#exoListe option', e => e.map(o => o.value))).includes('Presse à cuisses'), '');

console.log('=== la fonte ===');
// 4 x 12 + 3 x 12 + 3 x 10 + 3 x 10 = 144 répétitions
for (const [nom, se, re, kg] of [['Presse à cuisses','4','12','45'], ['Leg extension','3','12','30'],
                                 ['Tirage vertical','3','10','35'], ['Développé couché','3','10','25']]) {
  await p.fill('#exoNom', nom);
  await p.fill('#exoSeries', se);
  await p.fill('#exoReps', re);
  await p.fill('#exoPoids', kg);
  await p.click('[data-exo-ok]');
  await p.waitForTimeout(300);
}
const s1 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('les quatre machines sont notées', s1.ex.length === 4, JSON.stringify(s1.ex.map(x => x.n)));
// 144 reps x 3 s = 7,2 min sur 60 min de fonte, densité 0,12 : sous le seuil,
// donc 3,5 MET. 3,5 x 77 x 1 h = 270 kcal.
t('sans cardio, tout le temps est de la fonte', s1.k === 270, String(s1.k));

console.log('=== le cardio dans la séance ===');
await p.fill('#exoNom', 'Tapis de course');
await p.waitForTimeout(300);
t('une machine de cardio bascule le formulaire', await p.isVisible('#exoDuree'));
t('les champs de fonte ont disparu', !(await p.$('#exoSeries')));
await p.fill('#exoDuree', '20:00');
await p.fill('#exoDist', '3');
await p.waitForTimeout(250);
t('l\'allure se déduit de la durée et de la distance', (await p.inputValue('#exoAllure')) === '6:40', await p.inputValue('#exoAllure'));
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const s2 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
const c = s2.ex.find(x => x.t === 'cardio');
t('la ligne de cardio est enregistrée', !!c && c.m === 20 && c.d === 3, JSON.stringify(c));
// 3 km en 20 min = 9 km/h. ACSM : (0,2 x 150 + 3,5) x 77 / 1000 x 5 x 20 = 258 kcal.
// Reste 40 min de fonte, 144 reps = 7,2 min sous charge, densité 0,18,
// MET 3,8, soit 195 kcal. Total 453.
t('la dépense se recalcule depuis le contenu', s2.k === 453, String(s2.k));
const resume = await p.textContent('.exo-vol');
t('le résumé dit le partage', resume.includes('20:00 de cardio') && resume.includes('258 kcal'), resume);
t('et le MET retenu pour la fonte', resume.includes('3,8 MET'), resume);

console.log('=== l\'allure seule suffit ===');
await p.fill('#exoNom', 'Tapis de course');
await p.waitForTimeout(250);
await p.fill('#exoDuree', '10:00');
await p.fill('#exoAllure', '5:00');
await p.waitForTimeout(250);
t('la distance se déduit de l\'allure', (await p.inputValue('#exoDist')) === '2', await p.inputValue('#exoDist'));
await p.click('[data-exo-annule]');
await p.waitForTimeout(250);

console.log('=== corriger le temps passé à la salle ===');
await p.fill('.salle-duree', '1:30:00');
await p.dispatchEvent('.salle-duree', 'change');
await p.waitForTimeout(400);
const s3 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
// 90 min dont 20 de cardio : 70 min de fonte, densité 0,103, sous le seuil,
// donc 3,5 MET, soit 314 kcal. Avec les 258 du tapis : 572.
t('rallonger la séance rallonge la fonte', s3.k === 572, String(s3.k));
t('et la durée est retenue', s3.m === 90, String(s3.m));

console.log('=== retirer une ligne recompte ===');
await p.click('[data-del-exo="0"][data-i="4"]');
await p.waitForTimeout(400);
const s4 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('le cardio retiré, la séance redevient de la fonte', s4.ex.length === 4 && !s4.ex.some(x => x.t === 'cardio'), JSON.stringify(s4.ex.length));
// 90 min de fonte, densité 0,08 : 3,5 MET, 404 kcal.
t('et la dépense suit', s4.k === 404, String(s4.k));

console.log('=== une séance dense monte le MET ===');
await p.click('[data-exo-seance="0"]');
await p.waitForTimeout(250);
await p.fill('#exoNom', 'Crunch');
await p.fill('#exoSeries', '20');
await p.fill('#exoReps', '40');
await p.fill('#exoPoids', '');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const s5 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
// 144 + 800 = 944 reps, 47,2 min sous charge sur 90, densité 0,524 : plafond
// à 6 MET, soit 693 kcal.
t('au-delà du seuil, le MET plafonne à 6', s5.k === 693, String(s5.k));
t('le poids du corps reste accepté', s5.ex[4].kg === 0, JSON.stringify(s5.ex[4]));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
