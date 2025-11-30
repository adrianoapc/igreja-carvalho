import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Phone, Heart, Calendar } from "lucide-react";
import { z } from "zod";

interface ConverterFamiliarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familiaId: string;
  nomeFamiliar: string;
  onSuccess: () => void;
}

const converterSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  status: z.enum(["visitante", "frequentador", "membro"]),
  sexo: z.enum(["masculino", "feminino"]).optional().or(z.literal("")),
  data_nascimento: z.string().optional().or(z.literal("")),
  estado_civil: z.string().optional().or(z.literal("")),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
  cep: z.string().trim().max(9).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  endereco: z.string().trim().max(255).optional().or(z.literal("")),
});

type ConverterFormData = z.infer<typeof converterSchema>;

export function ConverterFamiliarDialog({
  open,
  onOpenChange,
  familiaId,
  nomeFamiliar,
  onSuccess,
}: ConverterFamiliarDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ConverterFormData>({
    nome: nomeFamiliar,
    email: "",
    telefone: "",
    status: "visitante",
    sexo: "",
    data_nascimento: "",
    estado_civil: "",
    cpf: "",
    cep: "",
    cidade: "",
    estado: "",
    endereco: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ConverterFormData, string>>>({});
  const { toast } = useToast();

  const handleChange = (field: keyof ConverterFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpar erro do campo ao editar
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar dados
    const validation = converterSchema.safeParse(formData);
    if (!validation.success) {
      const newErrors: Partial<Record<keyof ConverterFormData, string>> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as keyof ConverterFormData] = err.message;
        }
      });
      setErrors(newErrors);
      toast({
        title: "Erro de validação",
        description: "Verifique os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Criar novo perfil
      const profileData: any = {
        nome: formData.nome,
        status: formData.status,
        email: formData.email || null,
        telefone: formData.telefone || null,
        sexo: formData.sexo || null,
        data_nascimento: formData.data_nascimento || null,
        estado_civil: formData.estado_civil || null,
        cpf: formData.cpf || null,
        cep: formData.cep || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        endereco: formData.endereco || null,
      };

      // Se for visitante, adicionar campos específicos
      if (formData.status === "visitante") {
        profileData.data_primeira_visita = new Date().toISOString();
        profileData.numero_visitas = 1;
      }

      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert(profileData)
        .select()
        .single();

      if (profileError) throw profileError;

      // Atualizar relacionamento familiar para apontar para o novo perfil
      const { error: updateError } = await supabase
        .from("familias")
        .update({
          familiar_id: newProfile.id,
          nome_familiar: null, // Limpar nome texto
        })
        .eq("id", familiaId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: `${formData.nome} foi cadastrado(a) como ${formData.status} e vinculado(a) como familiar`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Erro ao converter familiar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível converter o familiar em cadastro completo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      nome: nomeFamiliar,
      email: "",
      telefone: "",
      status: "visitante",
      sexo: "",
      data_nascimento: "",
      estado_civil: "",
      cpf: "",
      cep: "",
      cidade: "",
      estado: "",
      endereco: "",
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter em Cadastro Completo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status" className="text-base font-semibold">
              Status no Sistema *
            </Label>
            <Select value={formData.status} onValueChange={(value: any) => handleChange("status", value)}>
              <SelectTrigger id="status" className={errors.status ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="visitante">Visitante</SelectItem>
                <SelectItem value="frequentador">Frequentador</SelectItem>
                <SelectItem value="membro">Membro</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="text-sm text-destructive">{errors.status}</p>}
            <p className="text-xs text-muted-foreground">
              Define o nível de acesso e informações que serão solicitadas
            </p>
          </div>

          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico" className="gap-1">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Básico</span>
              </TabsTrigger>
              <TabsTrigger value="pessoal" className="gap-1">
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Pessoal</span>
              </TabsTrigger>
              <TabsTrigger value="contato" className="gap-1">
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Contato</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  placeholder="Nome completo"
                  className={errors.nome ? "border-destructive" : ""}
                  maxLength={100}
                />
                {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  className={errors.email ? "border-destructive" : ""}
                  maxLength={255}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={20}
                />
              </div>
            </TabsContent>

            <TabsContent value="pessoal" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <Select value={formData.sexo} onValueChange={(value) => handleChange("sexo", value)}>
                  <SelectTrigger id="sexo">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => handleChange("data_nascimento", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado_civil">Estado Civil</Label>
                <Select value={formData.estado_civil} onValueChange={(value) => handleChange("estado_civil", value)}>
                  <SelectTrigger id="estado_civil">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União Estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleChange("cpf", e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={(e) => handleChange("cep", e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleChange("cidade", e.target.value)}
                    placeholder="Cidade"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => handleChange("estado", e.target.value.toUpperCase())}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleChange("endereco", e.target.value)}
                  placeholder="Rua, número, complemento, bairro"
                  maxLength={255}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Cadastro Completo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
