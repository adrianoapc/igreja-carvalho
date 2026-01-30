import { useState, useEffect } from "react";
import { type InputHTMLAttributes } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import InputMask from "react-input-mask";
import { removerFormatacao } from "@/lib/validators";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";
import { cn } from "@/lib/utils";

const contatosSchema = z.object({
  cep: z.string().max(10).nullable(),
  cidade: z.string().max(100).nullable(),
  bairro: z.string().max(100).nullable(),
  estado: z.string().max(2).nullable(),
  endereco: z.string().max(255).nullable(),
  email: z.string().email("Email inválido").max(255).nullable().or(z.literal("")),
  telefone: z.string().max(20).nullable(),
});

interface EditarContatosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    cep: string | null;
    cidade: string | null;
    bairro: string | null;
    estado: string | null;
    endereco: string | null;
    email: string | null;
    telefone: string | null;
  };
  onSuccess: () => void;
}

export function EditarContatosDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarContatosDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cep: dadosAtuais.cep || "",
    cidade: dadosAtuais.cidade || "",
    bairro: dadosAtuais.bairro || "",
    estado: dadosAtuais.estado || "",
    endereco: dadosAtuais.endereco || "",
    email: dadosAtuais.email || "",
    telefone: dadosAtuais.telefone || "",
  });
  const { toast } = useToast();
  const { buscarCep, loading: cepLoading, error: cepError } = useCepAutocomplete();

  const handleCepBlur = async () => {
    const dados = await buscarCep(formData.cep);
    if (dados) {
      setFormData((prev) => ({
        ...prev,
        endereco: dados.logradouro || prev.endereco,
        bairro: dados.bairro || prev.bairro,
        cidade: dados.localidade || prev.cidade,
        estado: dados.uf || prev.estado,
      }));
    }
    if (cepError) {
      toast({
        title: "Aviso",
        description: cepError,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      setFormData({
        cep: dadosAtuais.cep || "",
        cidade: dadosAtuais.cidade || "",
        bairro: dadosAtuais.bairro || "",
        estado: dadosAtuais.estado || "",
        endereco: dadosAtuais.endereco || "",
        email: dadosAtuais.email || "",
        telefone: dadosAtuais.telefone || "",
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = contatosSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          cep: validatedData.cep ? removerFormatacao(validatedData.cep) : null,
          cidade: validatedData.cidade || null,
          bairro: validatedData.bairro || null,
          estado: validatedData.estado?.toUpperCase() || null,
          endereco: validatedData.endereco || null,
          email: validatedData.email || null,
          telefone: validatedData.telefone ? removerFormatacao(validatedData.telefone) : null,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados de contato atualizados com sucesso",
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
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Editar Contatos"
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <InputMask
                  mask="99999-999"
                  value={formData.cep}
                  onChange={(e) =>
                    setFormData({ ...formData, cep: e.target.value })
                  }
                  onBlur={handleCepBlur}
                >
                  {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                      {...inputProps}
                      id="cep"
                      placeholder="00000-000"
                      className={cn(cepLoading && "pr-10")}
                    />
                  )}
                </InputMask>
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData({ ...formData, cidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) =>
                  setFormData({ ...formData, bairro: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(e) =>
                  setFormData({ ...formData, estado: e.target.value })
                }
                maxLength={2}
                placeholder="SP"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) =>
                  setFormData({ ...formData, endereco: e.target.value })
                }
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Celular</Label>
              <InputMask
                mask="(99) 99999-9999"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: e.target.value })
                }
              >
                {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                  <Input
                    {...inputProps}
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                  />
                )}
              </InputMask>
            </div>
          </div>
          </div>

          {/* Footer */}
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
