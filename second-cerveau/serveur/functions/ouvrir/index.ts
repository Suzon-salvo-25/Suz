// Mes Pépites — relais d'ouverture d'un Reel dans l'appli Instagram.
//
// L'appli Claude laisse Instagram détourner les liens instagram.com vers un
// Reel au hasard, et bloque les liens instagram:// posés dans la page. Ce
// relais reçoit un lien https ordinaire (…/ouvrir?id=<numéro du Reel>) et
// répond par une redirection vers instagram://media?id=<numéro> : iOS ouvre
// alors l'appli Instagram directement sur ce Reel.
//
// Public par nature (un lien qu'on touche n'envoie pas d'en-tête
// d'authentification) : il n'accepte qu'un numéro et ne redirige que vers
// instagram://media, donc il ne lit ni n'écrit aucune donnée.

Deno.serve((req: Request) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^\d{5,25}$/.test(id)) {
    return new Response("Lien invalide.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `instagram://media?id=${id}`, "Cache-Control": "no-store" },
  });
});
