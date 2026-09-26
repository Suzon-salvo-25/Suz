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
const paliers = [];
for (const [nom, se, re, kg] of [['Presse à cuisses','4','12','45'], ['Leg extension','3','12','30'],
                                 ['Tirage vertical','3','10','35'], ['Développé couché','3','10','25']]) {
  await p.fill('#exoNom', nom);
  await p.fill('#exoSeries', se);
  await p.fill('#exoReps', re);
  await p.fill('#exoPoids', kg);
  await p.click('[data-exo-ok]');
  await p.waitForTimeout(300);
  paliers.push(await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].k, auj));
}
const s1 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('les quatre machines sont notées', s1.ex.length === 4, JSON.stringify(s1.ex.map(x => x.n)));
// 60 min à 3,5 MET pour 77 kg = 270 kcal, plus 5 040 kg soulevés à
// 0,0071 kcal/kg = 36 kcal. Total 305.
t('la dépense vaut le temps plus la fonte déplacée', s1.k === 305, String(s1.k));
t('chaque machine a compté dès la première', paliers[0] > 270 && paliers.every((v, i) => i === 0 || v >= paliers[i - 1]), JSON.stringify(paliers));

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
// Reste 40 min de fonte à 3,5 MET = 180, plus 36 de fonte déplacée = 215.
t('la dépense se recalcule depuis le contenu', s2.k === 473, String(s2.k));
const resume = await p.textContent('.exo-vol');
t('le résumé dit le partage', resume.includes('20:00 de cardio') && resume.includes('258 kcal'), resume);
t('et ce que la fonte déplacée ajoute', resume.includes('5 040 kg soulevés pour 36 kcal'), resume);

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
// 90 min dont 20 de cardio : 70 min de fonte à 3,5 MET = 314, plus 36 = 350.
// Avec les 258 du tapis : 608.
t('rallonger la séance rallonge la fonte', s3.k === 608, String(s3.k));
t('et la durée est retenue', s3.m === 90, String(s3.m));

console.log('=== retirer une ligne recompte ===');
await p.click('[data-del-exo="0"][data-i="4"]');
await p.waitForTimeout(400);
const s4 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('le cardio retiré, la séance redevient de la fonte', s4.ex.length === 4 && !s4.ex.some(x => x.t === 'cardio'), JSON.stringify(s4.ex.length));
// 90 min de fonte à 3,5 MET = 404, plus 36 de fonte déplacée = 440.
t('et la dépense suit', s4.k === 440, String(s4.k));

console.log('=== le poids du corps, et le plafond ===');
await p.click('[data-exo-seance="0"]');
await p.waitForTimeout(250);
await p.fill('#exoNom', 'Gainage');
await p.fill('#exoSeries', '3');
await p.fill('#exoReps', '30');
await p.fill('#exoPoids', '');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const s5 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('le poids du corps reste accepté', s5.ex[4].kg === 0, JSON.stringify(s5.ex[4]));
// Rien de déplacé : la dépense ne bouge pas, le temps le comptait déjà.
t('sans charge, le temps suffisait déjà', s5.k === 440, String(s5.k));

// une séance énorme se fait plafonner
await p.fill('#exoNom', 'Squat à la barre');
await p.fill('#exoSeries', '25');
await p.fill('#exoReps', '10');
await p.fill('#exoPoids', '200');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const s6 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
// 404 + (5 040 + 50 000) x 0,0071 = 795, au-dessus du plafond de 6 MET
// sur 90 min, 693 kcal.
t('le plafond de 6 MET tient', s6.k === 693, String(s6.k));
t('et il est annoncé', (await p.textContent('.exo-vol')).includes('plafonné à 6 MET'), await p.textContent('.exo-vol'));

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
