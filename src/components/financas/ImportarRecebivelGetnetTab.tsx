import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useFilialId } from "@/hooks/useFilialId";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  importarRecebivelGetnet,
  type RecebivelGetnetLinha,
} from "@/features/financeiro/core/api/getnetRecebivel.api";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

const MAX_FILE_SIZE_MB = 10;

type IntegracaoOption = { id: string; nome: string };

/**
 * Cabeçalho fixo do "Recebível Extrato Detalhado" (portal Getnet), na ordem
 * exata das 26 colunas do CSV (confirmado contra arquivo real do usuário,
 * jul/2026). Campos sem entrada em CAMPO_POR_COLUNA (EC CENTRALIZADOR,
 * ESTABELECIMENTO COMERCIAL, CPF/CNPJ) não são armazenados.
 */
const HEADER_ESPERADO = [
  "EC CENTRALIZADOR",
  "ESTABELECIMENTO COMERCIAL",
  "CPF / CNPJ",
  "DATA DE VENCIMENTO",
  "BANDEIRA / MODALIDADE",
  "TIPO DE LANÇAMENTO",
  "LANÇAMENTO",
  "VALOR LÍQUIDO",
  "VALOR LIQUIDADO",
  "NÚMERO DO CARTÃO",
  "AUTORIZAÇÃO",
  "NÚMERO COMPROVANTE DE VENDA (NSU)",
  "TERMINAL LÓGICO",
  "DATA DA VENDA",
  "HORA DA VENDA",
  "VALOR DA VENDA",
  "PARCELAS",
  "VALOR DA PARCELA",
  "DESCONTOS",
  "VALOR LIQUIDO DA PARCELA",
  "DATA DA CONTRATAÇÃO DO CONTRATO",
  "INSTITUIÇÃO NEGOCIADORA",
  "CONTRATO REGISTRADORA",
  "VALOR ATUAL DO CONTRATO",
  "VALOR LIQUIDADO DO CONTRATO",
  "VALOR A LIQUIDAR DO CONTRATO",
];

// Índice (0-based) de cada coluna do CSV → campo de RecebivelGetnetLinha.
// Índices 0-2 (EC/Estabelecimento/CPF-CNPJ) não têm campo — ignorados.
const CAMPO_POR_INDICE: Array<keyof RecebivelGetnetLinha | null> = [
  null,
  null,
  null,
  "data_vencimento",
  "bandeira_modalidade",
  "tipo_lancamento",
  "lancamento",
  "valor_liquido",
  "valor_liquidado",
  "numero_cartao",
  "autorizacao",
  "nsu",
  "terminal_logico",
  "data_venda",
  "hora_venda",
  "valor_venda",
  "parcelas",
  "valor_parcela",
  "descontos",
  "valor_liquido_parcela",
  "data_contratacao_contrato",
  "instituicao_negociadora",
  "contrato_registradora",
  "valor_atual_contrato",
  "valor_liquidado_contrato",
  "valor_a_liquidar_contrato",
];

const CAMPOS_DATA = new Set<keyof RecebivelGetnetLinha>([
  "data_vencimento",
  "data_venda",
  "data_contratacao_contrato",
]);
const CAMPOS_VALOR = new Set<keyof RecebivelGetnetLinha>([
  "valor_liquido",
  "valor_liquidado",
  "valor_venda",
  "valor_parcela",
  "descontos",
  "valor_liquido_parcela",
  "valor_atual_contrato",
  "valor_liquidado_contrato",
  "valor_a_liquidar_contrato",
]);

// "0" é o sentinel do portal pra "sem contrato" (visto em linhas Pagamento
// Realizado/Valor Liquidado (R$)) — não é um Contrato Registradora real.
const CONTRATO_SENTINEL_VAZIO = "0";

const normalizar = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseValorGetnet = (valor: string): number | null => {
  const str = valor.trim();
  if (!str) return null;
  // Formato do portal: milhar com ponto, decimal com vírgula (ex.: "1.523,81").
  const n = parseFloat(str.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
};

// Célula vazia é válida (vira null em parseValorGetnet) — célula NÃO-VAZIA
// mas malformada ("abc", "123x") precisa ser rejeitada explicitamente:
// parseFloat aceita sufixo lixo ("123x" → 123) e NaN vira null do mesmo
// jeito que uma célula legitimamente vazia, então parseLinha não tem como
// distinguir "vazio de propósito" de "erro de digitação/exportação" —
// ambos silenciosamente viram null e a linha entra como válida (achado do
// /code-review, mesma classe do fix de contagem de colunas). Valida o
// resultado já normalizado (mesma transformação de parseValorGetnet) em
// vez de tentar reconhecer o formato bruto — mais robusto a variações de
// separador de milhar do que casar a string original.
const isValorGetnetValido = (valor: string): boolean => {
  const str = valor.trim();
  if (!str) return true;
  const normalizado = str.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(normalizado);
};

const parseDataGetnet = (data: string): string | null => {
  const s = data.trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

// Mesmo raciocínio de isValorGetnetValido: célula de data não-vazia mas
// fora do formato esperado (ex.: "31-07-2026" em vez de "31/07/2026")
// virava null em silêncio — indistinguível de uma célula vazia — e a
// linha entrava como válida mesmo faltando uma data (achado do
// /code-review, mesma rodada do fix de valor monetário).
const isDataGetnetValida = (data: string): boolean => {
  const s = data.trim();
  return !s || /^\d{2}\/\d{2}\/\d{4}$/.test(s);
};

// Parser da linha crua (array de 26 células já decodificadas) → objeto
// RecebivelGetnetLinha. Datas/valores são convertidos; demais campos
// permanecem texto bruto (ex.: "parcelas" fica "1 de 7", não é quebrado em
// número atual/total — ambíguo demais pra normalizar nesta fase).
function parseLinha(celulas: string[]): RecebivelGetnetLinha {
  const linha: RecebivelGetnetLinha = {};
  CAMPO_POR_INDICE.forEach((campo, idx) => {
    if (!campo) return;
    const bruto = (celulas[idx] ?? "").trim();
    if (!bruto) {
      (linha as Record<string, unknown>)[campo] = null;
      return;
    }
    if (CAMPOS_DATA.has(campo)) {
      (linha as Record<string, unknown>)[campo] = parseDataGetnet(bruto);
    } else if (CAMPOS_VALOR.has(campo)) {
      (linha as Record<string, unknown>)[campo] = parseValorGetnet(bruto);
    } else if (campo === "contrato_registradora") {
      (linha as Record<string, unknown>)[campo] =
        bruto === CONTRATO_SENTINEL_VAZIO ? null : bruto;
    } else {
      (linha as Record<string, unknown>)[campo] = bruto;
    }
  });
  return linha;
}

// Divide uma linha CSV por ";" — o layout real não usa aspas/escaping (26
// campos fixos, confirmado contra arquivo real), então split simples basta.
const splitCsvLine = (linha: string): string[] => linha.split(";");

export function ImportarRecebivelGetnetTab() {
  const { igrejaId } = useFilialId();
  const [integracaoId, setIntegracaoId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [linhas, setLinhas] = useState<RecebivelGetnetLinha[]>([]);
  const [subtotalIgnoradas, setSubtotalIgnoradas] = useState(0);
  const [linhasInvalidas, setLinhasInvalidas] = useState(0);
  const [formatoReconhecido, setFormatoReconhecido] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: integracoes = [] } = useQuery<IntegracaoOption[]>({
    queryKey: ["integracoes-getnet-recebivel", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("integracoes_financeiras")
        .select("id, cnpj")
        .eq("igreja_id", igrejaId)
        .eq("provedor", "getnet")
        .eq("status", "ativo");
      if (error) throw error;
      return (data || []).map((i) => ({ id: i.id, nome: `Getnet · ${i.cnpj}` }));
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!integracaoId && integracoes.length === 1) {
      setIntegracaoId(integracoes[0].id);
    }
  }, [integracoes, integracaoId]);

  const limparPreview = () => {
    setLinhas([]);
    setSubtotalIgnoradas(0);
    setLinhasInvalidas(0);
    setFormatoReconhecido(null);
    setFileName("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      // O portal Getnet exporta em ISO-8859-1 (Latin-1), não UTF-8 — decodificar
      // como UTF-8 corromperia todos os campos acentuados (LANÇAMENTO, VALOR
      // LÍQUIDO etc.) e quebraria a detecção de cabeçalho.
      const texto = new TextDecoder("iso-8859-1").decode(buffer);
      const todasLinhas = texto.split(/\r\n|\n|\r/).filter((l) => l.length > 0);

      if (todasLinhas.length < 2) {
        toast.error("Arquivo vazio ou sem linhas de dados");
        limparPreview();
        return;
      }

      const headerCelulas = splitCsvLine(todasLinhas[0]).map((h) => normalizar(h));
      const headerEsperadoNorm = HEADER_ESPERADO.map(normalizar);
      const headerBate =
        headerCelulas.length === headerEsperadoNorm.length &&
        headerCelulas.every((h, i) => h === headerEsperadoNorm[i]);

      if (!headerBate) {
        setFormatoReconhecido(false);
        toast.error(
          "Arquivo não reconhecido como Recebível Extrato Detalhado (cabeçalho diferente do esperado)",
        );
        setLinhas([]);
        setSubtotalIgnoradas(0);
        return;
      }
      setFormatoReconhecido(true);

      let ignoradas = 0;
      let invalidas = 0;
      const parsed: RecebivelGetnetLinha[] = [];
      for (const linhaTexto of todasLinhas.slice(1)) {
        const celulas = splitCsvLine(linhaTexto);
        if (celulas.every((c) => c.trim() === "")) continue;

        const tipoLancamento = (celulas[5] ?? "").trim();
        if (normalizar(tipoLancamento) === "subtotal") {
          ignoradas++;
          continue;
        }

        // Linha truncada ou com ";" a mais desloca/faltam células — parseLinha
        // preenche o que falta com null (celulas[idx] ?? ""), e a RPC de
        // importação aceita esses campos como null, então a linha entraria
        // como "importada com sucesso" mesmo malformada, poluindo os dados
        // em silêncio (achado do /code-review). Rejeita ANTES do parse.
        if (celulas.length !== HEADER_ESPERADO.length) {
          invalidas++;
          continue;
        }

        // Célula não-vazia mas com valor monetário malformado ("abc",
        // "123x") também vira null em silêncio no parse — rejeita a linha
        // em vez de deixar entrar com o campo vazio por engano (achado do
        // /code-review, rodada seguinte ao fix de contagem de colunas).
        const temValorInvalido = CAMPO_POR_INDICE.some(
          (campo, idx) => campo && CAMPOS_VALOR.has(campo) && !isValorGetnetValido(celulas[idx] ?? ""),
        );
        if (temValorInvalido) {
          invalidas++;
          continue;
        }

        // Mesmo problema pra data ("31-07-2026" em vez de "31/07/2026") —
        // vira null em silêncio, indistinguível de célula vazia.
        const temDataInvalida = CAMPO_POR_INDICE.some(
          (campo, idx) => campo && CAMPOS_DATA.has(campo) && !isDataGetnetValida(celulas[idx] ?? ""),
        );
        if (temDataInvalida) {
          invalidas++;
          continue;
        }

        parsed.push(parseLinha(celulas));
      }

      setLinhas(parsed);
      setSubtotalIgnoradas(ignoradas);
      setLinhasInvalidas(invalidas);
      if (invalidas > 0) {
        toast.warning(
          `${invalidas} linha(s) com número de colunas inesperado foram descartadas — confira o arquivo original.`,
        );
      }
      toast.success(
        `${parsed.length} linha(s) reconhecida(s)` +
          (ignoradas > 0 ? ` · ${ignoradas} subtotal(is) ignorado(s)` : ""),
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler arquivo CSV");
      limparPreview();
    }
  };

  const processarImportacao = async () => {
    if (!integracaoId) {
      toast.error("Selecione a integração Getnet");
      return;
    }
    if (!linhas.length) {
      toast.error("Nenhuma linha para importar");
      return;
    }

    setLoading(true);
    try {
      const res = await importarRecebivelGetnet(integracaoId, linhas);
      const inseridos = Number(res.inseridos ?? 0);
      const duplicados = Number(res.duplicados ?? 0);
      const invalidos = Number(res.invalidos ?? 0);
      toast.success(
        `${inseridos} lançamento(s) importado(s)` +
          (duplicados > 0 ? ` · ${duplicados} duplicado(s) ignorado(s)` : "") +
          (invalidos > 0 ? ` · ${invalidos} linha(s) inválida(s)` : ""),
      );
      limparPreview();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar recebível Getnet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Importa o CSV "Recebível Extrato Detalhado" baixado do portal Getnet
          (uso alternativo quando o SFTP estiver indisponível). As linhas são
          agrupadas automaticamente por Contrato Registradora — vínculo com o
          extrato bancário e lançamento do deságio de antecipação ficam para
          uma etapa futura.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Integração Getnet</Label>
            <Select value={integracaoId} onValueChange={setIntegracaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a integração" />
              </SelectTrigger>
              <SelectContent>
                {integracoes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Upload do Recebível Extrato Detalhado (CSV)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-background">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              {fileName ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {fileName}
                  </div>
                  <label htmlFor="recebivel-getnet-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>Selecionar outro arquivo</span>
                    </Button>
                  </label>
                </div>
              ) : (
                <label htmlFor="recebivel-getnet-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo
                    </span>
                  </Button>
                </label>
              )}
              <input
                id="recebivel-getnet-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {formatoReconhecido === false && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Arquivo não reconhecido como Recebível Extrato Detalhado.
                Confira se é o CSV correto exportado do portal Getnet.
              </AlertDescription>
            </Alert>
          )}

          {formatoReconhecido && linhas.length > 0 && (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-xs">
                  {linhas.length} linha(s) prontas para importar
                  {subtotalIgnoradas > 0
                    ? ` · ${subtotalIgnoradas} linha(s) "Subtotal" ignorada(s) (deriváveis por soma)`
                    : ""}
                  .
                </AlertDescription>
              </Alert>

              {linhasInvalidas > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {linhasInvalidas} linha(s) descartada(s) por ter um número de
                    colunas diferente do esperado (arquivo truncado ou com ";"
                    inesperado) — confira o arquivo original antes de importar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-xs">
                  Prévia (primeiras {Math.min(linhas.length, 50)} linhas)
                </h4>
                <div className="border rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Vencimento</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Lançamento</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Valor líquido</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Data venda</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Contrato registradora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.slice(0, 50).map((l, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{l.data_vencimento ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.tipo_lancamento ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.valor_liquido ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.data_venda ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{l.contrato_registradora ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={limparPreview} disabled={loading || !fileName}>
          Limpar prévia
        </Button>
        <Button onClick={processarImportacao} disabled={loading || !linhas.length}>
          {loading ? "Importando..." : "Importar recebível"}
        </Button>
      </div>
    </div>
  );
}
