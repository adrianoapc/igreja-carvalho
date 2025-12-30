import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, UserCheck, Search } from "lucide-react";

interface Time {
  id: string;
  nome: string;
  categoria: string;
}

interface Perfil {
  id: string;
  nome: string;
}

interface Pessoa {
  id: string;
  nome: string;
}

interface EnviarConvitesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string;
  onSuccess: () => void;
}

export default function EnviarConvitesDialog({
  open,
  onOpenChange,
  eventoId,
  onSuccess,
}: EnviarConvitesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [metodoSelecionado, setMetodoSelecionado] = useState<
    "time" | "perfil" | "individual"
  >("time");
  const [timeSelecionado, setTimeSelecionado] = useState<string>("");
  const [perfilSelecionado, setPerfilSelecionado] = useState<string>("");
  const [pessoaSelecionada, setPessoaSelecionada] = useState<string>("");

  const [times, setTimes] = useState<Time[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  useEffect(() => {
    if (open) {
      loadDados();
    }
  }, [open]);

  const loadDados = async () => {
    try {
      const [timesRes, pessoasRes] = await Promise.all([
        supabase
          .from("times")
          .select("id, nome, categoria")
          .eq("ativo", true)
          .order("nome"),
        supabase.from("profiles").select("id, nome").order("nome").limit(100),
      ]);

      setTimes(timesRes.data || []);
      setPessoas(pessoasRes.data || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar dados";
      console.error("Erro ao carregar dados:", error);
      toast.error(message);
    }
  };

  const handleEnviarConvites = async () => {
    setLoading(true);
    try {
      let pessoaIds: string[] = [];

      // Determinar lista de pessoas baseado no método selecionado
      if (metodoSelecionado === "time" && timeSelecionado) {
        const { data: membros } = await supabase
          .from("membros_time")
          .select("pessoa_id")
          .eq("time_id", timeSelecionado)
          .eq("ativo", true);

        pessoaIds = (membros || []).map((m) => m.pessoa_id);
      } else if (metodoSelecionado === "individual" && pessoaSelecionada) {
        pessoaIds = [pessoaSelecionada];
      }

      if (pessoaIds.length === 0) {
        toast.error("Nenhuma pessoa encontrada para enviar convites");
        return;
      }

      // Inserir convites na tabela eventos_convites
      const convitesData = pessoaIds.map((pessoaId) => ({
        evento_id: eventoId,
        pessoa_id: pessoaId,
        status: "pendente" as const,
        enviado_em: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("eventos_convites")
        .insert(convitesData);

      if (insertError) throw insertError;

      // Disparar notificações via edge function
      const notificacoesPromises = pessoaIds.map((pessoaId) =>
        supabase.functions.invoke("disparar-alerta", {
          body: {
            user_id: pessoaId,
            titulo: "Novo Convite",
            mensagem:
              "Você recebeu um convite para um evento. Por favor, confirme sua presença.",
            tipo: "push",
            slug: "convite_evento",
          },
        })
      );

      await Promise.all(notificacoesPromises);

      toast.success(`${pessoaIds.length} convite(s) enviado(s) com sucesso!`);
      onSuccess();
      onOpenChange(false);

      // Reset form
      setMetodoSelecionado("time");
      setTimeSelecionado("");
      setPerfilSelecionado("");
      setPessoaSelecionada("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao enviar convites";
      console.error("Erro ao enviar convites:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold">Enviar Convites</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione o público alvo para enviar convites
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Método de Seleção */}
            <div className="space-y-3">
              <Label>Método de Seleção</Label>
              <RadioGroup
                value={metodoSelecionado}
                onValueChange={(value: "time" | "perfil" | "individual") =>
                  setMetodoSelecionado(value)
                }
                className="grid grid-cols-1 gap-3"
              >
                <div>
                  <RadioGroupItem value="time" id="time" className="sr-only" />
                  <Label
                    htmlFor="time"
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      metodoSelecionado === "time"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">Selecionar Time</div>
                      <div className="text-sm text-muted-foreground">
                        Enviar para todos os membros de um time
                      </div>
                    </div>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem
                    value="perfil"
                    id="perfil"
                    className="sr-only"
                  />
                  <Label
                    htmlFor="perfil"
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      metodoSelecionado === "perfil"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <UserCheck className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">Selecionar Perfil</div>
                      <div className="text-sm text-muted-foreground">
                        Enviar para todos com um perfil específico
                      </div>
                    </div>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem
                    value="individual"
                    id="individual"
                    className="sr-only"
                  />
                  <Label
                    htmlFor="individual"
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      metodoSelecionado === "individual"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Search className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">Busca Individual</div>
                      <div className="text-sm text-muted-foreground">
                        Selecionar pessoa específica
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Seleção Específica */}
            {metodoSelecionado === "time" && (
              <div className="space-y-2">
                <Label>Selecionar Time</Label>
                <Select
                  value={timeSelecionado}
                  onValueChange={setTimeSelecionado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {times.map((time) => (
                      <SelectItem key={time.id} value={time.id}>
                        <div className="flex items-center gap-2">
                          <span>{time.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {time.categoria}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {metodoSelecionado === "perfil" && (
              <div className="space-y-2">
                <Label>Selecionar Perfil</Label>
                <Select
                  value={perfilSelecionado}
                  onValueChange={setPerfilSelecionado}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map((perfil) => (
                      <SelectItem key={perfil.id} value={perfil.id}>
                        {perfil.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {metodoSelecionado === "individual" && (
              <div className="space-y-2">
                <Label>Selecionar Pessoa</Label>
                <Select
                  value={pessoaSelecionada}
                  onValueChange={setPessoaSelecionada}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Busque uma pessoa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pessoas.map((pessoa) => (
                      <SelectItem key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleEnviarConvites}
            disabled={
              loading ||
              (metodoSelecionado === "time" && !timeSelecionado) ||
              (metodoSelecionado === "perfil" && !perfilSelecionado) ||
              (metodoSelecionado === "individual" && !pessoaSelecionada)
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Convites
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
