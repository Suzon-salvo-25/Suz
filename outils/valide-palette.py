# Validation de la palette pour les deficiences de la vision des couleurs.
#
#   python3 outils/valide-palette.py
#
# Simule protanopie, deuteranopie et tritanopie (matrices LMS de Vienot et
# Brettel), puis mesure l ecart CIEDE2000 entre chaque paire de couleurs qui
# doivent rester distinguables. Un ecart sous 14 est juge faible.
import itertools, math

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))

def lin(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def delin(c):
    c = max(0.0, min(1.0, c))
    return 12.92*c if c <= 0.0031308 else 1.055*c**(1/2.4)-0.055

def mul(m, v): return tuple(sum(m[i][j]*v[j] for j in range(3)) for i in range(3))

RGB2LMS = ((0.31399022,0.63951294,0.04649755),(0.15537241,0.75789446,0.08670142),(0.01775239,0.10944209,0.87256922))
LMS2RGB = ((5.47221206,-4.6419601,0.16963708),(-1.1252419,2.29317094,-0.1678952),(0.02980165,-0.19318073,1.16364789))
SIM = {
 'protanopie':   ((0,1.05118294,-0.05116099),(0,1,0),(0,0,1)),
 'deuteranopie': ((1,0,0),(0.9513092,0,0.04866992),(0,0,1)),
 'tritanopie':   ((1,0,0),(0,1,0),(-0.86744736,1.86727089,0)),
}

def simule(hexa, kind):
    r,g,b = (lin(c) for c in hex2rgb(hexa))
    lms = mul(RGB2LMS, (r,g,b))
    lms = mul(SIM[kind], lms)
    rgb = mul(LMS2RGB, lms)
    return tuple(delin(c) for c in rgb)

def rgb2lab(rgb):
    r,g,b = (lin(c) if c > 1e-9 else 0 for c in rgb)
    X = 0.4124*r+0.3576*g+0.1805*b; Y = 0.2126*r+0.7152*g+0.0722*b; Z = 0.0193*r+0.1192*g+0.9505*b
    X,Y,Z = X/0.95047, Y, Z/1.08883
    f = lambda t: t**(1/3) if t > 0.008856 else 7.787*t+16/116
    fx,fy,fz = f(X),f(Y),f(Z)
    return (116*fy-16, 500*(fx-fy), 200*(fy-fz))

def de2000(l1, l2):
    L1,a1,b1 = l1; L2,a2,b2 = l2
    C1,C2 = math.hypot(a1,b1), math.hypot(a2,b2); Cb = (C1+C2)/2
    G = 0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7))) if Cb > 0 else 0.5
    a1p,a2p = (1+G)*a1, (1+G)*a2
    C1p,C2p = math.hypot(a1p,b1), math.hypot(a2p,b2)
    h1 = math.degrees(math.atan2(b1,a1p)) % 360; h2 = math.degrees(math.atan2(b2,a2p)) % 360
    dLp = L2-L1; dCp = C2p-C1p
    dh = 0 if C1p*C2p == 0 else (h2-h1-360 if h2-h1 > 180 else h2-h1+360 if h2-h1 < -180 else h2-h1)
    dHp = 2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh)/2)
    Lbp,Cbp = (L1+L2)/2, (C1p+C2p)/2
    hsum = h1+h2
    hbp = hsum/2 if C1p*C2p == 0 else (hsum/2 if abs(h1-h2) <= 180 else (hsum+360)/2 if hsum < 360 else (hsum-360)/2)
    T = 1-0.17*math.cos(math.radians(hbp-30))+0.24*math.cos(math.radians(2*hbp))+0.32*math.cos(math.radians(3*hbp+6))-0.20*math.cos(math.radians(4*hbp-63))
    Sl = 1+0.015*(Lbp-50)**2/math.sqrt(20+(Lbp-50)**2); Sc = 1+0.045*Cbp; Sh = 1+0.015*Cbp*T
    Rt = -2*math.sqrt(Cbp**7/(Cbp**7+25**7))*math.sin(math.radians(60*math.exp(-(((hbp-275)/25)**2)))) if Cbp > 0 else 0
    return math.sqrt((dLp/Sl)**2+(dCp/Sc)**2+(dHp/Sh)**2+Rt*(dCp/Sc)*(dHp/Sh))

def lum(rgb): return 0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2])
def contraste(h1, h2):
    a,b = lum(hex2rgb(h1)), lum(hex2rgb(h2))
    return (max(a,b)+0.05)/(min(a,b)+0.05)

def valide(nom, palette, seuil=14):
    print('\n=== ' + nom + ' ===')
    ok = True
    for kind in ['normale'] + list(SIM):
        labs = {k: rgb2lab(hex2rgb(v) if kind == 'normale' else simule(v, kind)) for k, v in palette.items()}
        pires = sorted(((de2000(labs[a], labs[b]), a, b) for a, b in itertools.combinations(palette, 2)))[:3]
        for d, a, b in pires:
            if d < seuil: ok = False
            print('  %-13s %-6s %-6s / %-6s  dE %5.1f' % (kind, 'ok' if d >= seuil else 'FAIBLE', a, b, d))
    return ok

if __name__ == '__main__':
    # La palette en place dans perte-de-poids.html. A tenir a jour si elle change.
    tout = True
    tout &= valide('macronutriments, clair',  {'prot': '#3b1466', 'gluc': '#ff7a1a', 'lip': '#f0147a'})
    tout &= valide('macronutriments, sombre', {'prot': '#9d7bff', 'gluc': '#ffa030', 'lip': '#ff2e86'})
    tout &= valide('etats, clair',  {'ok': '#0e8a5f', 'warn': '#9c6000', 'crit': '#7e0512'}, seuil=12)
    tout &= valide('etats, sombre', {'ok': '#3fd69b', 'warn': '#ffc24d', 'crit': '#f4566b'}, seuil=12)
    print('\nContrastes de texte (WCAG, 4,5 attendu pour du texte courant) :')
    for nom, fg, bg in [('encre sur creme', '#1a0a05', '#fff3e6'), ('encre sur orange', '#1a0a05', '#ff7a1a'),
                        ('encre sur rose', '#2a0010', '#f0147a'), ('blanc sur violet', '#ffffff', '#3b1466'),
                        ('blanc sur rose fort', '#ffffff', '#c4005f'), ('creme sur aubergine', '#fff3e6', '#18070e')]:
        r = contraste(fg, bg); print('  %-22s %5.2f  %s' % (nom, r, 'ok' if r >= 4.5 else 'INSUFFISANT'))
        tout &= r >= 4.5
    print('\n' + ('Palette validee.' if tout else 'PALETTE A REVOIR.'))
    raise SystemExit(0 if tout else 1)
