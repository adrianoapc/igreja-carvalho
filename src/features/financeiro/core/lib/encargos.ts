/**
 * Composição bruto×líquido de um lançamento (ADR-027): desconto, taxa
 * administrativa, juros e multa — os 4 componentes que fazem
 * `valor_liquido` divergir de `valor`. Usado por LancamentoCard,
 * TransacoesPage (totais de grupo) e pelos calendários Entradas/Saídas.
 */

export interface EncargoCampos {
  desconto?: number | string | null;
  taxas_administrativas?: number | string | null;
  juros?: number | string | null;
  multas?: number | string | null;
}

export interface EncargoTotais {
  desconto: number;
  taxas_administrativas: number;
  juros: number;
  multas: number;
}

export const ENCARGO_LABELS: Record<keyof EncargoTotais, string> = {
  desconto: "Desconto",
  taxas_administrativas: "Taxa",
  juros: "Juros",
  multas: "Multa",
};

const ENCARGO_ORDEM: (keyof EncargoTotais)[] = [
  "desconto",
  "taxas_administrativas",
  "juros",
  "multas",
];

export function somarEncargos(itens: EncargoCampos[]): EncargoTotais {
  return itens.reduce<EncargoTotais>(
    (acc, t) => ({
      desconto: acc.desconto + Number(t.desconto || 0),
      taxas_administrativas:
        acc.taxas_administrativas + Number(t.taxas_administrativas || 0),
      juros: acc.juros + Number(t.juros || 0),
      multas: acc.multas + Number(t.multas || 0),
    }),
    { desconto: 0, taxas_administrativas: 0, juros: 0, multas: 0 },
  );
}

export function encargosAtivos(
  totais: EncargoTotais,
): Array<{ chave: keyof EncargoTotais; label: string; valor: number }> {
  return ENCARGO_ORDEM.filter((chave) => totais[chave] > 0).map((chave) => ({
    chave,
    label: ENCARGO_LABELS[chave],
    valor: totais[chave],
  }));
}

export function temEncargo(totais: EncargoTotais): boolean {
  return ENCARGO_ORDEM.some((chave) => totais[chave] > 0);
}
