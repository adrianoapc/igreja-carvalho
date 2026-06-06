import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const dadosAdicionaisSchema = z.object({
  escolaridade: z.string().max(100).nullable(),
  profissao: z.string().max(100).nullable(),
  nacionalidade: z.string().max(100).nullable(),
  naturalidade: z.string().max(100).nullable(),
  entrevistado_por: z.string().max(100).nullable(),
  cadastrado_por: z.string().max(100).nullable(),
  tipo_sanguineo: z.string().max(10).nullable(),
  alergias: z.string().max(500).nullable(),
  necessidades_especiais: z.string().max(500).nullable(),
  observacoes: z.string().max(1000).nullable(),
  autorizado_bot_financeiro: z.boolean().nullable(),
  autorizado_lancar_despesas: z.boolean().nullable(),
  autorizado_lancar_depositos: z.boolean().nullable(),
  autorizado_lancar_reembolsos: z.boolean().nullable(),
});

interface EditarDadosAdicionaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    escolaridade: string | null;
    profissao: string | null;
    nacionalidade: string | null;
    naturalidade: string | null;
    entrevistado_por: string | null;
    cadastrado_por: string | null;
    tipo_sanguineo: string | null;
    alergias: string | null;
    necessidades_especiais: string | null;
    observacoes: string | null;
    autorizado_bot_financeiro: boolean | null;
    autorizado_lancar_despesas?: boolean | null;
    autorizado_lancar_depositos?: boolean | null;
    autorizado_lancar_reembolsos?: boolean | null;
  };
  onSuccess: () => void;
}

export function EditarDadosAdicionaisDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarDadosAdicionaisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    escolaridade: dadosAtuais.escolaridade || "",
    profissao: dadosAtuais.profissao || "",
    nacionalidade: dadosAtuais.nacionalidade || "",
    naturalidade: dadosAtuais.naturalidade || "",
    entrevistado_por: dadosAtuais.entrevistado_por || "",
    cadastrado_por: dadosAtuais.cadastrado_por || "",
    tipo_sanguineo: dadosAtuais.tipo_sanguineo || "",
    alergias: dadosAtuais.alergias || "",
    necessidades_especiais: dadosAtuais.necessidades_especiais || "",
    observacoes: dadosAtuais.observacoes || "",
    autorizado_bot_financeiro: dadosAtuais.autorizado_bot_financeiro || false,
    autorizado_lancar_despesas: dadosAtuais.autorizado_lancar_despesas || false,
    autorizado_lancar_depositos: dadosAtuais.autorizado_lancar_depositos || false,
    autorizado_lancar_reembolsos: dadosAtuais.autorizado_lancar_reembolsos || false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        escolaridade: dadosAtuais.escolaridade || "",
        profissao: dadosAtuais.profissao || "",
        nacionalidade: dadosAtuais.nacionalidade || "",
        naturalidade: dadosAtuais.naturalidade || "",
        entrevistado_por: dadosAtuais.entrevistado_por || "",
        cadastrado_por: dadosAtuais.cadastrado_por || "",
        tipo_sanguineo: dadosAtuais.tipo_sanguineo || "",
        alergias: dadosAtuais.alergias || "",
        necessidades_especiais: dadosAtuais.necessidades_especiais || "",
        observacoes: dadosAtuais.observacoes || "",
        autorizado_bot_financeiro: dadosAtuais.autorizado_bot_financeiro || false,
        autorizado_lancar_despesas: dadosAtuais.autorizado_lancar_despesas || false,
        autorizado_lancar_depositos: dadosAtuais.autorizado_lancar_depositos || false,
        autorizado_lancar_reembolsos: dadosAtuais.autorizado_lancar_reembolsos || false,
      });
    }
  }, [open, dadosAtuais]);

  const handleMasterToggle = (checked: boolean) => {
    if (checked) {
      // Quando liga o mestre pela primeira vez, sugere todas as 3 sub-permissões
      setFormData({
        ...formData,
        autorizado_bot_financeiro: true,
        autorizado_lancar_despesas: true,
        autorizado_lancar_depositos: true,
        autorizado_lancar_reembolsos: true,
      });
    } else {
      // Quando desliga o mestre, desliga tudo
      setFormData({
        ...formData,
        autorizado_bot_financeiro: false,
        autorizado_lancar_despesas: false,
        autorizado_lancar_depositos: false,
        autorizado_lancar_reembolsos: false,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = dadosAdicionaisSchema.parse(formData);
      setLoading(true);

      // Se o mestre está desligado, garante que as sub-flags sejam false
      const masterOn = !!validatedData.autorizado_bot_financeiro;

      const { error } = await supabase
        .from("profiles")
        .update({
          escolaridade: validatedData.escolaridade || null,
          profissao: validatedData.profissao || null,
          nacionalidade: validatedData.nacionalidade || null,
          naturalidade: validatedData.naturalidade || null,
          entrevistado_por: validatedData.entrevistado_por || null,
          cadastrado_por: validatedData.cadastrado_por || null,
          tipo_sanguineo: validatedData.tipo_sanguineo || null,
          alergias: validatedData.alergias || null,
          necessidades_especiais: validatedData.necessidades_especiais || null,
          observacoes: validatedData.observacoes || null,
          autorizado_bot_financeiro: masterOn,
          autorizado_lancar_despesas: masterOn ? !!validatedData.autorizado_lancar_despesas : false,
          autorizado_lancar_depositos: masterOn ? !!validatedData.autorizado_lancar_depositos : false,
          autorizado_lancar_reembolsos: masterOn ? !!validatedData.autorizado_lancar_reembolsos : false,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados adicionais atualizados com sucesso",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : String(error) || "Não foi possível atualizar os dados",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Editar Dados Adicionais</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="escolaridade">Escolaridade</Label>
              <Input
                id="escolaridade"
                value={formData.escolaridade}
                onChange={(e) =>
                  setFormData({ ...formData, escolaridade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profissao">Profissão</Label>
              <Input
                id="profissao"
                value={formData.profissao}
                onChange={(e) =>
                  setFormData({ ...formData, profissao: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nacionalidade">Nacionalidade</Label>
              <Input
                id="nacionalidade"
                value={formData.nacionalidade}
                onChange={(e) =>
                  setFormData({ ...formData, nacionalidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="naturalidade">Naturalidade</Label>
              <Input
                id="naturalidade"
                value={formData.naturalidade}
                onChange={(e) =>
                  setFormData({ ...formData, naturalidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entrevistadoPor">Entrevistado por</Label>
              <Input
                id="entrevistadoPor"
                value={formData.entrevistado_por}
                onChange={(e) =>
                  setFormData({ ...formData, entrevistado_por: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadastradoPor">Cadastrado por</Label>
              <Input
                id="cadastradoPor"
                value={formData.cadastrado_por}
                onChange={(e) =>
                  setFormData({ ...formData, cadastrado_por: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoSanguineo">Tipo Sanguíneo</Label>
              <Input
                id="tipoSanguineo"
                value={formData.tipo_sanguineo}
                onChange={(e) =>
                  setFormData({ ...formData, tipo_sanguineo: e.target.value })
                }
                maxLength={10}
                placeholder="Ex: O+"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="alergias">Alergias</Label>
              <Textarea
                id="alergias"
                value={formData.alergias}
                onChange={(e) =>
                  setFormData({ ...formData, alergias: e.target.value })
                }
                maxLength={500}
                placeholder="Descreva alergias alimentares, medicamentosas ou outras"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="necessidadesEspeciais">Necessidades Especiais</Label>
              <Textarea
                id="necessidadesEspeciais"
                value={formData.necessidades_especiais}
                onChange={(e) =>
                  setFormData({ ...formData, necessidades_especiais: e.target.value })
                }
                maxLength={500}
                placeholder="Descreva necessidades especiais de acessibilidade, mobilidade ou outras"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                maxLength={1000}
                placeholder="Informações adicionais sobre a pessoa"
                className="min-h-[100px]"
              />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autorizado_bot_financeiro" className="text-base">
                    Autorizado Bot Financeiro
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Libera o uso do bot financeiro no WhatsApp
                  </p>
                </div>
                <Switch
                  id="autorizado_bot_financeiro"
                  checked={formData.autorizado_bot_financeiro}
                  onCheckedChange={handleMasterToggle}
                />
              </div>

              {formData.autorizado_bot_financeiro && (
                <div className="ml-4 pl-4 border-l-2 border-muted space-y-3">
                  <p className="text-xs text-muted-foreground -mt-1">
                    O que esta pessoa pode lançar pelo bot:
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autorizado_lancar_despesas" className="text-sm font-medium">
                        Lançar Despesas
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Despesas e Nova Conta
                      </p>
                    </div>
                    <Switch
                      id="autorizado_lancar_despesas"
                      checked={formData.autorizado_lancar_despesas}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, autorizado_lancar_despesas: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autorizado_lancar_depositos" className="text-sm font-medium">
                        Lançar Depósitos
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Transferências entre contas
                      </p>
                    </div>
                    <Switch
                      id="autorizado_lancar_depositos"
                      checked={formData.autorizado_lancar_depositos}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, autorizado_lancar_depositos: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autorizado_lancar_reembolsos" className="text-sm font-medium">
                        Solicitar Reembolso
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Ressarcimento pessoal
                      </p>
                    </div>
                    <Switch
                      id="autorizado_lancar_reembolsos"
                      checked={formData.autorizado_lancar_reembolsos}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, autorizado_lancar_reembolsos: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
