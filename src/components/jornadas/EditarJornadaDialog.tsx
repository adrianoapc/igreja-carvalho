import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, GripVertical, Trash2, Play, FileText, Users, Settings2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import EtapaContentDialog from "./EtapaContentDialog";

interface EditarJornadaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornada: any;
  onSuccess: () => void;
}

const CORES_TEMA = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

interface EtapaLocal {
  id?: string;
  titulo: string;
  ordem: number;
  isNew?: boolean;
  tipo_conteudo?: string | null;
  conteudo_url?: string | null;
  conteudo_texto?: string | null;
}

const getContentIcon = (tipo: string | null | undefined) => {
  switch (tipo) {
    case "video":
      return <Play className="w-3.5 h-3.5 text-red-500" />;
    case "texto":
      return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    case "presencial":
      return <Users className="w-3.5 h-3.5 text-green-500" />;
    default:
      return null;
  }
};

export default function EditarJornadaDialog({
  open,
  onOpenChange,
  jornada,
  onSuccess,
}: EditarJornadaDialogProps) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corTema, setCorTema] = useState(CORES_TEMA[0]);
  const [ativo, setAtivo] = useState(true);
  const [tipoJornada, setTipoJornada] = useState<'auto_instrucional' | 'processo_acompanhado' | 'hibrido'>('auto_instrucional');
  const [exibirPortal, setExibirPortal] = useState(true);
  const [requerPagamento, setRequerPagamento] = useState(false);
  const [valor, setValor] = useState<string>("");
  const [etapas, setEtapas] = useState<EtapaLocal[]>([]);
  const [selectedEtapa, setSelectedEtapa] = useState<EtapaLocal | null>(null);
  const [showContentDialog, setShowContentDialog] = useState(false);

  // Fetch etapas
  const { data: etapasData, refetch: refetchEtapas } = useQuery({
    queryKey: ["etapas-jornada-edit", jornada?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas_jornada")
        .select("*")
        .eq("jornada_id", jornada.id)
        .order("ordem");

      if (error) throw error;
      return data;
    },
    enabled: open && !!jornada?.id,
  });

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && jornada) {
      setTitulo(jornada.titulo);
      setDescricao(jornada.descricao || "");
      setCorTema(jornada.cor_tema || CORES_TEMA[0]);
      setAtivo(jornada.ativo);
      setTipoJornada(jornada.tipo_jornada || 'auto_instrucional');
      setExibirPortal(jornada.exibir_portal ?? true);
      setRequerPagamento(!!jornada.requer_pagamento);
      setValor(jornada.valor ? String(jornada.valor) : "");
    }
  }, [open, jornada]);

  useEffect(() => {
    if (etapasData) {
      setEtapas(
        etapasData.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          ordem: e.ordem,
          tipo_conteudo: e.tipo_conteudo,
          conteudo_url: e.conteudo_url,
          conteudo_texto: e.conteudo_texto,
        }))
      );
    }
  }, [etapasData]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Update jornada
      const { error: jornadaError } = await supabase
        .from("jornadas")
        .update({
          titulo,
          descricao: descricao || null,
          cor_tema: corTema,
          ativo,
          tipo_jornada: tipoJornada,
          exibir_portal: tipoJornada === 'processo_acompanhado' ? false : exibirPortal,
          requer_pagamento: tipoJornada === 'processo_acompanhado' ? false : requerPagamento,
          valor: tipoJornada === 'processo_acompanhado' || !requerPagamento ? null : Number(valor),
        })
        .eq("id", jornada.id);

      if (jornadaError) throw jornadaError;

      // Handle etapas
      const existingIds = etapasData?.map((e) => e.id) || [];
      const currentIds = etapas.filter((e) => e.id).map((e) => e.id);
      const toDelete = existingIds.filter((id) => !currentIds.includes(id));

      // Delete removed etapas
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("etapas_jornada")
          .delete()
          .in("id", toDelete);

        if (deleteError) throw deleteError;
      }

      // Update/Insert etapas
      for (let i = 0; i < etapas.length; i++) {
        const etapa = etapas[i];
        if (etapa.id) {
          // Update existing
          const { error } = await supabase
            .from("etapas_jornada")
            .update({ titulo: etapa.titulo, ordem: i + 1 })
            .eq("id", etapa.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase.from("etapas_jornada").insert({
            jornada_id: jornada.id,
            titulo: etapa.titulo,
            ordem: i + 1,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Jornada atualizada!");
      onSuccess();
    },
    onError: (error) => {
      console.error("Error updating jornada:", error);
      toast.error("Erro ao atualizar jornada");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jornadas")
        .delete()
        .eq("id", jornada.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Jornada excluída!");
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error deleting jornada:", error);
      toast.error("Erro ao excluir jornada");
    },
  });

  const addEtapa = () => {
    setEtapas([
      ...etapas,
      { titulo: `Etapa ${etapas.length + 1}`, ordem: etapas.length + 1, isNew: true },
    ]);
  };

  const removeEtapa = (index: number) => {
    if (etapas.length > 1) {
      setEtapas(etapas.filter((_, i) => i !== index));
    }
  };

  const updateEtapa = (index: number, value: string) => {
    const newEtapas = [...etapas];
    newEtapas[index] = { ...newEtapas[index], titulo: value };
    setEtapas(newEtapas);
  };

  const handleEditContent = (etapa: EtapaLocal) => {
    if (!etapa.id) {
      toast.error("Salve a jornada primeiro para configurar o conteúdo");
      return;
    }
    setSelectedEtapa(etapa);
    setShowContentDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Informe o título da jornada");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Jornada</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
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

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Jornada Ativa</Label>
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <Label className="font-medium">Tipo de Jornada</Label>
              <RadioGroup value={tipoJornada} onValueChange={(v: any) => setTipoJornada(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto_instrucional" id="tipo_curso" />
                  <Label htmlFor="tipo_curso" className="font-normal cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Curso / EAD</p>
                        <p className="text-xs text-muted-foreground">Conteúdo educacional com etapas, vídeos e materiais</p>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="processo_acompanhado" id="tipo_processo" />
                  <Label htmlFor="tipo_processo" className="font-normal cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Processo / Pipeline</p>
                        <p className="text-xs text-muted-foreground">Acompanhamento de pessoas em um processo interno (pastoral, onboarding, etc)</p>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hibrido" id="tipo_hibrido" />
                  <Label htmlFor="tipo_hibrido" className="font-normal cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">Híbrido</p>
                        <p className="text-xs text-muted-foreground">Combina conteúdo educacional com acompanhamento em processo</p>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

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

            {tipoJornada !== 'processo_acompanhado' && (
              <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
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

            {tipoJornada === 'processo_acompanhado' && (
              <Alert>
                <AlertDescription>
                  Processos acompanhados não são visíveis no portal do aluno e não são pagos. Utilize este tipo para pipelines internos de acompanhamento pastoral.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etapas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEtapa}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {etapas.map((etapa, index) => (
                  <div key={etapa.id || `new-${index}`} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground w-6 shrink-0">
                      {index + 1}.
                    </span>
                    <Input
                      value={etapa.titulo}
                      onChange={(e) => updateEtapa(index, e.target.value)}
                      className="flex-1"
                    />
                    {/* Content Type Icon */}
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {getContentIcon(etapa.tipo_conteudo)}
                    </div>
                    {/* Edit Content Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditContent(etapa)}
                      title="Configurar Conteúdo"
                      className="shrink-0"
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEtapa(index)}
                      disabled={etapas.length <= 1}
                      className="shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em <Settings2 className="w-3 h-3 inline" /> para adicionar vídeo ou texto à etapa
              </p>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Jornada?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todas as inscrições serão removidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {selectedEtapa && (
        <EtapaContentDialog
          open={showContentDialog}
          onOpenChange={setShowContentDialog}
          etapa={selectedEtapa}
          jornadaId={jornada?.id}
          onSuccess={() => {
            refetchEtapas();
          }}
        />
      )}
    </>
  );
}
