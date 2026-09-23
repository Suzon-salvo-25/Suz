"""Génère le dossier PDF et la fiche d'oral de l'exposé Russie / pays occidentaux."""
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

LIB = "/usr/share/fonts/truetype/liberation/"
pdfmetrics.registerFont(TTFont("Serif", LIB + "LiberationSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Serif-B", LIB + "LiberationSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Serif-I", LIB + "LiberationSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Serif-BI", LIB + "LiberationSerif-BoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("Sans", LIB + "LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Sans-B", LIB + "LiberationSans-Bold.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Serif", normal="Serif", bold="Serif-B", italic="Serif-I", boldItalic="Serif-BI")
registerFontFamily("Sans", normal="Sans", bold="Sans-B", italic="Sans", boldItalic="Sans-B")

NAVY = colors.HexColor("#1F3A5F")
LIGHT = colors.HexColor("#EEF2F7")
GRID = colors.HexColor("#B8C4D3")

body = ParagraphStyle("body", fontName="Serif", fontSize=10.5, leading=14.5,
                      alignment=TA_JUSTIFY, spaceAfter=6)
h1 = ParagraphStyle("h1", fontName="Sans-B", fontSize=13, leading=16, textColor=NAVY,
                    spaceBefore=12, spaceAfter=6)
h2 = ParagraphStyle("h2", fontName="Sans-B", fontSize=11, leading=14, textColor=NAVY,
                    spaceBefore=8, spaceAfter=4)
title = ParagraphStyle("title", fontName="Sans-B", fontSize=18, leading=22,
                       textColor=NAVY, alignment=TA_CENTER, spaceAfter=6)
subtitle = ParagraphStyle("subtitle", fontName="Serif-I", fontSize=11.5, leading=15,
                          alignment=TA_CENTER, spaceAfter=4)
meta = ParagraphStyle("meta", fontName="Sans", fontSize=9.5, leading=12,
                      alignment=TA_CENTER, textColor=colors.HexColor("#444444"))
cell = ParagraphStyle("cell", fontName="Serif", fontSize=9, leading=11.5)
cellh = ParagraphStyle("cellh", fontName="Sans-B", fontSize=9, leading=11.5,
                       textColor=colors.white)
box = ParagraphStyle("box", parent=body, fontSize=10.5, alignment=0)
src = ParagraphStyle("src", fontName="Serif", fontSize=9, leading=12, leftIndent=12,
                     firstLineIndent=-12, spaceAfter=3)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=14, firstLineIndent=-10,
                        spaceAfter=3)
fn = ParagraphStyle("fn", fontName="Serif-I", fontSize=8.5, leading=11,
                    textColor=colors.HexColor("#444444"), spaceAfter=6)


def P(t, s=body):
    return Paragraph(t, s)


def B(t):
    return Paragraph("• " + t, bullet)


def table(rows, widths):
    data = [[Paragraph(c, cellh) for c in rows[0]]]
    data += [[Paragraph(c, cell) for c in r] for r in rows[1:]]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def framed(flowables):
    t = Table([[flowables]], colWidths=[16.6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.8, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def footer(label):
    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont("Sans", 8)
        canvas.setFillColor(colors.HexColor("#666666"))
        canvas.drawString(2.2 * cm, 1.2 * cm, label)
        canvas.drawRightString(A4[0] - 2.2 * cm, 1.2 * cm, f"{doc.page}")
        canvas.restoreState()
    return draw


# ---------------------------------------------------------------- dossier
def dossier(path):
    s = []
    s += [P("Russie / pays occidentaux", title),
          P("Profondeur stratégique, sécurité européenne et rivalités<br/>"
            "avec un éclairage comparatif : le Pakistan et ses voisins", subtitle),
          P("Dossier d'exposé — Nom : ______________________ — septembre 2026", meta),
          Spacer(1, 10)]

    s += [P("1. Introduction et problématique", h1),
          P("Depuis l'annexion de la Crimée en 2014, et surtout depuis l'invasion de l'Ukraine "
            "le 24 février 2022, la rivalité entre la Russie et les pays occidentaux est "
            "redevenue ouverte. Elle ne se limite pas à la guerre : elle touche l'influence sur "
            "les pays voisins, l'énergie, les valeurs et l'information. Chaque camp présente ses actes comme défensifs : Moscou "
            "dénonce un « encerclement » par l'OTAN, tandis que l'OTAN, l'Union européenne et "
            "les États d'Europe centrale y voient la politique d'une puissance révisionniste."),
          P("Le cas du Pakistan, de l'Inde et de l'Afghanistan, où la notion de « profondeur "
            "stratégique » est née comme doctrine officielle, permet de mieux comprendre cette "
            "logique et ses effets pervers : la rivalité indo-pakistanaise est l'exemple type "
            "d'une « rivalité durable » entre voisins."),
          framed([P("<b>Problématique :</b> sur quels terrains s'affrontent la Russie et "
                    "les pays occidentaux, et en quoi la quête de profondeur stratégique, "
                    "éclairée par le cas pakistanais, explique-t-elle cette rivalité durable "
                    "et ses risques d'escalade ?", box)]),
          P("<i>Méthode : ne pas moraliser d'abord, mais identifier les acteurs, les "
            "perceptions, les instruments et les risques d'escalade.</i>", fn)]

    s += [P("2. Notions clés", h1),
          table([
              ["Notion", "Définition", "Exemple"],
              ["Profondeur stratégique", "Capacité à absorber une pression grâce à la distance, "
               "au territoire, à des États-tampons ou à une défense en couches.",
               "Russie : garder l'Ukraine et la Biélorussie hors de l'OTAN. Pakistan : un "
               "Afghanistan « ami » face à l'Inde."],
              ["Puissance révisionniste", "Acteur qui cherche à changer un ordre, une frontière "
               "ou une architecture de sécurité existants.",
               "Annexion de la Crimée (2014) ; projets de traités russes de décembre 2021."],
              ["Rivalité durable", "Opposition prolongée entre deux États qui se voient "
               "mutuellement comme la principale menace ; les crises et guerres n'en sont que "
               "des épisodes (Goertz et Diehl, 1993).",
               "Inde / Pakistan depuis 1947 ; Russie / Occident, de la guerre froide à aujourd'hui."],
              ["Sanctions", "Restrictions imposant un coût sans recours direct à la force.",
               "20 paquets de sanctions de l'UE entre 2022 et avril 2026."],
              ["Dilemme de sécurité", "Ce qu'un État fait pour se protéger inquiète l'autre, "
               "qui réagit à son tour (Jervis, 1978).",
               "Élargissement de l'OTAN : défensif pour ses membres, menace pour Moscou."],
          ], [3.3 * cm, 6.8 * cm, 6.5 * cm])]

    s += [P("3. Clé de lecture : le Pakistan et ses voisins", h1),
          P("3.1. Une doctrine née d'un manque de profondeur", h2),
          P("Le Pakistan est un pays étiré et étroit : ses grandes villes et ses axes vitaux, "
            "comme Lahore située à une trentaine de kilomètres de la frontière indienne, sont "
            "proches de son rival. La rivalité avec l'Inde, née de la partition de 1947, est "
            "territoriale (Cachemire), identitaire (État musulman contre Inde laïque puis "
            "nationaliste hindoue) et stratégique ; elle a produit quatre guerres (1947, 1965, "
            "1971, 1999) et une course aux armements jusqu'aux essais nucléaires de 1998. À la fin des années 1980, l'armée pakistanaise, autour du général "
            "Mirza Aslam Beg, formule la doctrine de « profondeur stratégique » : un "
            "gouvernement ami à Kaboul sécuriserait la frontière ouest, exclurait l'Inde "
            "d'Afghanistan et offrirait un arrière-pays en cas de guerre. D'où le soutien aux "
            "talibans dès 1994."),
          P("3.2. Un effet boomerang", h2),
          P("Le retour des talibans au pouvoir en 2021 devait consacrer cette stratégie. C'est "
            "l'inverse qui se produit : Kaboul abrite le Tehrik-e-Taliban Pakistan (TTP), le "
            "terrorisme augmente au Pakistan et les affrontements frontaliers se multiplient "
            "depuis fin 2024. En octobre 2025, après plus d'une semaine de combats et des "
            "frappes pakistanaises jusqu'à Kaboul, un cessez-le-feu est conclu à Doha le 19 "
            "octobre sous médiation du Qatar et de la Turquie. Plusieurs analystes parlent "
            "désormais de passage « de la profondeur stratégique à l'impasse stratégique »."),
          P("3.3. Une rivalité durable entre deux puissances nucléaires", h2),
          P("Le 22 avril 2025, un attentat tue 26 personnes à Pahalgam, au Cachemire indien. "
            "L'Inde riposte le 7 mai par l'opération Sindoor (frappes sur neuf cibles au "
            "Pakistan et au Cachemire pakistanais), le Pakistan réplique, et un cessez-le-feu "
            "intervient le 10 mai. L'épisode montre comment, entre puissances nucléaires, un "
            "incident peut dégénérer très vite, mais aussi comment la dissuasion et la "
            "médiation extérieure finissent par freiner l'escalade. La rivalité, elle, demeure : "
            "comme entre la Russie et l'Occident, la crise se referme sans que sa cause soit réglée."),
          P("3.4. Ce que le cas pakistanais apprend sur la Russie", h2),
          table([
              ["Élément", "Pakistan / Afghanistan / Inde", "Russie / Ukraine / Occident"],
              ["Nature de la rivalité", "Territoriale et identitaire, depuis 1947 (Cachemire)",
               "Stratégique et idéologique : sphère d'influence contre libre choix, depuis 1991"],
              ["Peur de départ", "Pays étroit, rival indien proche et plus puissant",
               "Mémoire des invasions (1812, 1941), crainte de l'OTAN à ses frontières"],
              ["Quête de tampon", "Un Afghanistan « ami » comme arrière-pays",
               "Une Ukraine et une Biélorussie neutres ou alignées sur Moscou"],
              ["Moyens", "Soutien à des groupes armés (talibans)",
               "Guerre ouverte, annexions, pression hybride"],
              ["Effet boomerang", "Le tampon devient une menace (TTP, combats de 2025)",
               "La Finlande (2023) et la Suède (2024) rejoignent l'OTAN ; l'Europe se réarme"],
              ["Frein à l'escalade", "Dissuasion nucléaire, médiation (Qatar, Turquie, États-Unis)",
               "Dissuasion nucléaire, refus d'un affrontement direct OTAN-Russie, médiations"],
          ], [3.2 * cm, 6.5 * cm, 6.9 * cm]),
          Spacer(1, 4),
          P("<b>Leçon principale :</b> chercher de la profondeur stratégique en contrôlant "
            "un voisin produit souvent l'inverse de l'effet recherché, car le voisin et les "
            "tiers réagissent. <b>Limite de la comparaison :</b> la Russie est une grande "
            "puissance qui a envahi et annexé une partie d'un État souverain, ce que le "
            "Pakistan n'a pas fait en Afghanistan."),
          ]

    s += [P("4. Les terrains de rivalité Russie / Occident", h1),
          P("La rivalité se joue sur six terrains ; la guerre en Ukraine n'est que le plus "
            "visible, là où la rivalité est devenue conflit armé."),
          table([
              ["Terrain de rivalité", "Ce que veut la Russie", "Ce que veut l'Occident",
               "Manifestation concrète"],
              ["Stratégique et militaire",
               "Stopper l'élargissement de l'OTAN, retrouver un glacis",
               "Dissuader, défendre le flanc Est",
               "Guerre en Ukraine ; Finlande (2023) et Suède (2024) dans l'OTAN ; tensions en "
               "Baltique et au corridor de Suwałki"],
              ["Influence sur le voisinage commun",
               "Garder Ukraine, Biélorussie, Moldavie, Géorgie dans son orbite (Union économique "
               "eurasiatique)",
               "Ancrer ces pays à l'UE (candidatures de l'Ukraine et de la Moldavie, 2022)",
               "Biélorussie alignée sur Moscou ; bras de fer électoraux en Moldavie et en Géorgie"],
              ["Économique et énergétique",
               "Utiliser le gaz et le pétrole comme levier",
               "Réduire la dépendance, sanctionner",
               "20 paquets de sanctions UE ; sortie du gaz et du GNL russes ; avoirs gelés"],
              ["Idéologique : deux visions de l'ordre",
               "Ordre multipolaire, sphères d'influence, « valeurs traditionnelles »",
               "Ordre fondé sur des règles, démocratie libérale",
               "Discours de Munich (2007) ; Concept de politique étrangère russe (2023)"],
              ["Informationnelle et hybride",
               "Diviser les sociétés occidentales sous le seuil de la guerre",
               "Résilience, lutte contre la désinformation",
               "Ingérence dans l'élection roumaine (2024) ; drones sur la Pologne (sept. 2025) ; "
               "sabotages de câbles"],
              ["Influence dans le « Sud global »",
               "Se poser en alternative à l'Occident",
               "Garder ses partenaires, isoler Moscou",
               "Wagner puis Africa Corps au Sahel à la place de la France ; neutralité de l'Inde "
               "et de nombreux États africains"],
          ], [3.3 * cm, 4.2 * cm, 3.9 * cm, 5.2 * cm]),
          Spacer(1, 4),
          P("<b>Trois foyers d'escalade à surveiller :</b> l'Ukraine (guerre en cours, "
            "pas de cessez-le-feu formel en septembre 2026), la Baltique (Kaliningrad, flotte "
            "fantôme) et le nucléaire (fin du traité New START en février 2026, doctrine russe "
            "assouplie en 2024).")]

    s += [P("5. Quelle sécurité européenne ?", h1),
          P("Quatre options coexistent : la <b>dissuasion de l'OTAN</b> (objectif de 5 % du "
            "PIB d'ici 2035, dont 3,5 % pour la défense au sens strict, fixé au sommet de La "
            "Haye en juin 2025), l'<b>autonomie stratégique européenne</b>, l'<b>endiguement</b> "
            "par les sanctions et l'aide à l'Ukraine, et la <b>négociation</b>, aujourd'hui "
            "bloquée sur le territoire et les garanties de sécurité. En pratique, l'Europe "
            "combine dissuasion et endiguement ; comme dans le cas indo-pakistanais, la "
            "médiation de tiers reste le principal canal de désescalade.")]

    s += [P("6. Conclusion", h1),
          P("La rivalité Russie / Occident est une rivalité durable, fondée sur deux lectures "
            "opposées de la sécurité : la Russie cherche de la profondeur stratégique, ses "
            "voisins refusent d'être son glacis. Le cas pakistanais montre que cette quête, "
            "menée par le contrôle d'un voisin, crée souvent de nouvelles menaces au lieu de "
            "les réduire. La question reste ouverte : l'Europe peut-elle construire une "
            "sécurité durable sans la Russie, ou faudra-t-il un jour la reconstruire avec elle ?")]

    s += [P("Sources", h1),
          P("<i>Données récentes vérifiées par recherche web le 23 septembre 2026. Ouvrages et "
            "textes officiels cités selon leurs références usuelles.</i>", fn)]
    sources = [
        "Council on Foreign Relations, « Conflict Between India and Pakistan », Global Conflict "
        "Tracker : https://www.cfr.org/interactive/global-conflict-tracker/conflict/conflict-between-india-and-pakistan",
        "Congressional Research Service, « India-Pakistan Conflict in Spring 2025 », IF13000 : "
        "https://www.congress.gov/crs-product/IF13000",
        "CSIS, « What Led to the Recent Crisis Between India and Pakistan? », 2025 : "
        "https://www.csis.org/analysis/what-led-recent-crisis-between-india-and-pakistan",
        "Observer Research Foundation, « From Strategic Depth to Strategic Breakdown: The New "
        "Afghan-Pakistan Crisis » : https://www.orfonline.org/expert-speak/from-strategic-depth-to-strategic-breakdown-the-new-afghan-pakistan-crisis",
        "IISS, « The low-intensity conflict between Afghanistan and Pakistan », Strategic "
        "Comments, mai 2025 : https://www.iiss.org/publications/strategic-comments/2025/05/the-low-intensity-conflict-between-afghanistan-and-pakistan/",
        "FDD's Long War Journal, « Afghan Taliban, Pakistani military clash along the border », "
        "oct. 2025 : https://www.longwarjournal.org/archives/2025/10/afghan-taliban-pakistani-military-clash-along-the-border.php",
        "Al Jazeera, « Afghanistan, Pakistan agree to immediate ceasefire after talks in Doha », "
        "19 oct. 2025 : https://www.aljazeera.com/news/2025/10/19/afghanistan-pakistan-agree-to-immediate-ceasefire-after-talks-in-doha",
        "OTAN, Déclaration du sommet de La Haye, 25 juin 2025 : "
        "https://www.nato.int/en/about-us/official-texts-and-resources/official-texts/2025/06/25/the-hague-summit-declaration",
        "OSW, « NATO summit in The Hague: a two-component 5% of GDP », 26 juin 2025 : "
        "https://www.osw.waw.pl/en/publikacje/osw-commentary/2025-06-26/nato-summit-hague-trumps-return-and-a-two-component-5-gdp",
        "Conseil de l'UE, 19e paquet de sanctions, 23 oct. 2025 : "
        "https://www.consilium.europa.eu/en/press/press-releases/2025/10/23/19th-package-of-sanctions-against-russia-eu-targets-russian-energy-third-country-banks-and-crypto-providers/",
        "Conseil de l'UE, 20e paquet de sanctions, 23 avr. 2026 : "
        "https://www.consilium.europa.eu/en/press/press-releases/2026/04/23/russia-s-war-of-aggression-against-ukraine-20th-round-of-stern-eu-sanctions-hits-energy-military-industrial-complex-trade-and-financial-services-including-crypto/",
        "Al Jazeera, « Putin meets US envoys to discuss Trump proposal to end Ukraine war », "
        "5 sept. 2026 : https://www.aljazeera.com/news/2026/9/5/russias-putin-meets-us-envoys-to-discuss-trump-proposal-to-end-ukraine-war",
        "OTAN, Concept stratégique de Madrid, 29 juin 2022 ; V. Poutine, discours de Munich, "
        "10 févr. 2007 ; Assemblée générale de l'ONU, résolution ES-11/1, 2 mars 2022.",
        "J. Mearsheimer, « Why the Ukraine Crisis Is the West's Fault », <i>Foreign Affairs</i>, 2014.",
        "M. E. Sarotte, <i>Not One Inch</i>, Yale University Press, 2021.",
        "G. Goertz et P. Diehl, « Enduring Rivalries: Theoretical Constructs and Empirical "
        "Patterns », <i>International Studies Quarterly</i>, 37(2), 1993.",
        "R. Jervis, « Cooperation Under the Security Dilemma », <i>World Politics</i>, 30(2), 1978.",
        "A. Rashid, <i>Taliban</i>, Yale University Press, 2000 (sur le soutien pakistanais aux talibans).",
    ]
    for i, t in enumerate(sources, 1):
        s.append(P(f"[{i}] {t}", src))

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            topMargin=2 * cm, bottomMargin=2 * cm,
                            title="Russie / pays occidentaux - dossier d'exposé",
                            author="")
    f = footer("Russie / pays occidentaux : profondeur stratégique et sécurité européenne")
    doc.build(s, onFirstPage=f, onLaterPages=f)


# ---------------------------------------------------------------- oral
ORAL = [
    ("Accroche", "15 s",
     "Dans les années 1980, l'armée pakistanaise invente une doctrine : la « profondeur "
     "stratégique ». L'idée : contrôler l'Afghanistan pour avoir un arrière-pays face à l'Inde. "
     "Quarante ans plus tard, c'est la Russie qui applique cette logique à l'Ukraine. Et dans les deux cas, le résultat est le même : l'effet inverse de celui recherché."),
    ("Introduction", "25 s",
     "La profondeur stratégique, c'est la capacité d'absorber une menace grâce à la distance "
     "ou à des États-tampons. Moscou la recherche à l'Ouest ; les Occidentaux y voient une "
     "puissance révisionniste, qui veut changer les frontières par la force. Question : sur quels "
     "terrains s'affrontent ces rivaux, et que nous apprend le cas pakistanais ?"),
    ("1. Les terrains de rivalité", "45 s",
     "Cette rivalité se joue sur plusieurs terrains. Militaire d'abord : Moscou veut stopper "
     "l'élargissement de l'OTAN, l'Occident parle de libre choix des alliances ; en Ukraine, la "
     "rivalité est devenue guerre. Ensuite l'influence sur les voisins : Ukraine, Moldavie, "
     "Géorgie hésitent entre l'UE et la Russie. Puis l'énergie et les sanctions. Enfin les idées : "
     "un monde de sphères d'influence contre un ordre fondé sur des règles. Chaque camp se dit "
     "défensif et voit l'autre comme agressif : c'est le dilemme de sécurité."),
    ("2. La leçon pakistanaise", "40 s",
     "L'Inde et le Pakistan sont des rivaux depuis 1947. Pour tenir face à l'Inde, le Pakistan a "
     "soutenu les talibans pour avoir un Afghanistan ami. Résultat : les talibans "
     "abritent aujourd'hui les terroristes du TTP, et les deux pays se sont affrontés en octobre "
     "2025, jusqu'à un cessez-le-feu négocié à Doha. Même effet boomerang pour la Russie : en voulant éloigner l'OTAN, elle a poussé la "
     "Finlande et la Suède à y entrer. Et comme entre l'Inde et le Pakistan en mai 2025, la "
     "dissuasion nucléaire et les médiateurs sont ce qui freine l'escalade."),
    ("Conclusion", "20 s",
     "Chercher de la profondeur en contrôlant ses voisins crée de nouvelles menaces au lieu de "
     "les réduire. L'Europe, elle, se réarme, avec un objectif OTAN de 5 % du PIB, et multiplie les sanctions, déjà vingt paquets ; reste à savoir si elle construira sa "
     "sécurité contre la Russie, ou un jour avec elle. Merci."),
]

oral_txt = ParagraphStyle("oral", fontName="Serif", fontSize=12.5, leading=18,
                          alignment=0, spaceAfter=8)
oral_h = ParagraphStyle("oralh", fontName="Sans-B", fontSize=11.5, leading=14,
                        textColor=NAVY, spaceBefore=6, spaceAfter=3)


def oral(path):
    s = [P("Texte de l'oral (2 min 30)", title),
         P("Russie / pays occidentaux : profondeur stratégique et rivalités", subtitle),
         Spacer(1, 6)]
    for part, dur, txt in ORAL:
        s.append(KeepTogether([P(f"{part} <font name='Sans' color='#666666'>({dur})</font>", oral_h),
                               P(txt, oral_txt)]))
    s.append(Spacer(1, 6))
    s.append(P("<i>Conseil : parler lentement, marquer une pause entre chaque partie ; "
               "une seule diapositive : carte Russie–Ukraine–Finlande–Baltique et, en encart, "
               "Pakistan–Afghanistan–Inde.</i>", fn))
    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                            title="Texte de l'oral - Russie / pays occidentaux", author="")
    doc.build(s)
    words = sum(len(t.split()) for _, _, t in ORAL)
    print("mots oral:", words, "-> ~", round(words / 150, 1), "min")


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    dossier(os.path.join(here, "Dossier_Russie_Occident.pdf"))
    oral(os.path.join(here, "Oral_Russie_Occident.pdf"))
