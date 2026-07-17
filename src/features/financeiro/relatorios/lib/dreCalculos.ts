export const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const SECOES_ORDER = [
  "Receitas Operacionais",
  "Receitas Não Operacionais",
  "Despesas com Pessoal",
  "Despesas Operacionais",
  "Despesas Não Operacionais",
  "Impostos e Taxas",
];

export interface DreItem {
  secao_dre: string | null;
  categoria_nome: string;
  categoria_id: string;
  mes: number;
  total: number;
}

export interface CategoriaAgrupada {
  categoria_nome: string;
  categoria_id: string;
  valores: { [mes: number]: number };
  totalAno: number;
}

export interface SecaoAgrupada {
  secao: string;
  categorias: CategoriaAgrupada[];
  totaisMes: { [mes: number]: number };
  totalAno: number;
}

export function formatCurrencyDre(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function processarDados(data: DreItem[]): SecaoAgrupada[] {
  const secoesMap = new Map<string, SecaoAgrupada>();

  data.forEach((item) => {
    const secaoKey = item.secao_dre || "Outros";

    if (!secoesMap.has(secaoKey)) {
      secoesMap.set(secaoKey, {
        secao: secaoKey,
        categorias: [],
        totaisMes: {},
        totalAno: 0,
      });
    }

    const secao = secoesMap.get(secaoKey)!;

    let categoria = secao.categorias.find(
      (c) => c.categoria_id === item.categoria_id,
    );
    if (!categoria) {
      categoria = {
        categoria_nome: item.categoria_nome,
        categoria_id: item.categoria_id,
        valores: {},
        totalAno: 0,
      };
      secao.categorias.push(categoria);
    }

    categoria.valores[item.mes] =
      (categoria.valores[item.mes] || 0) + Number(item.total);
    categoria.totalAno += Number(item.total);

    secao.totaisMes[item.mes] =
      (secao.totaisMes[item.mes] || 0) + Number(item.total);
    secao.totalAno += Number(item.total);
  });

  const resultado = Array.from(secoesMap.values());
  resultado.sort((a, b) => {
    const idxA = SECOES_ORDER.indexOf(a.secao);
    const idxB = SECOES_ORDER.indexOf(b.secao);
    if (idxA === -1 && idxB === -1) return a.secao.localeCompare(b.secao);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  resultado.forEach((secao) => {
    secao.categorias.sort((a, b) =>
      a.categoria_nome.localeCompare(b.categoria_nome),
    );
  });

  return resultado;
}

export function calcularResultadoLiquido(secoes: SecaoAgrupada[]): {
  [mes: number]: number;
} {
  const resultado: { [mes: number]: number } = {};

  for (let mes = 1; mes <= 12; mes++) {
    resultado[mes] = 0;
  }

  secoes.forEach((secao) => {
    // Excluir seção "Não faz parte do DRE" do cálculo do resultado líquido
    if (secao.secao !== "Não faz parte do DRE") {
      for (let mes = 1; mes <= 12; mes++) {
        resultado[mes] += secao.totaisMes[mes] || 0;
      }
    }
  });

  return resultado;
}
