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
// 13 séries : 23:27 de séries et de repos à 3,5 MET = 105 kcal, plus le
// travail de la charge et du corps déplacé avec, 38 kcal. Total 144.
t('la dépense vaut le temps travaillé plus la masse déplacée', s1.k === 144, String(s1.k));
t('chaque machine a compté dès la première', paliers[0] > 0 && paliers.every((v, i) => i === 0 || v > paliers[i - 1]), JSON.stringify(paliers));

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
// 3 km en 20 min = 9 km/h. ACSM : (0,2 x 150 + 3,5) x 77 / 1000 x 5 x 20 = 258 kcal,
// qui s'ajoutent aux 141 de la fonte.
t('la dépense se recalcule depuis le contenu', s2.k === 402, String(s2.k));
const resume = await p.textContent('.exo-vol');
t('le résumé dit le partage', resume.includes('20:00 de cardio') && resume.includes('258 kcal'), resume);
t('et ce que la masse déplacée ajoute', resume.includes('5 040 kg de charge'), resume);

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
// Le temps travaillé vient des séries, pas de la durée : rallonger le
// séjour ne gonfle plus rien.
t('rallonger le séjour ne gonfle pas la dépense', s3.k === 402, String(s3.k));
t('et les minutes oisives sont dites', (await p.textContent('.exo-vol')).includes('sans rien soulever'), await p.textContent('.exo-vol'));
t('et la durée est retenue', s3.m === 90, String(s3.m));

console.log('=== retirer une ligne recompte ===');
await p.click('[data-del-exo="0"][data-i="4"]');
await p.waitForTimeout(400);
const s4 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('le cardio retiré, la séance redevient de la fonte', s4.ex.length === 4 && !s4.ex.some(x => x.t === 'cardio'), JSON.stringify(s4.ex.length));
// il ne reste que la fonte : 141.
t('et la dépense suit', s4.k === 144, String(s4.k));

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
// 3 séries de 30 ajoutent 8:15 de travail : 141 devient 178.
t('sans charge, le temps de travail compte quand même', s5.k === 181, String(s5.k));

// une séance énorme se fait plafonner
await p.fill('#exoNom', 'Squat à la barre');
await p.fill('#exoSeries', '25');
await p.fill('#exoReps', '10');
await p.fill('#exoPoids', '200');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const s6 = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
// 75:27 de travail, 339 kcal de temps plus 496 de masse déplacée = 835,
// au-dessus du plafond de 6 MET sur les 90 min sur place, 693 kcal.
t('le plafond de 6 MET tient', s6.k === 693, String(s6.k));
t('et il est annoncé', (await p.textContent('.exo-vol')).includes('plafonné à 6 MET'), await p.textContent('.exo-vol'));

console.log('=== modifier une ligne sans la supprimer ===');
await p.click('[data-edit-exo="0"][data-i="0"]');
await p.waitForTimeout(250);
t('le formulaire s\'ouvre sur la ligne', await p.isVisible('#exoNom'));
t('il est pré-rempli', (await p.inputValue('#exoNom')) === 'Presse à cuisses' &&
  (await p.inputValue('#exoPoids')) === '45', await p.inputValue('#exoNom') + ' / ' + await p.inputValue('#exoPoids'));
await p.fill('#exoPoids', '50');
await p.click('[data-exo-ok]');
await p.waitForTimeout(400);
const sM = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0], auj);
t('la ligne est corrigée, pas dupliquée', sM.ex.length === 6 && sM.ex[0].kg === 50, JSON.stringify(sM.ex.map(x => x.n + ':' + x.kg)));
t('le formulaire se referme après une correction', !(await p.$('#exoNom')));

console.log('=== une ligne de cardio se corrige aussi ===');
const iCardio = await p.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].ex.findIndex(x => x.t === 'cardio'), auj);
t('il n\'y a plus de cardio à ce stade', iCardio === -1, String(iCardio));

console.log('=== jambes et bras ne coûtent pas pareil ===');
const memeSerie = async (nom, kg) => {
  const c2 = await b.newContext({ viewport: { width: 1100, height: 950 }, ignoreHTTPSErrors: true });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => { ko++; console.log('  ÉCHEC erreur JavaScript — ' + e.message); });
  await p2.addInitScript(([d, n, k]) => {
    localStorage.setItem('suz-forme-onglet', 'sport');
    localStorage.setItem('suz-forme-v1', JSON.stringify({
      profil: { prenom:'Suzon', sexe:'f', age:29, taille:168, depart:77, objectif:66, debut:d,
                fin:'2027-04-08', activite:1.375, rythme:0.5, seances:3, freq:{}, perso:{}, plats:{} },
      jours: { [d]: { date:d, poids:77, heure:'07:30', eau:0,
        sport:[{ n:'Musculation', m:60, met:0, k:0, ex:[{ n:n, s:4, r:10, kg:k }] }],
        repas:{ petitdej:[], dejeuner:[], diner:[], collation:[] } } }
    }));
  }, [auj, nom, kg]);
  await p2.goto('file:///home/user/Suz/perte-de-poids.html');
  await p2.waitForTimeout(700);
  await p2.dispatchEvent('.salle-duree', 'change');
  await p2.waitForTimeout(350);
  const v = await p2.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].k, auj);
  await c2.close();
  return v;
};
const kSquat = await memeSerie('Squat à la barre', 40);
const kCurl = await memeSerie('Curl biceps barre', 40);
const kMollet = await memeSerie('Mollets debout', 40);
const kTract = await memeSerie('Tractions', 0);
const kInconnu = await memeSerie('Bidule à ressorts', 40);
t('à charge égale, le squat coûte plus que le curl', kSquat > kCurl, kSquat + ' contre ' + kCurl);
t('le mollet, à faible amplitude, coûte peu', kMollet < kSquat, kMollet + ' contre ' + kSquat);
t('des tractions ne valent pas zéro', kTract > kCurl * 0.9 && kTract > 40, String(kTract));
t('une machine inconnue prend une valeur neutre', kInconnu > kCurl && kInconnu < kSquat, String(kInconnu));

console.log('=== trois heures sur place ne valent pas trois heures de travail ===');
// Contexte neuf par cas : recharger la page rejouerait le script d'amorce
// et réécraserait l'état qu'on vient de poser.
const troisHeures = async (machines) => {
  const c2 = await b.newContext({ viewport: { width: 1100, height: 950 }, ignoreHTTPSErrors: true });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => { ko++; console.log('  ÉCHEC erreur JavaScript — ' + e.message); });
  await p2.addInitScript(([d, ms]) => {
    localStorage.setItem('suz-forme-onglet', 'sport');
    localStorage.setItem('suz-forme-v1', JSON.stringify({
      profil: { prenom:'Suzon', sexe:'f', age:29, taille:168, depart:77, objectif:66, debut:d,
                fin:'2027-04-08', activite:1.375, rythme:0.5, seances:3, freq:{}, perso:{}, plats:{} },
      jours: { [d]: { date:d, poids:77, heure:'07:30', eau:0,
        sport:[{ n:'Musculation', m:180, met:0, k:0, ex:ms }],
        repas:{ petitdej:[], dejeuner:[], diner:[], collation:[] } } }
    }));
  }, [auj, machines]);
  await p2.goto('file:///home/user/Suz/perte-de-poids.html');
  await p2.waitForTimeout(700);
  await p2.dispatchEvent('.salle-duree', 'change');
  await p2.waitForTimeout(400);
  const k = await p2.evaluate(d => JSON.parse(localStorage.getItem('suz-forme-v1')).jours[d].sport[0].k, auj);
  const note = await p2.textContent('.exo-vol');
  await c2.close();
  return { k: k, note: note };
};
const unSeul = await troisHeures([{ n:'Presse à cuisses', s:3, r:12, kg:40 }]);
const gros = [];
for (let i = 0; i < 20; i++) gros.push({ n:'Machine ' + i, s:3, r:10, kg:40 });
const beaucoup = await troisHeures(gros);
t('un seul exercice en trois heures reste modeste', unSeul.k === 37, String(unSeul.k));
t('soixante séries dans le même temps valent bien plus', beaucoup.k === 634, String(beaucoup.k));
t('l\'écart est net, pas cosmétique', beaucoup.k > unSeul.k * 10, unSeul.k + ' contre ' + beaucoup.k);
t('le temps oisif est annoncé', unSeul.note.includes('2:54:27 sur place sans rien soulever'), unSeul.note);

await b.close();
console.log('\n' + ok + ' vérifications passées, ' + ko + ' en échec');
process.exit(ko ? 1 : 0);
