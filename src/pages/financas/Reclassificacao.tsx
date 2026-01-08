import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ReclassificacaoPage = () => {
  const { igrejaId, filialId } = useFilialId();
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [loading, setLoading] = useState(false);

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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [jobInfo, setJobInfo] = useState<{ id: string; aplicados: number; ignorados: number } | null>(null);
  const [options, setOptions] = useState({
    categorias: [] as Array<{ id: string; nome: string; tipo: string }>,
    subcategorias: [] as Array<{ id: string; nome: string }>,
    centros: [] as Array<{ id: string; nome: string }>,
    fornecedores: [] as Array<{ id: string; nome: string }>,
    contas: [] as Array<{ id: string; nome: string }>,
  });
  const [undoJobId, setUndoJobId] = useState<string>("");

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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const payload = {
        tipo,
        filtros,
        ids: selectedIds.length ? selectedIds : undefined,
        novos_valores: Object.fromEntries(
          Object.entries(novosValores).filter(([, v]) => v !== "")
        ),
        limite: 5000,
        igreja_id: igrejaId,
        filial_id: filialId,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reclass-transacoes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Falha na reclassificação");

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
      setOptions({
        categorias: cat.data || [],
        subcategorias: sub.data || [],
        centros: cen.data || [],
        fornecedores: forn.data || [],
        contas: con.data || [],
      });
    };
    loadOptions();
  }, [igrejaId]);

  const categoriasDoTipo = useMemo(
    () => options.categorias.filter((c) => c.tipo === tipo),
    [options.categorias, tipo]
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reclassificação Financeira</h1>
          <p className="text-sm text-muted-foreground">Reclassifique lançamentos em lote com filtros e seleção.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tipo === "entrada" ? "default" : "outline"} onClick={() => setTipo("entrada")}>Entradas</Button>
          <Button variant={tipo === "saida" ? "default" : "outline"} onClick={() => setTipo("saida")}>Saídas</Button>
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-xs">
          POC: esta tela chama a função `reclass-transacoes` (stub) para validar fluxo. Campos vazios em "Novo destino" não são enviados.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Filtros</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Descrição contém</Label>
                <Input
                  value={filtros.descricao}
                  onChange={(e) => setFiltros({ ...filtros, descricao: e.target.value })}
                  placeholder="Ex.: aluguel"
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Input
                  value={filtros.status}
                  onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                  placeholder="pago | pendente"
                />
              </div>
              <div className="space-y-1">
                <Label>Data Venc. início</Label>
                <Input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data Venc. fim</Label>
                <Input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Competência início</Label>
                <Input type="date" value={filtros.competenciaInicio} onChange={(e) => setFiltros({ ...filtros, competenciaInicio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Competência fim</Label>
                <Input type="date" value={filtros.competenciaFim} onChange={(e) => setFiltros({ ...filtros, competenciaFim: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={filtros.categoria} onValueChange={(v) => setFiltros({ ...filtros, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {categoriasDoTipo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Subcategoria</Label>
                <Select value={filtros.subcategoria} onValueChange={(v) => setFiltros({ ...filtros, subcategoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {options.subcategorias.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Centro de custo</Label>
                <Select value={filtros.centro} onValueChange={(v) => setFiltros({ ...filtros, centro: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {options.centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={filtros.fornecedor} onValueChange={(v) => setFiltros({ ...filtros, fornecedor: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {options.fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Select value={filtros.conta} onValueChange={(v) => setFiltros({ ...filtros, conta: v })}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {options.contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Seleção manual (opcional)</h3>
            <p className="text-xs text-muted-foreground">Cole IDs de transações (um por linha) para limitar a reclassificação.</p>
            <Textarea
              rows={4}
              value={selectedIds.join("\n")}
              onChange={(e) => setSelectedIds(e.target.value.split(/\n+/).filter((v) => v.trim().length))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Novo destino</h3>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={novosValores.categoria_id} onValueChange={(v) => setNovosValores({ ...novosValores, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não alterar</SelectItem>
                    {categoriasDoTipo.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Subcategoria</Label>
                <Select value={novosValores.subcategoria_id} onValueChange={(v) => setNovosValores({ ...novosValores, subcategoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não alterar</SelectItem>
                    {options.subcategorias.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Centro de custo</Label>
                <Select value={novosValores.centro_custo_id} onValueChange={(v) => setNovosValores({ ...novosValores, centro_custo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não alterar</SelectItem>
                    {options.centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select value={novosValores.fornecedor_id} onValueChange={(v) => setNovosValores({ ...novosValores, fornecedor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não alterar</SelectItem>
                    {options.fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Conta</Label>
                <Select value={novosValores.conta_id} onValueChange={(v) => setNovosValores({ ...novosValores, conta_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não alterar</SelectItem>
                    {options.contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Input value={novosValores.status} onChange={(e) => setNovosValores({ ...novosValores, status: e.target.value })} placeholder="pago | pendente" />
              </div>
              <div className="space-y-1">
                <Label>Data de competência</Label>
                <Input type="date" value={novosValores.data_competencia} onChange={(e) => setNovosValores({ ...novosValores, data_competencia: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={handleReclassify} disabled={loading}>
              {loading ? "Reclassificando..." : "Executar reclassificação"}
            </Button>
            {undoJobId && (
              <Button
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={async () => {
                  try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    const token = sessionData.session?.access_token;
                    if (!token) throw new Error("Sessão expirada");
                    const resp = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/undo-reclass`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ job_id: undoJobId }),
                      }
                    );
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || "Falha ao desfazer");
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
          </div>

          {jobInfo && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/60">
              <h4 className="font-semibold text-sm">Resumo do job</h4>
              <p className="text-xs">Job ID: {jobInfo.id}</p>
              <p className="text-xs">Aplicados: {jobInfo.aplicados} | Ignorados: {jobInfo.ignorados}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReclassificacaoPage;
