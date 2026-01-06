/**
 * Utilitários para geração de slugs curtos determinísticos
 * Slugs são codificados de forma reversível (filial_id + tipo)
 */

const LINK_TYPES = {
  cadastro: "c",
  visitante: "v",
  aceitou: "a",
  membro: "m",
} as const;

type LinkType = keyof typeof LINK_TYPES;

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Encode bytes para base58 (sem 0, O, I, l para evitar confusão)
 */
function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }

  if (num === BigInt(0)) return BASE58_ALPHABET[0];

  let result = "";
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    result = BASE58_ALPHABET[remainder] + result;
    num = num / BigInt(58);
  }

  return result;
}

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
 * Gera slug determinístico codificando filial_id + tipo
 * Formato: base58(filial_id_bytes + tipo_code)
 */
export function generateShortSlug(
  filialId: string,
  linkType: LinkType
): string {
  const typeCode = LINK_TYPES[linkType];

  // Pegar primeiros 12 bytes do UUID (suficiente pra unicidade) + tipo (1 byte)
  const uuidClean = filialId.replace(/-/g, "");
  const uuidBytes = uuidClean.slice(0, 24); // 12 bytes hex

  const bytes = new Uint8Array(13);
  for (let i = 0; i < 12; i++) {
    bytes[i] = parseInt(uuidBytes.slice(i * 2, i * 2 + 2), 16);
  }
  bytes[12] = typeCode.charCodeAt(0); // Tipo como último byte

  return encodeBase58(bytes);
}

/**
 * Decodifica slug para extrair filial_id e tipo
 */
export function decodeSlug(
  slug: string
): { filialId: string; linkType: LinkType } | null {
  try {
    const bytes = decodeBase58(slug);
    if (bytes.length < 13) return null;

    // Reconstruir UUID dos primeiros 12 bytes
    const hex = Array.from(bytes.slice(0, 12))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Formato UUID: 8-4-4-4-12
    const filialId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20, 24)}000000000000`;

    // Extrair tipo do último byte
    const typeChar = String.fromCharCode(bytes[12]);
    const linkType = Object.entries(LINK_TYPES).find(
      ([_, code]) => code === typeChar
    )?.[0] as LinkType | undefined;

    if (!linkType) return null;

    return { filialId, linkType };
  } catch {
    return null;
  }
}

/**
 * Monta URL curta completa
 */
export function generateShortUrl(
  baseUrl: string,
  filialId: string,
  linkType: LinkType
): string {
  const slug = generateShortSlug(filialId, linkType);
  return `${baseUrl}/s/${slug}`;
}

/**
 * Resolve tipo de link para path de destino
 */
export function getLinkPath(linkType: LinkType, filialId: string): string {
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
