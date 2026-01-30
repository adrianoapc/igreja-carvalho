import { useState, type InputHTMLAttributes } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, UserCheck, Users, ArrowLeft } from "lucide-react";
import InputMask from "react-input-mask";
import { removerFormatacao } from "@/lib/validators";
import { Card, CardContent } from "@/components/ui/card";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";
import { cn } from "@/lib/utils";

interface CadastrarPessoaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type TipoPessoa = "visitante" | "frequentador" | "membro";

const tiposPessoa = [
  {
    value: "visitante" as TipoPessoa,
    label: "Visitante",
    description: "Primeira vez na igreja",
    icon: UserPlus,
  },
  {
    value: "frequentador" as TipoPessoa,
    label: "Frequentador",
    description: "Já frequenta regularmente",
    icon: UserCheck,
  },
  {
    value: "membro" as TipoPessoa,
    label: "Membro",
    description: "Membro oficial da igreja",
    icon: Users,
  },
];

export function CadastrarPessoaDialog({
  open,
  onOpenChange,
  onSuccess,
}: CadastrarPessoaDialogProps) {
  const [step, setStep] = useState<"selecao" | "formulario">("selecao");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    sexo: "",
    tipo: "" as TipoPessoa | "",
    dia_nascimento: "",
    mes_nascimento: "",
    ano_nascimento: "",
    entrou_por: "",
    observacoes: "",
    aceitou_jesus: false,
    batizado: false,
    deseja_contato: true,
    recebeu_brinde: false,
    // Campos adicionais para membro
    cpf: "",
    rg: "",
    estado_civil: "",
    profissao: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const { toast } = useToast();
  const { buscarCep, loading: cepLoading, error: cepError } = useCepAutocomplete();

  const handleCepBlur = async () => {
    const dados = await buscarCep(formData.cep);
    if (dados) {
      setFormData((prev) => ({
        ...prev,
        logradouro: dados.logradouro || prev.logradouro,
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

  const dias = Array.from({ length: 31 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  );
  const meses = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];
  const anoAtual = new Date().getFullYear();
  const anos = Array.from(
    { length: anoAtual - 1920 + 1 },
    (_, i) => (anoAtual - i).toString()
  );
  const opcoesComoConheceu = [
    { value: "indicacao", label: "Indicação de amigo/familiar" },
    { value: "redes_sociais", label: "Redes sociais" },
    { value: "google", label: "Pesquisa no Google" },
    { value: "passou_na_frente", label: "Passou na frente da igreja" },
    { value: "evento", label: "Evento da igreja" },
    { value: "convite_membro", label: "Convite de membro" },
    { value: "outro", label: "Outro" },
  ];
  const estadosCivis = [
    { value: "solteiro", label: "Solteiro(a)" },
    { value: "casado", label: "Casado(a)" },
    { value: "divorciado", label: "Divorciado(a)" },
    { value: "viuvo", label: "Viúvo(a)" },
    { value: "uniao_estavel", label: "União Estável" },
  ];

  const handleSelectTipo = (tipo: TipoPessoa) => {
    setFormData({ ...formData, tipo });
    setStep("formulario");
  };

  const handleVoltar = () => {
    setStep("selecao");
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      telefone: "",
      email: "",
      sexo: "",
      tipo: "",
      dia_nascimento: "",
      mes_nascimento: "",
      ano_nascimento: "",
      entrou_por: "",
      observacoes: "",
      aceitou_jesus: false,
      batizado: false,
      deseja_contato: true,
      recebeu_brinde: false,
      cpf: "",
      rg: "",
      estado_civil: "",
      profissao: "",
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    });
    setStep("selecao");
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      resetForm();
    }
    onOpenChange(openState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.telefone.trim() && !formData.email.trim()) {
      toast({
        title: "Erro",
        description: "Informe pelo menos um contato (telefone ou email)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const telefoneNormalizado = formData.telefone.trim()
        ? removerFormatacao(formData.telefone.trim())
        : null;

      // Verificar duplicatas
      const conditions = [];
      if (formData.email.trim()) {
        conditions.push(
          supabase
            .from("profiles")
            .select("*")
            .eq("email", formData.email.trim())
        );
      }
      if (telefoneNormalizado) {
        conditions.push(
          supabase
            .from("profiles")
            .select("*")
            .eq("telefone", telefoneNormalizado)
        );
      }

      let pessoaExistente = null;
      for (const condition of conditions) {
        const { data } = await condition;
        if (data && data.length > 0) {
          pessoaExistente = data[0];
          break;
        }
      }

      if (pessoaExistente) {
        toast({
          title: "Pessoa já cadastrada",
          description: `${pessoaExistente.nome} já existe no sistema como ${pessoaExistente.status}.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Construir data_nascimento
      let dataNascimento = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        const ano = formData.ano_nascimento || "1900";
        dataNascimento = `${ano}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      // Dados base
      const dadosInserir: Record<string, unknown> = {
        nome: formData.nome.trim(),
        telefone: telefoneNormalizado,
        email: formData.email.trim() || null,
        sexo: formData.sexo || null,
        observacoes: formData.observacoes.trim() || null,
        aceitou_jesus: formData.aceitou_jesus,
        batizado: formData.batizado,
        deseja_contato: formData.deseja_contato,
        recebeu_brinde: formData.recebeu_brinde,
        data_nascimento: dataNascimento,
        entrou_por: formData.entrou_por || null,
        status: formData.tipo,
        data_primeira_visita: new Date().toISOString(),
        data_ultima_visita: new Date().toISOString(),
        numero_visitas: 1,
      };

      // Campos adicionais para membro
      if (formData.tipo === "membro") {
        dadosInserir.cpf = formData.cpf
          ? removerFormatacao(formData.cpf)
          : null;
        dadosInserir.rg = formData.rg || null;
        dadosInserir.estado_civil = formData.estado_civil || null;
        dadosInserir.profissao = formData.profissao || null;
        dadosInserir.cep = formData.cep
          ? removerFormatacao(formData.cep)
          : null;
        dadosInserir.logradouro = formData.logradouro || null;
        dadosInserir.numero = formData.numero || null;
        dadosInserir.complemento = formData.complemento || null;
        dadosInserir.bairro = formData.bairro || null;
        dadosInserir.cidade = formData.cidade || null;
        dadosInserir.estado = formData.estado || null;
      }

      const { data: newData, error: insertError } = await supabase
        .from("profiles")
        .insert([dadosInserir as never])
        .select()
        .single();

      if (insertError) throw insertError;

      // Se deseja contato e é visitante, criar agendamento
      if (
        formData.deseja_contato &&
        newData &&
        formData.tipo === "visitante"
      ) {
        const dataContato = new Date();
        dataContato.setDate(dataContato.getDate() + 3);

        await supabase.from("visitante_contatos").insert({
          visitante_id: newData.id,
          membro_responsavel_id: user.id,
          data_contato: dataContato.toISOString(),
          tipo_contato: "telefonico",
          status: "agendado",
          observacoes: "Contato automático agendado após registro",
        });
      }

      const tipoLabel =
        formData.tipo === "visitante"
          ? "Visitante"
          : formData.tipo === "frequentador"
          ? "Frequentador"
          : "Membro";

      toast({
        title: "Sucesso",
        description: `${tipoLabel} ${formData.nome} cadastrado com sucesso!`,
      });

      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao cadastrar pessoa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar a pessoa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSelecaoTipo = () => (
    <div className="space-y-4 p-4 md:p-6">
      <p className="text-sm text-muted-foreground">
        Que tipo de pessoa você quer cadastrar?
      </p>
      <div className="space-y-3">
        {tiposPessoa.map((tipo) => {
          const Icon = tipo.icon;
          return (
            <Card
              key={tipo.value}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleSelectTipo(tipo.value)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{tipo.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {tipo.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="pt-4">
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="w-full"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );

  const renderFormulario = () => {
    const isMembro = formData.tipo === "membro";
    const tipoLabel =
      formData.tipo === "visitante"
        ? "Visitante"
        : formData.tipo === "frequentador"
        ? "Frequentador"
        : "Membro";

    return (
      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleVoltar}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          <div className="text-sm text-muted-foreground mb-4">
            Cadastrando: <span className="font-medium">{tipoLabel}</span>
          </div>

          {/* Campos básicos */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
              placeholder="Nome completo"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <InputMask
              mask="(99) 99999-9999"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
              disabled={loading}
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

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="email@exemplo.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sexo">Sexo</Label>
            <Select
              value={formData.sexo}
              onValueChange={(value) =>
                setFormData({ ...formData, sexo: value })
              }
              disabled={loading}
            >
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
            <Label>Data de aniversário</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select
                value={formData.dia_nascimento}
                onValueChange={(value) =>
                  setFormData({ ...formData, dia_nascimento: value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  {dias.map((dia) => (
                    <SelectItem key={dia} value={dia}>
                      {dia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.mes_nascimento}
                onValueChange={(value) =>
                  setFormData({ ...formData, mes_nascimento: value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.ano_nascimento}
                onValueChange={(value) =>
                  setFormData({ ...formData, ano_nascimento: value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ano (opc.)" />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos adicionais para Membro */}
          {isMembro && (
            <>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  Dados Adicionais do Membro
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <InputMask
                    mask="999.999.999-99"
                    value={formData.cpf}
                    onChange={(e) =>
                      setFormData({ ...formData, cpf: e.target.value })
                    }
                    disabled={loading}
                  >
                    {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                      <Input
                        {...inputProps}
                        id="cpf"
                        placeholder="000.000.000-00"
                      />
                    )}
                  </InputMask>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <Input
                    id="rg"
                    value={formData.rg}
                    onChange={(e) =>
                      setFormData({ ...formData, rg: e.target.value })
                    }
                    placeholder="RG"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estado_civil">Estado Civil</Label>
                  <Select
                    value={formData.estado_civil}
                    onValueChange={(value) =>
                      setFormData({ ...formData, estado_civil: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger id="estado_civil">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosCivis.map((ec) => (
                        <SelectItem key={ec.value} value={ec.value}>
                          {ec.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profissao">Profissão</Label>
                  <Input
                    id="profissao"
                    value={formData.profissao}
                    onChange={(e) =>
                      setFormData({ ...formData, profissao: e.target.value })
                    }
                    placeholder="Profissão"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  Endereço
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                      disabled={loading}
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
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input
                    id="logradouro"
                    value={formData.logradouro}
                    onChange={(e) =>
                      setFormData({ ...formData, logradouro: e.target.value })
                    }
                    placeholder="Rua, Av..."
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) =>
                      setFormData({ ...formData, numero: e.target.value })
                    }
                    placeholder="Nº"
                    disabled={loading}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={formData.complemento}
                    onChange={(e) =>
                      setFormData({ ...formData, complemento: e.target.value })
                    }
                    placeholder="Apto, Bloco..."
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) =>
                      setFormData({ ...formData, bairro: e.target.value })
                    }
                    placeholder="Bairro"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) =>
                      setFormData({ ...formData, cidade: e.target.value })
                    }
                    placeholder="Cidade"
                    disabled={loading}
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
                    placeholder="UF"
                    maxLength={2}
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          {/* Campos comuns */}
          <div className="space-y-2">
            <Label htmlFor="entrou_por">Como conheceu a igreja?</Label>
            <Select
              value={formData.entrou_por}
              onValueChange={(value) =>
                setFormData({ ...formData, entrou_por: value })
              }
              disabled={loading}
            >
              <SelectTrigger id="entrou_por">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {opcoesComoConheceu.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) =>
                setFormData({ ...formData, observacoes: e.target.value })
              }
              placeholder="Observações sobre a pessoa..."
              disabled={loading}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aceitou_jesus"
                checked={formData.aceitou_jesus}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, aceitou_jesus: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="aceitou_jesus"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Aceitou Jesus
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="batizado"
                checked={formData.batizado}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, batizado: checked as boolean })
                }
                disabled={loading}
              />
              <label
                htmlFor="batizado"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Convertido/Batizado
              </label>
            </div>

            {formData.tipo === "visitante" && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="deseja_contato"
                    checked={formData.deseja_contato}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        deseja_contato: checked as boolean,
                      })
                    }
                    disabled={loading}
                  />
                  <label
                    htmlFor="deseja_contato"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Deseja receber contato
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recebeu_brinde"
                    checked={formData.recebeu_brinde}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        recebeu_brinde: checked as boolean,
                      })
                    }
                    disabled={loading}
                  />
                  <label
                    htmlFor="recebeu_brinde"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Recebeu brinde
                  </label>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t p-4 md:p-6 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cadastrando...
              </>
            ) : (
              "Cadastrar"
            )}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Cadastrar Nova Pessoa
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "selecao"
              ? "Selecione o tipo de pessoa"
              : "Preencha os dados"}
          </p>
        </div>

        {step === "selecao" ? renderSelecaoTipo() : renderFormulario()}
      </div>
    </ResponsiveDialog>
  );
}
