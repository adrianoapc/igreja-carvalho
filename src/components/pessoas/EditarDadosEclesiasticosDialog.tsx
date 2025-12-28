import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const dadosEclesiasticosSchema = z.object({
  entrou_por: z.string().max(100).nullable(),
  data_entrada: z.string().nullable(),
  status_igreja: z.string().max(50).nullable(),
  data_conversao: z.string().nullable(),
  batizado: z.boolean(),
  data_batismo: z.string().nullable(),
  e_lider: z.boolean(),
  e_pastor: z.boolean(),
});

interface EditarDadosEclesiasticosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    entrou_por: string | null;
    data_entrada: string | null;
    status_igreja: string | null;
    data_conversao: string | null;
    batizado: boolean | null;
    data_batismo: string | null;
    e_lider: boolean | null;
    e_pastor: boolean | null;
  };
  onSuccess: () => void;
}

export function EditarDadosEclesiasticosDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarDadosEclesiasticosDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    entrou_por: dadosAtuais.entrou_por || "",
    data_entrada: dadosAtuais.data_entrada || "",
    status_igreja: dadosAtuais.status_igreja || "ativo",
    data_conversao: dadosAtuais.data_conversao || "",
    batizado: dadosAtuais.batizado || false,
    data_batismo: dadosAtuais.data_batismo || "",
    e_lider: dadosAtuais.e_lider || false,
    e_pastor: dadosAtuais.e_pastor || false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        entrou_por: dadosAtuais.entrou_por || "",
        data_entrada: dadosAtuais.data_entrada || "",
        status_igreja: dadosAtuais.status_igreja || "ativo",
        data_conversao: dadosAtuais.data_conversao || "",
        batizado: dadosAtuais.batizado || false,
        data_batismo: dadosAtuais.data_batismo || "",
        e_lider: dadosAtuais.e_lider || false,
        e_pastor: dadosAtuais.e_pastor || false,
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = dadosEclesiasticosSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          entrou_por: validatedData.entrou_por || null,
          data_entrada: validatedData.data_entrada || null,
          status_igreja: validatedData.status_igreja || null,
          data_conversao: validatedData.data_conversao || null,
          batizado: validatedData.batizado,
          data_batismo: validatedData.data_batismo || null,
          e_lider: validatedData.e_lider,
          e_pastor: validatedData.e_pastor,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados eclesiásticos atualizados com sucesso",
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
          <h2 className="text-lg font-semibold leading-none tracking-tight">Editar Dados Eclesiásticos</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entrouPor">Entrou por</Label>
              <Select
                value={formData.entrou_por}
                onValueChange={(value) =>
                  setFormData({ ...formData, entrou_por: value })
                }
              >
                <SelectTrigger id="entrouPor">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Convite">Convite</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Espontâneo">Espontâneo</SelectItem>
                  <SelectItem value="Redes Sociais">Redes Sociais</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataEntrada">Data de Entrada</Label>
              <Input
                id="dataEntrada"
                type="date"
                value={formData.data_entrada}
                onChange={(e) =>
                  setFormData({ ...formData, data_entrada: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusIgreja">Status na Igreja</Label>
              <Select
                value={formData.status_igreja}
                onValueChange={(value) =>
                  setFormData({ ...formData, status_igreja: value })
                }
              >
                <SelectTrigger id="statusIgreja">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataConversao">Data da Conversão</Label>
              <Input
                id="dataConversao"
                type="date"
                value={formData.data_conversao}
                onChange={(e) =>
                  setFormData({ ...formData, data_conversao: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataBatismo">Data de Batismo</Label>
              <Input
                id="dataBatismo"
                type="date"
                value={formData.data_batismo}
                onChange={(e) =>
                  setFormData({ ...formData, data_batismo: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="batizado"
                checked={formData.batizado}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, batizado: checked })
                }
              />
              <Label htmlFor="batizado">Foi batizado(a)?</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="lider"
                checked={formData.e_lider}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, e_lider: checked })
                }
              />
              <Label htmlFor="lider">É líder?</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="pastor"
                checked={formData.e_pastor}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, e_pastor: checked })
                }
              />
              <Label htmlFor="pastor">É pastor?</Label>
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
