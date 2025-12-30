export type PerfilStatus = "membro" | "frequentador" | "visitante" | string;

export type TriagemStatus = "aprovado" | "em_trilha";

export interface TriagemMinisterio {
  nome: string;
  categoria?: string | null;
}

export interface TriagemResultado {
  status: TriagemStatus;
  trilhaTitulo?: string;
  motivo?: string;
  requisitos?: string[];
}

interface RegraMinisterio {
  chave: string;
  palavras: string[];
  trilhaTitulo: string;
  requerMembro: boolean;
}

const REGRAS_MINISTERIO: RegraMinisterio[] = [
  {
    chave: "kids",
    palavras: ["kids", "infantil", "crianca", "criança", "bebes", "bebê"],
    trilhaTitulo: "Trilha Kids",
    requerMembro: true,
  },
  {
    chave: "louvor",
    palavras: ["louvor", "musica", "música", "banda", "voz", "vocal"],
    trilhaTitulo: "Trilha de Louvor",
    requerMembro: true,
  },
  {
    chave: "midia",
    palavras: ["midia", "mídia", "som", "projecao", "projeção", "transmissao", "transmissão"],
    trilhaTitulo: "Trilha de Mídia",
    requerMembro: true,
  },
  {
    chave: "intercessao",
    palavras: ["intercessao", "intercessão", "oracao", "oração", "clamor"],
    trilhaTitulo: "Trilha de Intercessão",
    requerMembro: false,
  },
  {
    chave: "recepcao",
    palavras: ["recepcao", "recepção", "acolhimento", "boas-vindas"],
    trilhaTitulo: "Trilha de Recepção",
    requerMembro: false,
  },
];

const TRILHA_INTEGRACAO = "Trilha de Integração";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const getRegraMinisterio = (ministerio: TriagemMinisterio) => {
  const nome = normalizeText(ministerio.nome);
  const categoria = ministerio.categoria ? normalizeText(ministerio.categoria) : "";

  return REGRAS_MINISTERIO.find((regra) =>
    regra.palavras.some((palavra) => nome.includes(normalizeText(palavra)) || categoria.includes(normalizeText(palavra)))
  );
};

export const avaliarTriagemVoluntario = (
  perfilStatus: PerfilStatus,
  ministerio: TriagemMinisterio
): TriagemResultado => {
  const regra = getRegraMinisterio(ministerio);
  const requisitos: string[] = [];

  if (perfilStatus !== "membro") {
    requisitos.push("Ser membro da igreja");
  }

  if (regra?.requerMembro) {
    requisitos.push("Ser membro para atuar neste ministério");
  }

  if (perfilStatus !== "membro") {
    return {
      status: "em_trilha",
      trilhaTitulo: TRILHA_INTEGRACAO,
      motivo: "Antes de servir, complete a trilha de integração.",
      requisitos,
    };
  }

  if (regra) {
    return {
      status: "em_trilha",
      trilhaTitulo: regra.trilhaTitulo,
      motivo: "Este ministério exige uma trilha específica.",
      requisitos,
    };
  }

  return {
    status: "aprovado",
    motivo: "Apto para servir no ministério.",
    requisitos: requisitos.length > 0 ? requisitos : undefined,
  };
};

export const trilhasMapeadas = () =>
  Array.from(
    new Set([TRILHA_INTEGRACAO, ...REGRAS_MINISTERIO.map((regra) => regra.trilhaTitulo)])
  );
