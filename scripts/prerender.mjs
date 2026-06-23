/**
 * scripts/prerender.mjs
 *
 * Roda após `vite build` como postbuild.
 * Para cada rota pública:
 *   1. Copia dist/index.html (shell do Vite)
 *   2. Injeta meta tags corretas na <head>
 *   3. Grava em dist/{rota}/index.html  (Vercel serve diretamente)
 *
 * A rota "/" sobrescreve dist/index.html com meta da homepage pública.
 * Rotas autenticadas (/dashboard, etc.) usam o fallback do rewrite Vercel
 * e recebem as mesmas tags — aceitável porque não são indexadas.
 *
 * Também gera dist/sitemap.xml atualizado.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const SITE_URL = "https://igrejacarvalho.com.br";
const SITE_NAME = "Igreja Carvalho — FIRMES.";
// Coloque o arquivo em public/og-image.jpg (1 200 × 630 px, < 500 KB)
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// ─── Rotas públicas ──────────────────────────────────────────────────────────
const ROUTES = [
  {
    path: "/",
    title: "Início",
    description:
      "Plantados por Deus, vivendo para servir. Uma família firmada em Cristo, enraizada na Palavra e apaixonada pelo Reino. Conheça a Igreja Carvalho.",
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/agenda",
    title: "Agenda",
    description:
      "Próximos cultos, eventos e encontros da Igreja Carvalho. Venha participar.",
    changefreq: "weekly",
    priority: "0.9",
  },
  {
    path: "/mensagens",
    title: "Mensagens",
    description: "Ouça e assista às pregações e mensagens da Igreja Carvalho.",
    changefreq: "weekly",
    priority: "0.8",
  },
  {
    path: "/oracao",
    title: "Pedido de Oração",
    description:
      "Envie seu pedido à equipe de intercessão da Igreja Carvalho, com cuidado e sigilo.",
    changefreq: "monthly",
    priority: "0.8",
  },
  {
    path: "/privacidade",
    title: "Política de Privacidade",
    description:
      "Saiba como a Igreja Carvalho coleta, usa e protege seus dados conforme a LGPD.",
    changefreq: "yearly",
    priority: "0.3",
  },
  {
    path: "/contato",
    title: "Onde estamos",
    description:
      "Encontre a Igreja Carvalho em São José do Rio Preto/SP. Endereço: Av. Gabriel Jorge Cury, 232 — Jardim Municipal. Cultos: Terça 20h, Quinta 19h30, Domingo 18h30.",
    changefreq: "monthly",
    priority: "0.8",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripExistingMeta(html) {
  return (
    html
      // Remove <title>…</title>
      .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
      // Remove tags meta e link que vamos re-injetar
      .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']author["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "")
      .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
      // Remove LD+JSON antigos (domain antigo)
      .replace(
        /<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>/gi,
        "",
      )
      // Remove linhas em branco extras (limpeza cosmética)
      .replace(/\n{3,}/g, "\n\n")
  );
}

function buildMetaBlock(route) {
  const fullTitle = `${route.title} | ${SITE_NAME}`;
  const url = `${SITE_URL}${route.path}`;

  return `
  <title>${fullTitle}</title>
  <meta name="description" content="${route.description}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="${SITE_NAME}" />
  <meta property="og:title"       content="${fullTitle}" />
  <meta property="og:description" content="${route.description}" />
  <meta property="og:url"         content="${url}" />
  <meta property="og:image"       content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale"      content="pt_BR" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${fullTitle}" />
  <meta name="twitter:description" content="${route.description}" />
  <meta name="twitter:image"       content="${OG_IMAGE}" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Church",
    "name": "Igreja Carvalho",
    "url": "${SITE_URL}/",
    "image": "${OG_IMAGE}",
    "description": "Comunidade de fé, comunhão e propósito — firmes em Cristo.",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "BR"
    }
  }
  </script>`.trimStart();
}

function injectMeta(template, route) {
  const cleaned = stripExistingMeta(template);
  // Injeta o bloco logo após <head> para garantir prioridade
  return cleaned.replace(/(<head[^>]*>)/i, `$1\n  ${buildMetaBlock(route)}`);
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

function buildSitemap() {
  const today = new Date().toISOString().split("T")[0];
  const urls = ROUTES.map(
    (r) => `
  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const distDir = path.resolve("dist");
const template = readFileSync(path.join(distDir, "index.html"), "utf-8");

// Fix lang="en" → lang="pt-BR" no template base
const templatePtBR = template.replace(
  /<html\s+lang=["']en["']/,
  '<html lang="pt-BR"',
);

for (const route of ROUTES) {
  const html = injectMeta(templatePtBR, route);

  if (route.path === "/") {
    // Sobrescreve dist/index.html com meta da homepage pública
    writeFileSync(path.join(distDir, "index.html"), html, "utf-8");
    console.log(`✓  /  → dist/index.html`);
  } else {
    const dir = path.join(distDir, route.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.html"), html, "utf-8");
    console.log(`✓  ${route.path}  → dist${route.path}/index.html`);
  }
}

// Sitemap
writeFileSync(path.join(distDir, "sitemap.xml"), buildSitemap(), "utf-8");
console.log(`✓  sitemap.xml gerado`);

console.log(`\nPré-renderização concluída — ${ROUTES.length} rotas.`);
