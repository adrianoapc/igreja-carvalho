import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Checkbox } from "@/components/ui/checkbox";

type FinanceiroConfig = {
  id?: string;
  igreja_id: string;
  filial_id: string | null;
  blind_count_mode: string;
  blind_min_counters: number;
  blind_tolerance_value: number;
  blind_compare_level: string;
  blind_lock_totals: boolean;
  provider_tipo: string | null;
  webhook_url: string | null;
  secret_hint: string | null;
  sync_strategy: string | null;
  periodos?: string[] | null;
  formas_fisicas_ids?: string[] | null;
  formas_digitais_ids?: string[] | null;
  tipos_permitidos_fisico?: string[] | null;
  tipos_permitidos_digital?: string[] | null;
  valor_zero_policy?: string | null;
};

export default function ConfigFinanceiro() {
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FinanceiroConfig | null>(null);
  const [periodosText, setPeriodosText] = useState("");
  const [selFormasFisicas, setSelFormasFisicas] = useState<string[]>([]);
  const [selFormasDigitais, setSelFormasDigitais] = useState<string[]>([]);
  const [selTiposFisico, setSelTiposFisico] = useState<string[]>([]);
  const [selTiposDigital, setSelTiposDigital] = useState<string[]>([]);
  const [valorZeroPolicy, setValorZeroPolicy] = useState<string>(
    "allow-zero-with-confirmation"
  );

  const { data: cfg } = useQuery({
    queryKey: ["financeiro-config", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return null;
      let q = supabase
        .from("financeiro_config")
        .select("*")
        .eq("igreja_id", igrejaId)
        .limit(1);
      // Preferir config específica da filial se não for "todas"
      if (!isAllFiliais && filialId) {
        q = q
          .or(`filial_id.eq.${filialId},filial_id.is.null`)
          .order("filial_id", { ascending: false });
      } else {
        q = q.is("filial_id", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!igrejaId && !authLoading,
  });

  // Formas de pagamento
  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-config", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [] as any[];
      let q = supabase
        .from("formas_pagamento")
        .select("id, nome, gera_pago, is_digital, ativo")
        .eq("igreja_id", igrejaId)
        .eq("ativo", true)
        .order("nome");
      if (!isAllFiliais && filialId) q = q.eq("filial_id", filialId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!igrejaId && !authLoading,
  });

  // Categorias de entrada
  const { data: categoriasEntrada } = useQuery({
    queryKey: ["categorias-entrada-config", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [] as any[];
      let q = supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", "entrada")
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) q = q.eq("filial_id", filialId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!igrejaId && !authLoading,
  });

  useEffect(() => {
    if (!igrejaId) return;
    if (cfg) {
      const allowedBlindModes = ["off", "optional", "required"];
      const allowedCompareLevels = ["tipo", "total"];
      setForm({
        id: cfg.id,
        igreja_id: cfg.igreja_id,
        filial_id: cfg.filial_id,
        blind_count_mode: allowedBlindModes.includes(
          String(cfg.blind_count_mode)
        )
          ? String(cfg.blind_count_mode)
          : "optional",
        blind_min_counters: Number(cfg.blind_min_counters ?? 2),
        blind_tolerance_value: Number(cfg.blind_tolerance_value ?? 0),
        blind_compare_level: allowedCompareLevels.includes(
          String(cfg.blind_compare_level)
        )
          ? String(cfg.blind_compare_level)
          : "tipo",
        blind_lock_totals: Boolean(cfg.blind_lock_totals),
        provider_tipo: cfg.provider_tipo,
        webhook_url: cfg.webhook_url,
        secret_hint: cfg.secret_hint,
        sync_strategy: cfg.sync_strategy,
        periodos: cfg.periodos || null,
        formas_fisicas_ids: cfg.formas_fisicas_ids || null,
        formas_digitais_ids: cfg.formas_digitais_ids || null,
        tipos_permitidos_fisico: cfg.tipos_permitidos_fisico || null,
        tipos_permitidos_digital: cfg.tipos_permitidos_digital || null,
        valor_zero_policy:
          cfg.valor_zero_policy || "allow-zero-with-confirmation",
      });
      setPeriodosText((cfg.periodos || []).join(","));
      setSelFormasFisicas(cfg.formas_fisicas_ids || []);
      setSelFormasDigitais(cfg.formas_digitais_ids || []);
      setSelTiposFisico(cfg.tipos_permitidos_fisico || []);
      setSelTiposDigital(cfg.tipos_permitidos_digital || []);
      setValorZeroPolicy(
        cfg.valor_zero_policy || "allow-zero-with-confirmation"
      );
    } else {
      setForm({
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId || null : null,
        blind_count_mode: "optional",
        blind_min_counters: 2,
        blind_tolerance_value: 0,
        blind_compare_level: "tipo",
        blind_lock_totals: true,
        provider_tipo: null,
        webhook_url: null,
        secret_hint: null,
        sync_strategy: null,
        periodos: ["Manhã", "Noite"],
        formas_fisicas_ids: [],
        formas_digitais_ids: [],
        tipos_permitidos_fisico: [],
        tipos_permitidos_digital: [],
        valor_zero_policy: "allow-zero-with-confirmation",
      });
      setPeriodosText("Manhã,Noite");
      setSelFormasFisicas([]);
      setSelFormasDigitais([]);
      setSelTiposFisico([]);
      setSelTiposDigital([]);
      setValorZeroPolicy("allow-zero-with-confirmation");
    }
  }, [cfg, igrejaId, filialId, isAllFiliais]);

  const setField = <K extends keyof FinanceiroConfig>(
    key: K,
    value: FinanceiroConfig[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!form || !igrejaId) return;
    setSaving(true);
    try {
      const periodosArr = periodosText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (form.id) {
        const { error } = await supabase
          .from("financeiro_config")
          .update({
            blind_count_mode: form.blind_count_mode,
            blind_min_counters: form.blind_min_counters,
            blind_tolerance_value: form.blind_tolerance_value,
            blind_compare_level: form.blind_compare_level,
            blind_lock_totals: form.blind_lock_totals,
            periodos: periodosArr,
            formas_fisicas_ids: selFormasFisicas,
            formas_digitais_ids: selFormasDigitais,
            tipos_permitidos_fisico: selTiposFisico,
            tipos_permitidos_digital: selTiposDigital,
            valor_zero_policy: valorZeroPolicy,
          })
          .eq("id", form.id)
          .eq("igreja_id", igrejaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financeiro_config").upsert(
          {
            igreja_id: igrejaId,
            filial_id: form.filial_id,
            blind_count_mode: form.blind_count_mode,
            blind_min_counters: form.blind_min_counters,
            blind_tolerance_value: form.blind_tolerance_value,
            blind_compare_level: form.blind_compare_level,
            blind_lock_totals: form.blind_lock_totals,
            periodos: periodosArr,
            formas_fisicas_ids: selFormasFisicas,
            formas_digitais_ids: selFormasDigitais,
            tipos_permitidos_fisico: selTiposFisico,
            tipos_permitidos_digital: selTiposDigital,
            valor_zero_policy: valorZeroPolicy,
          },
          { onConflict: "igreja_id,filial_id" }
        );
        if (error) throw error;
      }
      toast.success("Configuração salva com sucesso.");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Falha ao salvar configuração", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Configuração Financeira
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Parâmetros da Conferência Cega e integração com provedores.
        </p>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">Conferência Cega</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modo de contagem</Label>
              <Select
                value={form.blind_count_mode}
                onValueChange={(v) => setField("blind_count_mode", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Sem conferência</SelectItem>
                  <SelectItem value="optional">Opcional</SelectItem>
                  <SelectItem value="required">Obrigatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mínimo de conferentes</Label>
              <Input
                type="number"
                min={1}
                value={form.blind_min_counters}
                onChange={(e) =>
                  setField("blind_min_counters", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tolerância de divergência (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.blind_tolerance_value}
                onChange={(e) =>
                  setField("blind_tolerance_value", Number(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Nível de comparação</Label>
              <Select
                value={form.blind_compare_level}
                onValueChange={(v) => setField("blind_compare_level", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tipo">Por tipo</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bloquear totais (sem edição)</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.blind_lock_totals}
                  onCheckedChange={(v) =>
                    setField("blind_lock_totals", Boolean(v))
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Impede edição após submissão
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">Integração com Provedores</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de provedor</Label>
              <Input
                value={form.provider_tipo || ""}
                onChange={(e) => setField("provider_tipo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={form.webhook_url || ""}
                onChange={(e) => setField("webhook_url", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hint de segredo</Label>
              <Input
                value={form.secret_hint || ""}
                onChange={(e) => setField("secret_hint", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estratégia de sincronização</Label>
              <Input
                value={form.sync_strategy || ""}
                onChange={(e) => setField("sync_strategy", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">Relatório de Ofertas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Períodos (separar por vírgula)</Label>
              <Input
                value={periodosText}
                onChange={(e) => setPeriodosText(e.target.value)}
                placeholder="Manhã,Noite"
              />
              <p className="text-xs text-muted-foreground">
                Aparecem no Step 1 do Relatório de Oferta.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Política de valor zero</Label>
              <Select
                value={valorZeroPolicy}
                onValueChange={(v) => setValorZeroPolicy(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow-zero-with-confirmation">
                    Permitir com confirmação
                  </SelectItem>
                  <SelectItem value="forbid-zero">
                    Proibir valor zerado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Formas Físicas</Label>
              <div className="border rounded p-2 space-y-1 max-h-56 overflow-auto">
                {(formasPagamento || [])
                  .filter((f: any) => !f.is_digital)
                  .map((f: any) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selFormasFisicas.includes(f.id)}
                        onCheckedChange={(v) =>
                          setSelFormasFisicas((prev) =>
                            v
                              ? [...new Set([...prev, f.id])]
                              : prev.filter((x) => x !== f.id)
                          )
                        }
                      />
                      <span>{f.nome}</span>
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Opcional: se vazio, todas as formas físicas ativas serão
                exibidas.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Formas Digitais</Label>
              <div className="border rounded p-2 space-y-1 max-h-56 overflow-auto">
                {(formasPagamento || [])
                  .filter((f: any) => !!f.is_digital)
                  .map((f: any) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selFormasDigitais.includes(f.id)}
                        onCheckedChange={(v) =>
                          setSelFormasDigitais((prev) =>
                            v
                              ? [...new Set([...prev, f.id])]
                              : prev.filter((x) => x !== f.id)
                          )
                        }
                      />
                      <span>{f.nome}</span>
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Opcional: se vazio, todas as formas digitais ativas serão
                exibidas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tipos permitidos (Físico)</Label>
              <div className="border rounded p-2 space-y-1 max-h-56 overflow-auto">
                {(categoriasEntrada || []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selTiposFisico.includes(c.id)}
                      onCheckedChange={(v) =>
                        setSelTiposFisico((prev) =>
                          v
                            ? [...new Set([...prev, c.id])]
                            : prev.filter((x) => x !== c.id)
                        )
                      }
                    />
                    <span>{c.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipos permitidos (Digital)</Label>
              <div className="border rounded p-2 space-y-1 max-h-56 overflow-auto">
                {(categoriasEntrada || []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selTiposDigital.includes(c.id)}
                      onCheckedChange={(v) =>
                        setSelTiposDigital((prev) =>
                          v
                            ? [...new Set([...prev, c.id])]
                            : prev.filter((x) => x !== c.id)
                        )
                      }
                    />
                    <span>{c.nome}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                No fechamento, a primeira categoria digital selecionada será
                usada por padrão.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-primary"
            >
              {saving ? "Salvando..." : "Salvar Parâmetros"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
