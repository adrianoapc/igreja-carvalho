import { useState, type InputHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import InputMask from "react-input-mask";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface FornecedorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor?: {
    id: string | number;
    nome: string;
    tipo_pessoa: "fisica" | "juridica";
    cpf_cnpj?: string | null;
    email?: string | null;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    observacoes?: string | null;
  };
}

export function FornecedorDialog({ open, onOpenChange, fornecedor }: FornecedorDialogProps) {
  const [nome, setNome] = useState(fornecedor?.nome || "");
  const [tipoPessoa, setTipoPessoa] = useState<"fisica" | "juridica">(fornecedor?.tipo_pessoa || "juridica");
  const [cpfCnpj, setCpfCnpj] = useState(fornecedor?.cpf_cnpj || "");
  const [email, setEmail] = useState(fornecedor?.email || "");
  const [telefone, setTelefone] = useState(fornecedor?.telefone || "");
  const [endereco, setEndereco] = useState(fornecedor?.endereco || "");
  const [cidade, setCidade] = useState(fornecedor?.cidade || "");
  const [estado, setEstado] = useState(fornecedor?.estado || "");
  const [cep, setCep] = useState(fornecedor?.cep || "");
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (fornecedor) {
        const { error } = await supabase
          .from('fornecedores')
          .update({
            nome,
            tipo_pessoa: tipoPessoa,
            cpf_cnpj: cpfCnpj,
            email,
            telefone,
            endereco,
            cidade,
            estado,
            cep,
            observacoes,
          })
          .eq('id', fornecedor.id);

        if (error) throw error;
        toast.success("Fornecedor atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('fornecedores')
          .insert({
            nome,
            tipo_pessoa: tipoPessoa,
            cpf_cnpj: cpfCnpj,
            email,
            telefone,
            endereco,
            cidade,
            estado,
            cep,
            observacoes,
            ativo: true,
          });

        if (error) throw error;
        toast.success("Fornecedor criado com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      onOpenChange(false);
      
      if (!fornecedor) {
        setNome("");
        setCpfCnpj("");
        setEmail("");
        setTelefone("");
        setEndereco("");
        setCidade("");
        setEstado("");
        setCep("");
        setObservacoes("");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar fornecedor");
    } finally {
      setLoading(false);
    }
  };

  const title = fornecedor ? "Editar Fornecedor" : "Novo Fornecedor";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "max-w-3xl max-h-[90vh] overflow-hidden flex flex-col",
      }}
      drawerContentProps={{
        className: "max-h-[95vh]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de pessoa *</Label>
              <RadioGroup value={tipoPessoa} onValueChange={(value: "fisica" | "juridica") => setTipoPessoa(value)}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="juridica" id="juridica" />
                    <Label htmlFor="juridica" className="cursor-pointer">Pessoa Jurídica</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fisica" id="fisica" />
                    <Label htmlFor="fisica" className="cursor-pointer">Pessoa Física</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nome">Nome / Razão Social *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={tipoPessoa === 'juridica' ? "Ex: ABC Materiais Ltda" : "Ex: João Silva"}
                  required
                />
              </div>

              <div>
                <Label htmlFor="cpf-cnpj">{tipoPessoa === 'juridica' ? 'CNPJ' : 'CPF'}</Label>
                <InputMask
                  mask={tipoPessoa === 'juridica' ? "99.999.999/9999-99" : "999.999.999-99"}
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                >
                  {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                      {...inputProps}
                      id="cpf-cnpj"
                      placeholder={tipoPessoa === 'juridica' ? "00.000.000/0000-00" : "000.000.000-00"}
                    />
                  )}
                </InputMask>
              </div>

              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                >
                  {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                      {...inputProps}
                      id="telefone"
                      placeholder="(00) 00000-0000"
                    />
                  )}
                </InputMask>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div>
                <Label htmlFor="cep">CEP</Label>
                <InputMask
                  mask="99999-999"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                >
                  {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                    <Input
                      {...inputProps}
                      id="cep"
                      placeholder="00000-000"
                    />
                  )}
                </InputMask>
              </div>

              <div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: São Paulo"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="Ex: SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre o fornecedor"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
