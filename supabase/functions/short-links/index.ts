import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type LinkType = "cadastro" | "visitante" | "aceitou" | "membro";

/**
 * Decode base58 para bytes
 */
function decodeBase58(str: string): Uint8Array {
  let num = BigInt(0);
  for (const char of str) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) throw new Error("Invalid base58 character");
    num = num * BigInt(58) + BigInt(digit);
  }

  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  return new Uint8Array(bytes.length > 0 ? bytes : [0]);
}

/**
 * Decodifica slug para extrair filial_id e tipo
 */
function decodeSlug(slug: string): { filialId: string; linkType: LinkType } | null {
  try {
    const bytes = decodeBase58(slug);
    if (bytes.length < 13) return null;

    // Reconstruir UUID dos primeiros 12 bytes
    const hex = Array.from(bytes.slice(0, 12))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Formato UUID: 8-4-4-4-12
    const filialId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 24)}000000000000`;

    // Extrair tipo do último byte
    const typeChar = String.fromCharCode(bytes[12]);
    const linkTypeMap: Record<string, LinkType> = {
      c: "cadastro",
      v: "visitante",
      a: "aceitou",
      m: "membro",
    };
    const linkType = linkTypeMap[typeChar];

    if (!linkType) return null;

    return { filialId, linkType };
  } catch {
    return null;
  }
}

/**
 * Resolve tipo de link para path de destino
 */
function getLinkPath(linkType: LinkType, filialId: string): string {
  switch (linkType) {
    case "cadastro":
      return `/cadastro?filial_id=${filialId}`;
    case "visitante":
      return `/cadastro/visitante?filial_id=${filialId}`;
    case "aceitou":
      return `/cadastro?filial_id=${filialId}&aceitou=true`;
    case "membro":
      return `/cadastro/membro?filial_id=${filialId}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  // Extrair slug do path: /s/<slug> ou /short-links/<slug>
  const slugMatch = pathname.match(/\/(s|short-links)\/([^\/]+)/);
  
  if (!slugMatch || !slugMatch[2]) {
    return new Response(
      JSON.stringify({ error: "Slug não encontrado no path" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const slug = slugMatch[2];

  // Decodificar slug
  const decoded = decodeSlug(slug);
  if (!decoded) {
    return new Response(
      JSON.stringify({ error: "Slug inválido ou corrompido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Construir URL de destino
  const targetPath = getLinkPath(decoded.linkType, decoded.filialId);
  const targetUrl = `${url.origin}${targetPath}`;

  console.log(`[short-links] Redirecionando ${slug} → ${targetUrl}`);

  // Redirecionar
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: targetUrl,
      "Cache-Control": "public, max-age=31536000", // Cache 1 ano (slugs são determinísticos)
    },
  });
});
