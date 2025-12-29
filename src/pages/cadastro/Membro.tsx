import { useState, useEffect, type InputHTMLAttributes } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Search, ArrowLeft, UserPlus, AlertCircle } from "lucide-react";
import InputMask from "react-input-mask";

type Step = "search" | "form" | "success" | "pending" | "not_found" | "new_register";

export default function CadastroMembro() {
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    sexo: "",
    dia_nascimento: "",
    mes_nascimento: "",
    ano_nascimento: "",
    estado_civil: "",
    necessidades_especiais: "",
    cep: "",
    cidade: "",
    bairro: "",
    estado: "",
    endereco: "",
    profissao: "",
  });

  const currentYear = new Date().getFullYear();
  const anos = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());
  const { toast } = useToast();

  const dias = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchEmail.trim()) {
      toast({
        title: "Erro",
        description: "Digite seu email para buscar seu cadastro",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Usar edge function para busca pública
      const { data: result, error } = await supabase.functions.invoke('cadastro-publico', {
        body: {
          action: 'buscar_membro',
          data: { email: searchEmail.trim() }
        }
      });

      if (error) throw error;
      
      if (result?.error || !result?.data) {
        setFormData(prev => ({ ...prev, email: searchEmail.trim() }));
        setStep("not_found");
        setLoading(false);
        return;
      }

      const data = result.data;
      setProfile(data);
      
      // Extrair dia, mês e ano da data de nascimento se existir
      let diaNasc = "";
      let mesNasc = "";
      let anoNasc = "";
      if (data.data_nascimento) {
        const parts = data.data_nascimento.split("-");
        if (parts.length >= 3) {
          anoNasc = parts[0] !== "1900" ? parts[0] : "";
          mesNasc = parts[1];
          diaNasc = parts[2];
        }
      }

      setFormData({
        nome: data.nome || "",
        telefone: data.telefone || "",
        email: data.email || "",
        sexo: data.sexo || "",
        dia_nascimento: diaNasc,
        mes_nascimento: mesNasc,
        ano_nascimento: anoNasc,
        estado_civil: data.estado_civil || "",
        necessidades_especiais: data.necessidades_especiais || "",
        cep: data.cep || "",
        cidade: data.cidade || "",
        bairro: data.bairro || "",
        estado: data.estado || "",
        endereco: data.endereco || "",
        profissao: data.profissao || "",
      });
      
      setStep("form");
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar seu cadastro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Construir data_nascimento com ano
      let dataNascimento = profile?.data_nascimento;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        const ano = formData.ano_nascimento || "1900";
        dataNascimento = `${ano}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      // Usar edge function para atualização pública
      const { data: result, error } = await supabase.functions.invoke('cadastro-publico', {
        body: {
          action: 'atualizar_membro',
          data: {
            id: profile.id,
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            sexo: formData.sexo || null,
            data_nascimento: dataNascimento,
            estado_civil: formData.estado_civil || null,
            necessidades_especiais: formData.necessidades_especiais.trim() || null,
            cep: formData.cep.trim() || null,
            cidade: formData.cidade.trim() || null,
            bairro: formData.bairro.trim() || null,
            estado: formData.estado || null,
            endereco: formData.endereco.trim() || null,
            profissao: formData.profissao.trim() || null,
          }
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      // Verificar se é uma alteração pendente ou atualização direta
      if (result?.pending) {
        setStep("pending");
        toast({
          title: "Solicitação enviada!",
          description: "Sua atualização será analisada pela secretaria.",
        });
      } else {
        setStep("success");
        toast({
          title: "Sem alterações",
          description: result?.message || "Nenhuma alteração detectada.",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar seus dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive"
      });
      return;
    }

    if (!formData.sexo) {
      toast({
        title: "Erro",
        description: "Sexo é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      let dataNascimento = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        const ano = formData.ano_nascimento || "1900";
        dataNascimento = `${ano}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      const { data: result, error } = await supabase.functions.invoke('cadastro-publico', {
        body: {
          action: 'cadastrar_visitante',
          data: {
            nome: formData.nome.trim(),
            telefone: formData.telefone.trim() || null,
            email: formData.email.trim() || null,
            sexo: formData.sexo,
            data_nascimento: dataNascimento,
            estado_civil: formData.estado_civil || null,
            necessidades_especiais: formData.necessidades_especiais.trim() || null,
            cep: formData.cep.trim() || null,
            cidade: formData.cidade.trim() || null,
            bairro: formData.bairro.trim() || null,
            estado: formData.estado || null,
            endereco: formData.endereco.trim() || null,
            profissao: formData.profissao.trim() || null,
            tipo: 'frequentador',
            deseja_contato: true,
          }
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setStep("success");
      toast({
        title: "Cadastro realizado!",
        description: "Seu cadastro foi criado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível realizar o cadastro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === "not_found") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft text-center">
            <CardContent className="pt-8 pb-8">
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Cadastro não encontrado
              </h2>
              <p className="text-muted-foreground mb-6">
                Não encontramos um cadastro com o email <strong>{searchEmail}</strong>. 
                Deseja criar um novo cadastro?
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => setStep("new_register")} className="w-full">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sim, quero me cadastrar
                </Button>
                <Button variant="outline" onClick={() => setStep("search")} className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Tentar outro email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "new_register") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 p-4 py-8">
          <Card className="w-full max-w-lg mx-auto shadow-soft">
            <CardHeader>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-fit mb-2" 
                onClick={() => setStep("not_found")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <CardTitle className="text-xl font-bold text-foreground">
                Novo Cadastro
              </CardTitle>
              <CardDescription>
                Preencha seus dados para se cadastrar
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleNewRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Seu nome completo"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email_new">Email</Label>
                  <Input
                    id="email_new"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone_new">Telefone</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    disabled={loading}
                  >
                    {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                      <Input
                        {...inputProps}
                        id="telefone_new"
                        type="tel"
                        placeholder="(00) 00000-0000"
                      />
                    )}
                  </InputMask>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sexo_new">Sexo *</Label>
                    <Select
                      value={formData.sexo}
                      onValueChange={(value) => setFormData({ ...formData, sexo: value })}
                      disabled={loading}
                    >
                      <SelectTrigger id="sexo_new">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado_civil_new">Estado civil</Label>
                    <Select
                      value={formData.estado_civil}
                      onValueChange={(value) => setFormData({ ...formData, estado_civil: value })}
                      disabled={loading}
                    >
                      <SelectTrigger id="estado_civil_new">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={formData.dia_nascimento}
                      onValueChange={(value) => setFormData({ ...formData, dia_nascimento: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent>
                        {dias.map((dia) => (
                          <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.mes_nascimento}
                      onValueChange={(value) => setFormData({ ...formData, mes_nascimento: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {meses.map((mes) => (
                          <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.ano_nascimento}
                      onValueChange={(value) => setFormData({ ...formData, ano_nascimento: value })}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {anos.map((ano) => (
                          <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profissao_new">Profissão</Label>
                  <Input
                    id="profissao_new"
                    value={formData.profissao}
                    onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                    placeholder="Sua profissão"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="necessidades_especiais_new">Possui alguma necessidade especial?</Label>
                  <Input
                    id="necessidades_especiais_new"
                    value={formData.necessidades_especiais}
                    onChange={(e) => setFormData({ ...formData, necessidades_especiais: e.target.value })}
                    placeholder="Ex: cadeirante, deficiência auditiva, etc."
                    disabled={loading}
                  />
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <h3 className="font-medium text-sm mb-3">Endereço</h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="cep_new">CEP</Label>
                      <InputMask
                        mask="99999-999"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                        disabled={loading}
                      >
                        {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                          <Input
                            {...inputProps}
                            id="cep_new"
                            placeholder="00000-000"
                          />
                        )}
                      </InputMask>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="cidade_new">Cidade</Label>
                        <Input
                          id="cidade_new"
                          value={formData.cidade}
                          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                          placeholder="Cidade"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estado_new">Estado</Label>
                        <Select
                          value={formData.estado}
                          onValueChange={(value) => setFormData({ ...formData, estado: value })}
                          disabled={loading}
                        >
                          <SelectTrigger id="estado_new">
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                          <SelectContent>
                            {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bairro_new">Bairro</Label>
                      <Input
                        id="bairro_new"
                        value={formData.bairro}
                        onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                        placeholder="Bairro"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endereco_new">Endereço completo</Label>
                      <Input
                        id="endereco_new"
                        value={formData.endereco}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                        placeholder="Rua, número, complemento"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Cadastrar
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Solicitação enviada!
              </h2>
              <p className="text-muted-foreground mb-6">
                Sua atualização foi enviada e será analisada pela secretaria da igreja. 
                Você será notificado quando suas alterações forem aprovadas.
              </p>
              <Button onClick={() => window.location.href = "/public"}>
                Voltar para o início
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Tudo certo!
              </h2>
              <p className="text-muted-foreground mb-6">
                Seu cadastro está atualizado. Obrigado por manter seus dados em dia!
              </p>
              <Button onClick={() => window.location.href = "/public"}>
                Voltar para o início
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "search") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PublicHeader showBackButton backTo="/cadastro" />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-soft">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold text-foreground">
                Atualizar Cadastro de Membro
              </CardTitle>
              <CardDescription>
                Digite seu email cadastrado para acessar seus dados
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchEmail">Email cadastrado *</Label>
                  <Input
                    id="searchEmail"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="seu@email.com"
                    disabled={loading}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Buscar meu cadastro
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader showBackButton backTo="/cadastro" />
      
      <div className="flex-1 p-4 py-8">
        <Card className="w-full max-w-lg mx-auto shadow-soft">
          <CardHeader>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-fit mb-2" 
              onClick={() => setStep("search")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <CardTitle className="text-xl font-bold text-foreground">
              Atualize seus dados
            </CardTitle>
            <CardDescription>
              Olá {profile && typeof profile === 'object' && 'nome' in profile ? String((profile as { nome?: string }).nome || '').split(" ")[0] : ''}! Atualize suas informações abaixo.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <InputMask
                  mask="(99) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sexo">Sexo</Label>
                  <Select
                    value={formData.sexo}
                    onValueChange={(value) => setFormData({ ...formData, sexo: value })}
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
                  <Label htmlFor="estado_civil">Estado civil</Label>
                  <Select
                    value={formData.estado_civil}
                    onValueChange={(value) => setFormData({ ...formData, estado_civil: value })}
                    disabled={loading}
                  >
                    <SelectTrigger id="estado_civil">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={formData.dia_nascimento}
                    onValueChange={(value) => setFormData({ ...formData, dia_nascimento: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {dias.map((dia) => (
                        <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.mes_nascimento}
                    onValueChange={(value) => setFormData({ ...formData, mes_nascimento: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {meses.map((mes) => (
                        <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={formData.ano_nascimento}
                    onValueChange={(value) => setFormData({ ...formData, ano_nascimento: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {anos.map((ano) => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profissao">Profissão</Label>
                <Input
                  id="profissao"
                  value={formData.profissao}
                  onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                  placeholder="Sua profissão"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="necessidades_especiais">Possui alguma necessidade especial?</Label>
                <Input
                  id="necessidades_especiais"
                  value={formData.necessidades_especiais}
                  onChange={(e) => setFormData({ ...formData, necessidades_especiais: e.target.value })}
                  placeholder="Ex: cadeirante, deficiência auditiva, etc."
                  disabled={loading}
                />
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <h3 className="font-medium text-sm mb-3">Endereço</h3>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <InputMask
                      mask="99999-999"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      disabled={loading}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input
                        id="cidade"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        placeholder="Cidade"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado</Label>
                      <Select
                        value={formData.estado}
                        onValueChange={(value) => setFormData({ ...formData, estado: value })}
                        disabled={loading}
                      >
                        <SelectTrigger id="estado">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={formData.bairro}
                      onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                      placeholder="Bairro"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, complemento"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-4">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
