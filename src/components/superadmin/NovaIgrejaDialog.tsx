import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatarCPF,
  formatarTelefone,
  formatarCEP,
  removerFormatacao,
} from "@/lib/validators";
import { Loader2 } from "lucide-react";

interface NovaIgrejaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaIgrejaDialog({
  open,
  onOpenChange,
  onSuccess,
}: NovaIgrejaDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
  });

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === "cnpj") {
      const digits = removerFormatacao(value);
      if (digits.length <= 14) {
        formattedValue = digits.replace(
          /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
          "$1.$2.$3/$4-$5"
        );
      }
    } else if (field === "telefone") {
      formattedValue = formatarTelefone(value);
    } else if (field === "cep") {
      formattedValue = formatarCEP(value);
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome da igreja é obrigatório", variant: "destructive" });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Email é obrigatório para criar o admin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Timeout de segurança para evitar freeze eterno
    const timeoutId = setTimeout(() => {
      console.warn(
        "NovaIgrejaDialog: Timeout reached, resetting loading state"
      );
      setLoading(false);
      toast({
        title: "Operação demorando muito",
        description:
          "Tente novamente. Se o problema persistir, contate o suporte.",
        variant: "destructive",
      });
    }, 30000); // 30 segundos timeout

    try {
      // 1. Criar a igreja
      const { data: igreja, error: igrejaError } = await supabase
        .from("igrejas")
        .insert({
          nome: formData.nome.trim(),
          cnpj: formData.cnpj ? removerFormatacao(formData.cnpj) : null,
          email: formData.email.trim() || null,
          telefone: formData.telefone
            ? removerFormatacao(formData.telefone)
            : null,
          endereco: formData.endereco.trim() || null,
          cidade: formData.cidade.trim() || null,
          estado: formData.estado.trim().toUpperCase() || null,
          cep: formData.cep ? removerFormatacao(formData.cep) : null,
          status: "ativo",
        })
        .select()
        .single();

      if (igrejaError) throw igrejaError;

      // 2. Criar a filial Matriz automaticamente
      const { data: filial, error: filialError } = await supabase
        .from("filiais")
        .insert({
          igreja_id: igreja.id,
          nome: "Matriz",
        })
        .select()
        .single();

      if (filialError) {
        console.error("Erro ao criar filial Matriz:", filialError);
      }

      // 3. Criar configurações padrão
      const { error: configError } = await supabase
        .from("configuracoes_igreja")
        .insert({
          igreja_id: igreja.id,
          nome_igreja: formData.nome.trim(),
        });

      if (configError) {
        console.error("Erro ao criar configurações:", configError);
      }

      // 4. Provisionar admin da igreja via Edge Function
      const { data: adminData, error: adminError } =
        await supabase.functions.invoke("provisionar-admin-igreja", {
          body: {
            email: formData.email.trim(),
            nome: `Admin - ${formData.nome.trim()}`,
            igreja_id: igreja.id,
            filial_id: filial?.id || null,
          },
        });

      if (adminError) {
        console.error("Erro ao provisionar admin:", adminError);
        toast({
          title: "Igreja criada, mas houve erro ao criar admin",
          description: "Crie o admin manualmente depois.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Igreja cadastrada com sucesso!",
          description: `Admin criado com senha temporária: ${
            adminData?.temp_password || "Erro ao gerar senha"
          }`,
        });
      }

      setFormData({
        nome: "",
        cnpj: "",
        email: "",
        telefone: "",
        endereco: "",
        cidade: "",
        estado: "",
        cep: "",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao cadastrar igreja";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Igreja</DialogTitle>
          <DialogDescription>
            Cadastre uma nova igreja diretamente no sistema
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome da Igreja *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              placeholder="Nome da igreja"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => handleChange("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => handleChange("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="contato@igreja.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => handleChange("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => handleChange("cidade", e.target.value)}
                placeholder="Cidade"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="estado">UF</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(e) => handleChange("estado", e.target.value)}
                placeholder="SP"
                maxLength={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => handleChange("cep", e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
