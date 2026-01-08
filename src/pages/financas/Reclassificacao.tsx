import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type TransacaoPreview = {
  id: string;
  descricao: string | null;
  data_vencimento: string | null;
  data_competencia: string | null;
  valor: number | null;
  status: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  centro_custo_id: string | null;
  fornecedor_id: string | null;
  conta_id: string | null;
};

const ReclassificacaoPage = () => {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [filtros, setFiltros] = useState({
    descricao: "",
    dataInicio: "",
    dataFim: "",
    competenciaInicio: "",
    competenciaFim: "",
    categoria: "",
    subcategoria: "",
    centro: "",
    fornecedor: "",
    conta: "",
    status: "",
  });

  const [novosValores, setNovosValores] = useState({
    categoria_id: "",
    subcategoria_id: "",
    centro_custo_id: "",
    fornecedor_id: "",
    conta_id: "",
    status: "",
    data_competencia: "",
  });

  const [jobInfo, setJobInfo] = useState<{ id: string; aplicados: number; ignorados: number } | null>(null);
  const [options, setOptions] = useState({
    categorias: [] as Array<{ id: string; nome: string; tipo: string }>,
    subcategorias: [] as Array<{ id: string; nome: string }>,
    centros: [] as Array<{ id: string; nome: string }>,
    fornecedores: [] as Array<{ id: string; nome: string }>,
    contas: [] as Array<{ id: string; nome: string }>,
  });
  const [undoJobId, setUndoJobId] = useState<string>("");
  const [searchParams, setSearchParams] = useState<(typeof filtros & { tipo: "entrada" | "saida" }) | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const ALL_VALUE = "__ALL__";
  const NONE_VALUE = "__NONE__";

  const formatCurrency = (value: number) =>
    (value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const categoriaMap = useMemo(() => Object.fromEntries(options.categorias.map((c) => [c.id, c.nome])), [options.categorias]);
  const centroMap = useMemo(() => Object.fromEntries(options.centros.map((c) => [c.id, c.nome])), [options.centros]);
  const fornecedorMap = useMemo(() => Object.fromEntries(options.fornecedores.map((f) => [f.id, f.nome])), [options.fornecedores]);
  const contaMap = useMemo(() => Object.fromEntries(options.contas.map((c) => [c.id, c.nome])), [options.contas]);

  const handleReclassify = async () => {
    if (!igrejaId) {
      toast.error("Contexto da igreja não identificado");
      return;
    }
    if (!Object.values(novosValores).some((v) => v && String(v).trim().length > 0)) {
      toast.error("Preencha ao menos um campo em 'Novo destino'");
      return;
    }
    
    setLoading(true);
    try {
      // Usa o cliente Supabase para chamar a função
      const { data, error } = await supabase.functions.invoke("reclass-transacoes", {
        body: {
          tipo,
          filtros: searchParams || filtros,
          ids: selectedIds.length ? selectedIds : undefined,
          novos_valores: Object.fromEntries(
            Object.entries(novosValores).filter(([, v]) => v !== "")
          ),
          limite: 5000,
          igreja_id: igrejaId,
          filial_id: filialId,
        },
      });

      if (error) throw error;
      if (!data?.job) throw new Error("Resposta inválida da função");

      const job = data.job as { job_id: string; aplicados: number; ignorados: number };
      setJobInfo({ id: job.job_id, aplicados: job.aplicados, ignorados: job.ignorados });
      setUndoJobId(job.job_id);
      toast.success("Job de reclassificação iniciado");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao reclassificar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadOptions = async () => {
      if (!igrejaId) return;
      const [cat, sub, cen, forn, con] = await Promise.all([
        supabase.from("categorias_financeiras").select("id, nome, tipo").eq("igreja_id", igrejaId).eq("ativo", true),
        supabase.from("subcategorias_financeiras").select("id, nome").eq("igreja_id", igrejaId).eq("ativo", true),
        supabase.from("centros_custo").select("id, nome").eq("igreja_id", igrejaId),
        supabase.from("fornecedores").select("id, nome").eq("igreja_id", igrejaId).eq("ativo", true),
        supabase.from("contas").select("id, nome").eq("igreja_id", igrejaId).eq("ativo", true),
      ]);

      const safe = <T extends { id?: string | number | null; nome?: string | null }>(rows: T[] | null) =>
        (rows || [])
          .filter((r) => r.id !== null && r.id !== undefined && String(r.id).trim().length > 0)
          .map((r) => ({ id: String(r.id), nome: r.nome ?? "" }));

      setOptions({
        categorias: safe(cat.data) as Array<{ id: string; nome: string; tipo: string }>,
        subcategorias: safe(sub.data) as Array<{ id: string; nome: string }>,
        centros: safe(cen.data) as Array<{ id: string; nome: string }>,
        fornecedores: safe(forn.data) as Array<{ id: string; nome: string }>,
        contas: safe(con.data) as Array<{ id: string; nome: string }>,
      });
    };
    loadOptions();
  }, [igrejaId]);

  useEffect(() => {
    setStep(1);
    setSearchParams(null);
    setSelectedIds([]);
  }, [tipo]);

  const { data: resultados = [], isLoading: loadingResultados } = useQuery<TransacaoPreview[]>({
    queryKey: ["reclass-results", igrejaId, filialId, isAllFiliais, searchParams],
    enabled: !!igrejaId && !!searchParams,
    queryFn: async () => {
      if (!igrejaId || !searchParams) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, descricao, data_vencimento, data_competencia, valor, status, categoria_id, subcategoria_id, centro_custo_id, fornecedor_id, conta_id"
        )
        .eq("tipo", searchParams.tipo)
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      if (searchParams.descricao) query = query.ilike("descricao", `%${searchParams.descricao}%`);
      if (searchParams.status) query = query.eq("status", searchParams.status);
      if (searchParams.dataInicio) query = query.gte("data_vencimento", searchParams.dataInicio);
      if (searchParams.dataFim) query = query.lte("data_vencimento", searchParams.dataFim);
      if (searchParams.competenciaInicio) query = query.gte("data_competencia", searchParams.competenciaInicio);
      if (searchParams.competenciaFim) query = query.lte("data_competencia", searchParams.competenciaFim);
      if (searchParams.categoria) query = query.eq("categoria_id", searchParams.categoria);
      if (searchParams.subcategoria) query = query.eq("subcategoria_id", searchParams.subcategoria);
      if (searchParams.centro) query = query.eq("centro_custo_id", searchParams.centro);
      if (searchParams.fornecedor) query = query.eq("fornecedor_id", searchParams.fornecedor);
      if (searchParams.conta) query = query.eq("conta_id", searchParams.conta);

      const { data, error } = await query.limit(5000);
      if (error) throw error;
      return (data || []).filter((r) => !!r.id).map((r) => ({ ...r, id: String(r.id) }));
    },
  });

  useEffect(() => {
    setSelectedIds(resultados.map((r) => String(r.id)));
  }, [resultados]);

  const categoriasDoTipo = useMemo(
    () => options.categorias.filter((c) => c.tipo === tipo && c.id),
    [options.categorias, tipo]
  );

  const handleFiltrar = () => {
    setSearchParams({ ...filtros, tipo });
    setStep(2);
  };

  const totalEncontrados = resultados.length;
  const totalValorEncontrado = resultados.reduce((sum: number, r: TransacaoPreview) => sum + Number(r.valor || 0), 0);
  const selectedSet = new Set(selectedIds);
  const totalSelecionados = resultados.filter((r: TransacaoPreview) => selectedSet.has(String(r.id))).length;
  const totalValorSelecionado = resultados
    .filter((r: TransacaoPreview) => selectedSet.has(String(r.id)))
    .reduce((sum: number, r: TransacaoPreview) => sum + Number(r.valor || 0), 0);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(resultados.map((r) => String(r.id)));
    else setSelectedIds([]);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((x) => x !== id);
    });
  };

  const canGoStep3 = totalSelecionados > 0;
  const stepWidth = (step - 1) * 33.33;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reclassificação Financeira</h1>
            <p className="text-sm text-muted-foreground">Wizard de reclassificação em lote</p>
          </div>
          <div className="flex gap-2">
            <Button variant={tipo === "entrada" ? "default" : "outline"} onClick={() => setTipo("entrada")} size="sm">
              Entradas
            </Button>
            <Button variant={tipo === "saida" ? "default" : "outline"} onClick={() => setTipo("saida")} size="sm">
              Saídas
            </Button>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b bg-card p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            {[
              { num: 1, label: "Filtrar" },
              { num: 2, label: "Revisar" },
              { num: 3, label: "Aplicar" },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-all ${
                    step >= s.num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.num}
                </div>
                <p className={`ml-3 text-sm font-medium hidden md:block ${step >= s.num ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </p>
                {idx < 2 && (
                  <div className={`flex-1 h-1 mx-2 rounded transition-all ${step > s.num ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${stepWidth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Etapa 1 - Filtros */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Filtrar lançamentos</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFiltros({
                        descricao: "",
                        dataInicio: "",
                        dataFim: "",
                        competenciaInicio: "",
                        competenciaFim: "",
                        categoria: "",
                        subcategoria: "",
                        centro: "",
                        fornecedor: "",
                        conta: "",
                        status: "",
                      })
                    }
                  >
                    Limpar
                  </Button>
                  <Button onClick={handleFiltrar}>Próximo</Button>
                </div>
              </div>

              <div className="border rounded-lg p-6 bg-card">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Descrição contém</Label>
                    <Input
                      value={filtros.descricao}
                      onChange={(e) => setFiltros({ ...filtros, descricao: e.target.value })}
                      placeholder="Ex.: aluguel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Input
                      value={filtros.status}
                      onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                      placeholder="pago | pendente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Venc. início</Label>
                    <Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Venc. fim</Label>
                    <Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência início</Label>
                    <Input type="date" value={filtros.competenciaInicio} onChange={(e) => setFiltros({ ...filtros, competenciaInicio: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência fim</Label>
                    <Input type="date" value={filtros.competenciaFim} onChange={(e) => setFiltros({ ...filtros, competenciaFim: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={filtros.categoria || ALL_VALUE} onValueChange={(v) => setFiltros({ ...filtros, categoria: v === ALL_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                        {categoriasDoTipo.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <Select value={filtros.subcategoria || ALL_VALUE} onValueChange={(v) => setFiltros({ ...filtros, subcategoria: v === ALL_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                        {options.subcategorias.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Centro de custo</Label>
                    <Select value={filtros.centro || ALL_VALUE} onValueChange={(v) => setFiltros({ ...filtros, centro: v === ALL_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                        {options.centros.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Select value={filtros.fornecedor || ALL_VALUE} onValueChange={(v) => setFiltros({ ...filtros, fornecedor: v === ALL_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                        {options.fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Select value={filtros.conta || ALL_VALUE} onValueChange={(v) => setFiltros({ ...filtros, conta: v === ALL_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                        {options.contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 2 - Revisar */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Revisar e selecionar</h2>
                  <p className="text-sm text-muted-foreground">
                    {loadingResultados
                      ? "Carregando prévia..."
                      : searchParams
                      ? `${totalEncontrados} encontrados (${formatCurrency(totalValorEncontrado)})`
                      : "Aplique um filtro para ver a prévia."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="font-semibold">Selecionados: {totalSelecionados} / {totalEncontrados}</p>
                    <p className="text-muted-foreground">{formatCurrency(totalValorSelecionado)}</p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={loadingResultados || !totalEncontrados}
                    onClick={() => toggleAll(selectedIds.length !== totalEncontrados)}
                  >
                    {selectedIds.length === totalEncontrados ? "Limpar" : "Selecionar todos"}
                  </Button>
                </div>
              </div>

              {totalEncontrados === 0 && !loadingResultados && searchParams && (
                <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado. Ajuste os filtros.</p>
              )}

              {loadingResultados && <p className="text-sm">Carregando...</p>}

              {!loadingResultados && totalEncontrados > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="p-3 text-left w-10">
                            <Checkbox
                              checked={totalEncontrados > 0 && selectedIds.length === totalEncontrados}
                              onCheckedChange={(v) => toggleAll(Boolean(v))}
                              aria-label="Selecionar todos"
                            />
                          </th>
                          <th className="p-3 text-left">Descrição</th>
                          <th className="p-3 text-left">Vencimento</th>
                          <th className="p-3 text-left">Competência</th>
                          <th className="p-3 text-left">Categoria</th>
                          <th className="p-3 text-left">Centro</th>
                          <th className="p-3 text-left">Fornecedor</th>
                          <th className="p-3 text-left">Conta</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map((r: TransacaoPreview) => {
                          const checked = selectedSet.has(String(r.id));
                          return (
                            <tr key={r.id} className="border-t hover:bg-muted/50">
                              <td className="p-3 text-left">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleOne(String(r.id), Boolean(v))}
                                  aria-label={`Selecionar ${r.descricao || r.id}`}
                                />
                              </td>
                              <td className="p-3 text-left font-medium">{r.descricao || "-"}</td>
                              <td className="p-3 text-left text-muted-foreground">{r.data_vencimento || "-"}</td>
                              <td className="p-3 text-left text-muted-foreground">{r.data_competencia || "-"}</td>
                              <td className="p-3 text-left">{categoriaMap[r.categoria_id || ""] || "-"}</td>
                              <td className="p-3 text-left">{centroMap[r.centro_custo_id || ""] || "-"}</td>
                              <td className="p-3 text-left">{fornecedorMap[r.fornecedor_id || ""] || "-"}</td>
                              <td className="p-3 text-left">{contaMap[r.conta_id || ""] || "-"}</td>
                              <td className="p-3 text-left">{r.status || "-"}</td>
                              <td className="p-3 text-right font-semibold">{formatCurrency(Number(r.valor || 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button disabled={!canGoStep3} onClick={() => setStep(3)}>
                  Próximo
                </Button>
              </div>
            </div>
          )}

          {/* Etapa 3 - Aplicar */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Aplicar novo destino</h2>
                <p className="text-sm text-muted-foreground">
                  Será aplicado em {totalSelecionados} lançamentos ({formatCurrency(totalValorSelecionado)}).
                </p>
              </div>

              <div className="border rounded-lg p-6 bg-card">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={novosValores.categoria_id || NONE_VALUE} onValueChange={(v) => setNovosValores({ ...novosValores, categoria_id: v === NONE_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Não alterar</SelectItem>
                        {categoriasDoTipo.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategoria</Label>
                    <Select value={novosValores.subcategoria_id || NONE_VALUE} onValueChange={(v) => setNovosValores({ ...novosValores, subcategoria_id: v === NONE_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Não alterar</SelectItem>
                        {options.subcategorias.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Centro de custo</Label>
                    <Select value={novosValores.centro_custo_id || NONE_VALUE} onValueChange={(v) => setNovosValores({ ...novosValores, centro_custo_id: v === NONE_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Não alterar</SelectItem>
                        {options.centros.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Select value={novosValores.fornecedor_id || NONE_VALUE} onValueChange={(v) => setNovosValores({ ...novosValores, fornecedor_id: v === NONE_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Não alterar</SelectItem>
                        {options.fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conta</Label>
                    <Select value={novosValores.conta_id || NONE_VALUE} onValueChange={(v) => setNovosValores({ ...novosValores, conta_id: v === NONE_VALUE ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Não alterar</SelectItem>
                        {options.contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Input value={novosValores.status} onChange={(e) => setNovosValores({ ...novosValores, status: e.target.value })} placeholder="pago | pendente" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de competência</Label>
                    <Input type="date" value={novosValores.data_competencia} onChange={(e) => setNovosValores({ ...novosValores, data_competencia: e.target.value })} />
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  As alterações serão aplicadas apenas aos {totalSelecionados} lançamentos selecionados. Verifique a prévia antes de confirmar.
                </AlertDescription>
              </Alert>

              {undoJobId && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke("undo-reclass", {
                        body: { job_id: undoJobId },
                      });

                      if (error) throw error;
                      if (!data?.reverted) throw new Error("Falha ao desfazer");

                      toast.success(`Undo aplicado: ${data.reverted} linhas`);
                    } catch (err) {
                      console.error(err);
                      toast.error(err instanceof Error ? err.message : "Erro ao desfazer");
                    }
                  }}
                >
                  Desfazer última reclassificação
                </Button>
              )}

              {jobInfo && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <h4 className="font-semibold mb-2">Resumo do job</h4>
                  <p className="text-sm">Job ID: {jobInfo.id}</p>
                  <p className="text-sm">Aplicados: {jobInfo.aplicados} | Ignorados: {jobInfo.ignorados}</p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                <Button onClick={handleReclassify} disabled={loading || !canGoStep3}>
                  {loading ? "Reclassificando..." : "Executar reclassificação"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReclassificacaoPage;
