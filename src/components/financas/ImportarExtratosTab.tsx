import { useEffect, useMemo, useRef, useState } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { read, utils, WorkBook } from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { OFXParser } from "ofx-js";

const MAX_FILE_SIZE_MB = 10;
const COL_MIN_WIDTH_PX = 140;

type ColumnMapping = {
  data?: string;
  descricao?: string;
  valor?: string;
  saldo?: string;
  documento?: string;
  tipo?: string;
};

type ValidationIssue = {
  index: number;
  messages: string[];
};

type ContaOption = { id: string; nome: string };

type ExtratoRow = {
  data_transacao: string;
  descricao: string;
  valor: number;
  saldo?: number | null;
  numero_documento?: string | null;
  tipo: "credito" | "debito";
};

const REQUIRED_KEYS = new Set(["data", "descricao", "valor"]);

const inferirTipo = (
  valor: number,
  tipoTexto?: string | null
): "credito" | "debito" => {
  if (tipoTexto) {
    const t = tipoTexto.toLowerCase();
    if (t.includes("deb") || t.includes("déb") || t === "d" || t === "dr")
      return "debito";
    if (t.includes("cred") || t === "c" || t === "cr") return "credito";
  }
  return valor < 0 ? "debito" : "credito";
};

const parseValor = (valor: unknown): number => {
  if (valor === undefined || valor === null) return 0;
  const valorStr = String(valor)
    .replace(/\s|R\$|€|£/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const n = parseFloat(valorStr);
  return isNaN(n) ? 0 : n;
};

const parseData = (data: unknown): string | null => {
  if (!data) return null;
  const s = String(data).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s as string);
  if (!isNaN(dt.getTime())) return dt.toISOString().split("T")[0];
  return null;
};

export function ImportarExtratosTab() {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [contaId, setContaId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    []
  );
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const previewParentRef = useRef<HTMLDivElement | null>(null);
  const validationParentRef = useRef<HTMLDivElement | null>(null);

  const previewVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => previewParentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  const validationVirtualizer = useVirtualizer({
    count: validationIssues.length,
    getScrollElement: () => validationParentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  const gridTemplate = useMemo(
    () => `repeat(${columns.length}, minmax(${COL_MIN_WIDTH_PX}px, 1fr))`,
    [columns.length]
  );

  const { data: contas = [] } = useQuery<ContaOption[]>({
    queryKey: ["contas-extratos", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!contaId && contas.length === 1) {
      setContaId(contas[0].id);
    }
  }, [contas, contaId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    setFileName(file.name);
    
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (fileExtension === 'ofx') {
      await handleOFXFile(file);
    } else {
      await handleSpreadsheetFile(file);
    }
  };

  const handleOFXFile = async (file: File) => {
    try {
      const text = await file.text();
      const parser = new OFXParser();
      const ofxData = parser.parse(text);
      
      // Extrair transações do OFX
      const transactions = ofxData?.body?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN || [];
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX");
        return;
      }

      // Converter transações OFX para formato padrão
      const rows = transactions.map((trn: any) => ({
        data: trn.DTPOSTED ? formatOFXDate(trn.DTPOSTED) : "",
        descricao: trn.MEMO || trn.NAME || "",
        valor: parseFloat(trn.TRNAMT || "0"),
        documento: trn.FITID || trn.CHECKNUM || "",
        tipo: parseFloat(trn.TRNAMT || "0") < 0 ? "debito" : "credito",
      }));

      // Definir colunas fixas para OFX
      const columnNames = ["data", "descricao", "valor", "documento", "tipo"];
      setColumns(columnNames);
      setRows(rows);
      
      // Mapeamento automático para OFX
      setMapping({
        data: "data",
        descricao: "descricao",
        valor: "valor",
        documento: "documento",
        tipo: "tipo",
      });

      // Limpar estados de planilha
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
      
      toast.success(`${rows.length} transações carregadas do arquivo OFX`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler arquivo OFX. Verifique o formato.");
    }
  };

  const formatOFXDate = (dateStr: string): string => {
    // OFX dates: YYYYMMDD ou YYYYMMDDHHMMSS
    if (!dateStr) return "";
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  };

  const handleSpreadsheetFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = read(data);
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      parseSheet(wb, firstSheet);
      toast.success(`Arquivo carregado: ${file.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler arquivo XLSX/CSV");
    }
  };

  const parseSheet = (wb: WorkBook, sheetName: string) => {
    try {
      const worksheet = wb.Sheets[sheetName];
      const aoa = utils.sheet_to_json(worksheet, { header: 1 }) as Array<
        Array<unknown>
      >;
      const headerRow = (aoa[0] || []) as Array<unknown>;
      let columnNames = headerRow
        .map((h) => String(h || "").trim())
        .filter((h) => h.length > 0);
      const jsonData = utils.sheet_to_json(worksheet, { defval: "" });
      if (!columnNames.length) {
        const firstRow = (jsonData[0] || {}) as Record<string, unknown>;
        columnNames = Object.keys(firstRow);
      }
      setColumns(columnNames);
      setRows(jsonData as Record<string, unknown>[]);
      autoDetectMapping(columnNames);
      toast.success(`${jsonData.length} linhas na planilha '${sheetName}'`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar planilha");
    }
  };

  const autoDetectMapping = (columnNames: string[]) => {
    const auto: ColumnMapping = {};
    columnNames.forEach((col) => {
      const k = col.toLowerCase().trim();
      if (k.includes("data")) auto.data = col;
      if (k.includes("descri")) auto.descricao = col;
      if (k.includes("valor")) auto.valor = col;
      if (k.includes("saldo")) auto.saldo = col;
      if (k.includes("doc") || k.includes("numero")) auto.documento = col;
      if (k.includes("tipo") || k.includes("deb") || k.includes("cred"))
        auto.tipo = col;
    });
    setMapping(auto);
  };

  const validateMappingRequired = (): string[] => {
    const errors: string[] = [];
    if (!mapping.data) errors.push("Campo 'Data' não mapeado");
    if (!mapping.descricao) errors.push("Campo 'Descrição' não mapeado");
    if (!mapping.valor) errors.push("Campo 'Valor' não mapeado");
    if (!contaId) errors.push("Selecione a conta destino");
    return errors;
  };

  const runValidation = () => {
    const errors = validateMappingRequired();
    if (errors.length) {
      setValidationIssues([{ index: -1, messages: errors }]);
      toast.error("Mapeamento incompleto");
      return;
    }

    const issues: ValidationIssue[] = [];
    const newExcluded: Record<number, boolean> = { ...excluded };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const msgs: string[] = [];

      const data = parseData(mapping.data ? row[mapping.data] : null);
      const descricao = mapping.descricao ? row[mapping.descricao] : null;
      const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;

      if (!data) msgs.push("Data inválida");
      if (!descricao || String(descricao).trim().length === 0)
        msgs.push("Descrição ausente");
      if (!valor || valor === 0) msgs.push("Valor inválido");

      if (msgs.length) {
        issues.push({ index: i, messages: msgs });
        newExcluded[i] = true;
      }
    }

    setValidationIssues(issues);
    setExcluded(newExcluded);
    toast[issues.length ? "warning" : "success"](
      issues.length
        ? `${issues.length} linhas com problemas`
        : "Validação concluída"
    );
  };

  const buildExtrato = (row: Record<string, unknown>): ExtratoRow | null => {
    const data = parseData(mapping.data ? row[mapping.data] : null);
    if (!data) return null;
    const rawDesc = mapping.descricao ? row[mapping.descricao] : null;
    const descricao = rawDesc != null ? String(rawDesc) : "";
    const valorRaw = mapping.valor ? parseValor(row[mapping.valor]) : 0;
    if (!valorRaw || valorRaw === 0) return null;
    const tipoTexto = mapping.tipo ? String(row[mapping.tipo] || "") : null;
    const tipo = inferirTipo(valorRaw, tipoTexto);
    const saldo = mapping.saldo ? parseValor(row[mapping.saldo]) : null;
    const documento = mapping.documento
      ? String(row[mapping.documento] || "")
      : null;
    const valorAssinado =
      tipo === "debito" && valorRaw > 0 ? valorRaw * -1 : valorRaw;

    return {
      data_transacao: data,
      descricao,
      valor: valorAssinado,
      saldo: saldo !== null ? saldo : null,
      numero_documento: documento,
      tipo,
    };
  };

  const processarImportacao = async () => {
    if (!igrejaId) {
      toast.error("Contexto da igreja não identificado");
      return;
    }
    if (!contaId) {
      toast.error("Selecione a conta destino");
      return;
    }

    setLoading(true);
    try {
      const validRowsIdx = rows.map((_, i) => i).filter((i) => !excluded[i]);
      const extratos = validRowsIdx
        .map((i) => buildExtrato(rows[i]))
        .filter((e): e is ExtratoRow => !!e);

      if (!extratos.length) {
        toast.error("Nenhum registro válido para importar");
        return;
      }

      const chunkSize = 200;
      for (let start = 0; start < extratos.length; start += chunkSize) {
        const chunk = extratos.slice(start, start + chunkSize).map((e) => ({
          conta_id: contaId,
          igreja_id: igrejaId,
          filial_id: isAllFiliais ? null : filialId,
          data_transacao: e.data_transacao,
          descricao: e.descricao,
          valor: e.valor,
          saldo: e.saldo,
          numero_documento: e.numero_documento,
          tipo: e.tipo,
          reconciliado: false,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("extratos_bancarios")
          .insert(chunk);
        if (error) throw error;
      }

      toast.success(`${extratos.length} linhas importadas para extratos`);
      setValidationIssues([]);
      setExcluded({});
      setRows([]);
      setColumns([]);
      setFileName("");
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar extratos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conta de destino</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Upload de extrato (CSV/XLSX/OFX)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-background">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              {fileName ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {fileName}
                  </div>
                  <label htmlFor="extrato-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>Selecionar outro arquivo</span>
                    </Button>
                  </label>
                </div>
              ) : (
                <label htmlFor="extrato-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo
                    </span>
                  </Button>
                </label>
              )}
              <input
                id="extrato-upload"
                type="file"
                accept=".xlsx,.xls,.csv,.ofx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {sheetNames.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Planilha</Label>
              <Select
                value={selectedSheet}
                onValueChange={(v) => {
                  setSelectedSheet(v);
                  if (workbook) parseSheet(workbook, v);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a planilha" />
                </SelectTrigger>
                <SelectContent>
                  {sheetNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Campos obrigatórios: data, descrição, valor. Opcional: saldo,
              documento, tipo.
            </AlertDescription>
          </Alert>

          {columns.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  [
                    "data",
                    "descricao",
                    "valor",
                    "saldo",
                    "documento",
                    "tipo",
                  ] as const
                ).map((key) => (
                  <div className="space-y-1.5" key={key}>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">{key}</Label>
                      {REQUIRED_KEYS.has(key) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    <Select
                      value={mapping[key as keyof ColumnMapping] || ""}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, [key]: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            REQUIRED_KEYS.has(key)
                              ? "Selecione (Obrigatório)"
                              : "Selecione a coluna"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {key !== "data" &&
                          key !== "descricao" &&
                          key !== "valor" && (
                            <SelectItem value="none">Nenhuma</SelectItem>
                          )}
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-xs">Prévia</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <div
                    className="bg-muted text-xs grid"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {columns.map((col) => (
                      <div
                        key={col}
                        className="px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                  <div
                    ref={previewParentRef}
                    className="max-h-60 overflow-y-auto"
                  >
                    <div
                      style={{
                        height: previewVirtualizer.getTotalSize(),
                        position: "relative",
                      }}
                    >
                      {previewVirtualizer.getVirtualItems().map((vi) => {
                        const row = rows[vi.index] as Record<string, unknown>;
                        return (
                          <div
                            key={vi.key}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${vi.start}px)`,
                            }}
                            className="border-t"
                          >
                            <div
                              className="text-xs grid"
                              style={{ gridTemplateColumns: gridTemplate }}
                            >
                              {columns.map((col) => (
                                <div
                                  key={col}
                                  className="px-3 py-2 whitespace-nowrap"
                                >
                                  {String(row[col] || "")}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Validação */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = { ...excluded };
              validationIssues.forEach((issue) => {
                next[issue.index] = false;
              });
              setExcluded(next);
            }}
            disabled={!validationIssues.length}
          >
            Desmarcar todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = { ...excluded };
              validationIssues.forEach((issue) => {
                next[issue.index] = true;
              });
              setExcluded(next);
            }}
            disabled={!validationIssues.length}
          >
            Marcar todos
          </Button>
        </div>

        {validationIssues.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-xs">
              Sem problemas de validação. Pronto para importar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Linha</th>
                    <th className="px-3 py-2 text-left">Problemas</th>
                    <th className="px-3 py-2 text-center">Excluir</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div ref={validationParentRef} className="overflow-auto max-h-48">
              <div
                style={{
                  height: validationVirtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {validationVirtualizer.getVirtualItems().map((vi) => {
                  const issue = validationIssues[vi.index];
                  return (
                    <div
                      key={vi.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <table className="min-w-full text-xs border-t">
                        <tbody>
                          <tr className="hover:bg-muted/50">
                            <td className="px-3 py-2">{issue.index + 1}</td>
                            <td className="px-3 py-2">
                              {issue.messages.join("; ")}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={!!excluded[issue.index]}
                                onChange={(e) =>
                                  setExcluded({
                                    ...excluded,
                                    [issue.index]: e.target.checked,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={runValidation}
          disabled={columns.length === 0 || loading}
        >
          Validar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setValidationIssues([]);
              setExcluded({});
              toast("Pré-visualização limpa");
            }}
            disabled={loading}
          >
            Limpar prévia
          </Button>
          <Button onClick={processarImportacao} disabled={loading}>
            {loading ? "Importando..." : "Importar extrato"}
          </Button>
        </div>
      </div>
    </div>
  );
}
