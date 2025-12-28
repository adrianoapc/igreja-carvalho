import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, X, GripVertical, BookOpen, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface NovaJornadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CORES_TEMA = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export default function NovaJornadaDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovaJornadaDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corTema, setCorTema] = useState(CORES_TEMA[0]);
  const [tipoJornada, setTipoJornada] = useState<'auto_instrucional' | 'processo_acompanhado' | 'hibrido'>('auto_instrucional');
  const [exibirPortal, setExibirPortal] = useState(true);
  const [etapas, setEtapas] = useState<string[]>(["Etapa 1", "Etapa 2", "Etapa 3"]);
  const [requerPagamento, setRequerPagamento] = useState(false);
  const [valor, setValor] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create jornada
      const { data: jornada, error: jornadaError } = await supabase
        .from("jornadas")
        .insert({
          titulo,
          descricao: descricao || null,
          cor_tema: corTema,
          tipo_jornada: tipoJornada,
          exibir_portal: tipoJornada === 'processo_acompanhado' ? false : exibirPortal,
          requer_pagamento: tipoJornada === 'processo_acompanhado' ? false : requerPagamento,
          valor: (tipoJornada !== 'processo_acompanhado' && requerPagamento) ? Number(valor) : null,
        })
        .select()
        .single();

      if (jornadaError) throw jornadaError;

      // Create etapas
      const etapasToInsert = etapas
        .filter((e) => e.trim())
        .map((titulo, index) => ({
          jornada_id: jornada.id,
          titulo,
          ordem: index + 1,
        }));

      if (etapasToInsert.length > 0) {
        const { error: etapasError } = await supabase
          .from("etapas_jornada")
          .insert(etapasToInsert);

        if (etapasError) throw etapasError;
      }

      return jornada;
    },
    onSuccess: () => {
      toast.success("Jornada criada com sucesso!");
      resetForm();
      onSuccess();
    },
    onError: (error) => {
      console.error("Error creating jornada:", error);
      toast.error("Erro ao criar jornada");
    },
  });

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setCorTema(CORES_TEMA[0]);
    setTipoJornada('auto_instrucional');
    setExibirPortal(true);
    setEtapas(["Etapa 1", "Etapa 2", "Etapa 3"]);
    setRequerPagamento(false);
    setValor("");
  };

  const addEtapa = () => {
    setEtapas([...etapas, `Etapa ${etapas.length + 1}`]);
  };

  const removeEtapa = (index: number) => {
    if (etapas.length > 1) {
      setEtapas(etapas.filter((_, i) => i !== index));
    }
  };

  const updateEtapa = (index: number, value: string) => {
    const newEtapas = [...etapas];
    newEtapas[index] = value;
    setEtapas(newEtapas);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título da jornada");
      return;
    }
    if (etapas.filter((e) => e.trim()).length === 0) {
      toast.error("Adicione pelo menos uma etapa");
      return;
    }
    createMutation.mutate();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold">Nova Jornada</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Escola de Líderes 2025"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o objetivo desta jornada..."
              rows={2}
            />
          </div>

          {/* Tipo de Jornada */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <Label className="font-semibold text-base">Tipo de Jornada *</Label>
            <RadioGroup value={tipoJornada} onValueChange={(value: "auto_instrucional" | "hibrido" | "processo_acompanhado") => setTipoJornada(value)}>
              <div className="space-y-3">
                {/* Curso / EAD */}
                <Label
                  htmlFor="auto_instrucional"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    tipoJornada === 'auto_instrucional'
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="auto_instrucional" id="auto_instrucional" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <p className="font-medium">Curso / EAD</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Focado em conteúdo (vídeos, textos, quizzes). O aluno avança sozinho pelo player.
                    </p>
                  </div>
                </Label>

                {/* Processo / Pipeline */}
                <Label
                  htmlFor="processo_acompanhado"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    tipoJornada === 'processo_acompanhado'
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="processo_acompanhado" id="processo_acompanhado" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <p className="font-medium">Processo / Pipeline</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Focado em gestão de pessoas. Progresso controlado pelo líder no Kanban. Não aparece no portal do membro.
                    </p>
                  </div>
                </Label>

                {/* Híbrido */}
                <Label
                  htmlFor="hibrido"
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    tipoJornada === 'hibrido'
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="hibrido" id="hibrido" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      <p className="font-medium">Híbrido</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Combina ambos: player para o aluno + Kanban para o líder acompanhar.
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Cor do Tema</Label>
            <div className="flex gap-2 flex-wrap">
              {CORES_TEMA.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-all ${
                    corTema === cor
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: cor }}
                  onClick={() => setCorTema(cor)}
                />
                ))}
              </div>
            </div>

            {/* Portal visibility - hidden for processo */}
            {tipoJornada !== 'processo_acompanhado' && (
              <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="exibir_portal" className="font-medium">
                    Disponível no Portal do Aluno?
                  </Label>
                  <Switch
                    id="exibir_portal"
                    checked={exibirPortal}
                    onCheckedChange={setExibirPortal}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se desmarcado, esta jornada será invisível para o membro, servindo apenas para controle interno da liderança.
                </p>
              </div>
            )}

            {tipoJornada === 'processo_acompanhado' && (
              <Alert>
                <AlertDescription className="text-xs">
                  ✓ Processos internos não aparecem no portal do membro.
                </AlertDescription>
              </Alert>
            )}

            {/* Paid course - disabled for processo */}
            {tipoJornada !== 'processo_acompanhado' && (
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requer_pagamento" className="font-medium">
                    Este curso é pago?
                  </Label>
                  <Switch
                    id="requer_pagamento"
                    checked={requerPagamento}
                    onCheckedChange={setRequerPagamento}
                  />
                </div>
                {requerPagamento && (
                  <div className="space-y-2">
                    <Label>Valor da Inscrição (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Etapas {tipoJornada === 'processo_acompanhado' ? '(Colunas do Kanban)' : '(Capítulos)'}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEtapa}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {etapas.map((etapa, index) => (
                <div key={index} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground w-6">
                    {index + 1}.
                  </span>
                  <Input
                    value={etapa}
                    onChange={(e) => updateEtapa(index, e.target.value)}
                    placeholder={`Etapa ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEtapa(index)}
                    disabled={etapas.length <= 1}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Jornada"}
            </Button>
          </div>
          </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
