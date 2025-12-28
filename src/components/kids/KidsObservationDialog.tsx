import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { Baby, Smile, Frown, Zap, Meh, Cloud, Droplets, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface KidsObservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crianca: {
    id: string;
    nome: string;
    avatar_url: string | null;
  };
  cultoId?: string;
  professorId?: string;
}

const HUMOR_OPTIONS = [
  { value: "feliz", label: "Feliz", icon: Smile, color: "text-green-600" },
  { value: "triste", label: "Triste", icon: Frown, color: "text-blue-600" },
  { value: "agitado", label: "Agitado", icon: Zap, color: "text-orange-600" },
  { value: "neutro", label: "Neutro", icon: Meh, color: "text-gray-600" },
  { value: "choroso", label: "Choroso", icon: Droplets, color: "text-cyan-600" },
  { value: "sonolento", label: "Sonolento", icon: Cloud, color: "text-purple-600" },
];

const COMPORTAMENTO_OPTIONS = [
  "participou",
  "orou",
  "brincou",
  "ajudou",
  "atencioso",
  "criativo",
  "compartilhou",
  "liderou",
  "obediente",
  "carinhoso",
];

const NECESSIDADES_OPTIONS = [
  "banheiro",
  "agua",
  "lanche",
  "descanso",
  "atenção_especial",
  "medicamento",
  "troca_fralda",
  "consolo",
];

export function KidsObservationDialog({
  open,
  onOpenChange,
  crianca,
  cultoId,
  professorId,
}: KidsObservationDialogProps) {
  const queryClient = useQueryClient();
  const [humor, setHumor] = useState<string>("");
  const [comportamentos, setComportamentos] = useState<string[]>([]);
  const [necessidades, setNecessidades] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [diarioId, setDiarioId] = useState<string | null>(null);

  // Buscar diário existente
  const { data: diarioExistente, isLoading } = useQuery({
    queryKey: ["kids-diario", crianca.id, cultoId],
    queryFn: async () => {
      if (!cultoId) {
        // Se não tem culto, buscar por data
        const { data, error } = await supabase
          .from("kids_diario")
          .select("*")
          .eq("crianca_id", crianca.id)
          .eq("data", format(new Date(), "yyyy-MM-dd"))
          .is("evento_id", null)
          .maybeSingle();

        if (error) throw error;
        return data;
      }

      // Se tem culto, buscar por evento_id
      const { data, error } = await supabase
        .from("kids_diario")
        .select("*")
        .eq("crianca_id", crianca.id)
        .eq("evento_id", cultoId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Preencher formulário com dados existentes
  useEffect(() => {
    if (diarioExistente) {
      setDiarioId(diarioExistente.id);
      setHumor(diarioExistente.humor || "");
      setComportamentos(diarioExistente.comportamento_tags || []);
      setNecessidades(diarioExistente.necessidades_tags || []);
      setObservacoes(diarioExistente.observacoes || "");
    } else {
      // Resetar formulário para novo registro
      setDiarioId(null);
      setHumor("");
      setComportamentos([]);
      setNecessidades([]);
      setObservacoes("");
    }
  }, [diarioExistente, open]);

  // Mutation para salvar/atualizar diário
  const salvarDiario = useMutation({
    mutationFn: async () => {
      if (!professorId) throw new Error("Professor não identificado");

      const dados = {
        crianca_id: crianca.id,
        evento_id: cultoId || null,
        data: format(new Date(), "yyyy-MM-dd"),
        professor_id: professorId,
        comportamento_tags: comportamentos,
        necessidades_tags: necessidades,
        humor: humor || null,
        observacoes: observacoes || null,
      };

      if (diarioId) {
        // Atualizar existente
        const { data, error } = await supabase
          .from("kids_diario")
          .update(dados)
          .eq("id", diarioId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Criar novo
        const { data, error } = await supabase
          .from("kids_diario")
          .insert(dados)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success(diarioId ? "Diário atualizado com sucesso!" : "Diário registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["criancas-presentes-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["kids-diario"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      console.error("Erro ao salvar diário:", error);
      toast.error("Erro ao salvar diário: " + error instanceof Error ? error.message : String(error));
    },
  });

  const handleSalvar = () => {
    if (!humor) {
      toast.error("Por favor, selecione o humor da criança");
      return;
    }
    salvarDiario.mutate();
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{ className: "max-w-2xl p-0" }}
      drawerContentProps={{ className: "p-0" }}
    >
      <div className="flex flex-col max-h-[90vh] h-full">
        <DialogTitle className="sr-only">Diário de {crianca.nome}</DialogTitle>
        <div className="border-b px-6 pt-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-2">
            <Avatar className="w-12 h-12 shrink-0">
              <AvatarImage src={crianca.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10">
                <Baby className="w-6 h-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-base sm:text-lg font-semibold truncate">Diário de {crianca.nome}</p>
              <p className="text-xs sm:text-sm font-normal text-muted-foreground">
                {format(new Date(), "dd 'de' MMMM 'de' yyyy")}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {diarioId ? "Edite as observações do dia" : "Registre as observações do dia"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Como estava hoje? *</Label>
              <ToggleGroup
                type="single"
                value={humor}
                onValueChange={setHumor}
                className="grid grid-cols-3 gap-2"
              >
                {HUMOR_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      className="flex flex-col items-center gap-1.5 h-auto py-2 px-2"
                    >
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${option.color}`} />
                      <span className="text-xs sm:text-sm text-center leading-tight">{option.label}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Comportamento Positivo</Label>
              <ToggleGroup
                type="multiple"
                value={comportamentos}
                onValueChange={setComportamentos}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2"
              >
                {COMPORTAMENTO_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="text-xs sm:text-sm capitalize h-auto py-2 px-2 text-center"
                  >
                    {option.replace("_", " ")}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Necessidades Atendidas</Label>
              <ToggleGroup
                type="multiple"
                value={necessidades}
                onValueChange={setNecessidades}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2"
              >
                {NECESSIDADES_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="text-xs sm:text-sm capitalize h-auto py-2 px-2 text-center"
                  >
                    {option.replace("_", " ")}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="space-y-3">
              <Label htmlFor="observacoes" className="text-base font-semibold">
                Recado para os Pais
              </Label>
              <Textarea
                id="observacoes"
                placeholder="Ex: Hoje participou bastante da história bíblica e fez novos amigos..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <div className="border-t px-6 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvarDiario.isPending}
            className="flex-1"
          >
            {salvarDiario.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {diarioId ? "Atualizar" : "Salvar"}
              </>
            )}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
