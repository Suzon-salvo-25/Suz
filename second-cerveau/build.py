#!/usr/bin/env python3
"""Assemble Mes Pépites.

Produit deux fichiers à partir de src/ :
  - index.html        : la version autonome (installable, avec manifeste) ;
  - dist/artifact.html : le corps de page publié sur claude.ai, sans
    doctype ni <head> (la plateforme les ajoute elle-même).
"""
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
SRC = ICI / "src"

corps = (SRC / "app.html").read_text(encoding="utf-8")
autocollants = (SRC / "autocollants.css").read_text(encoding="utf-8")
script = "".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))

corps = corps.replace("/*@@AUTOCOLLANTS@@*/", autocollants.strip())
corps = corps.replace("/*@@SCRIPT@@*/", script.strip())

(ICI / "dist").mkdir(exist_ok=True)
(ICI / "dist" / "artifact.html").write_text(corps, encoding="utf-8")

tete = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Le second cerveau de tes enregistrements Instagram et TikTok : tout se range seul, tout se retrouve.">
<meta name="theme-color" content="#ff8a3c">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone.svg" type="image/svg+xml">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
</head>
<body>
"""
(ICI / "index.html").write_text(tete + corps + "\n</body>\n</html>\n", encoding="utf-8")
print("index.html et dist/artifact.html assemblés")
