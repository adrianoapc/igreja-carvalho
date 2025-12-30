import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MinhaInscricaoCard from "@/components/voluntariado/MinhaInscricaoCard";
import { Loader2 } from "lucide-react";

const ministryOptions = [
  "Recepção",
  "Louvor",
  "Mídia",
  "Kids",
  "Intercessão",
  "Ação Social",
  "Eventos",
];

const availabilityOptions = [
  "Domingos (manhã)",
  "Domingos (noite)",
  "Durante a semana",
  "Eventos pontuais",
  "Flexível",
];

const experienceOptions = [
  "Nenhuma experiência (quero aprender)",
  "Já servi antes",
  "Sirvo atualmente",
];

type VolunteerFormData = {
  area: string;
  disponibilidade: string;
  experiencia: string;
  observacoes: string;
  contato: string;
  telefone: string;
  email: string;
};

const initialFormState: VolunteerFormData = {
  area: "",
  disponibilidade: "",
  experiencia: "",
  observacoes: "",
  contato: "",
  telefone: "",
  email: "",
};

interface Candidatura {
  id: string;
  ministerio: string;
  disponibilidade: string;
  experiencia: string;
  status: string;
  created_at: string;
}

export default function Voluntariado() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState<VolunteerFormData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [minhaCandidatura, setMinhaCandidatura] = useState<Candidatura | null>(null);
  const [loadingCandidatura, setLoadingCandidatura] = useState(true);

  // Preencher dados do perfil se logado
  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        contato: profile.nome || prev.contato,
        telefone: profile.telefone || prev.telefone,
        email: profile.email || prev.email,
      }));
    }
  }, [profile]);

  // Verificar se já tem candidatura
  useEffect(() => {
    const fetchMinhaCandidatura = async () => {
      if (!profile?.id) {
        setLoadingCandidatura(false);
        return;
      }

      const { data, error } = await supabase
        .from("candidatos_voluntario")
        .select("id, ministerio, disponibilidade, experiencia, status, created_at")
        .eq("pessoa_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setMinhaCandidatura(data);
      }
      setLoadingCandidatura(false);
    };

    if (!authLoading) {
      fetchMinhaCandidatura();
    }
  }, [profile?.id, authLoading]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.area || !formData.disponibilidade || !formData.experiencia) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Selecione a área, disponibilidade e experiência para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.contato) {
      toast({
        title: "Informe seu nome",
        description: "Precisamos saber quem está se inscrevendo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("candidatos_voluntario")
        .insert({
          pessoa_id: profile?.id || null,
          nome_contato: formData.contato,
          telefone_contato: formData.telefone || null,
          email_contato: formData.email || null,
          ministerio: formData.area,
          disponibilidade: formData.disponibilidade,
          experiencia: formData.experiencia,
          observacoes: formData.observacoes || null,
          status: "pendente",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Inscrição enviada!",
        description: "Recebemos seu interesse em servir. Em breve entraremos em contato.",
      });

      // Atualizar estado com a nova candidatura
      if (data) {
        setMinhaCandidatura({
          id: data.id,
          ministerio: data.ministerio,
          disponibilidade: data.disponibilidade,
          experiencia: data.experiencia,
          status: data.status,
          created_at: data.created_at,
        });
      }

      setFormData(initialFormState);
    } catch (error: unknown) {
      console.error("Erro ao enviar inscrição:", error);
      toast({
        title: "Não foi possível enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNovaInscricao = () => {
    setMinhaCandidatura(null);
  };

  if (authLoading || loadingCandidatura) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Voluntariado</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Faça sua inscrição para servir em nossos ministérios e projetos.
        </p>
      </div>

      {/* Se já tem candidatura ativa (não rejeitada), mostrar status */}
      {minhaCandidatura && minhaCandidatura.status !== "rejeitado" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <MinhaInscricaoCard 
            candidatura={minhaCandidatura} 
            onNovaInscricao={handleNovaInscricao}
          />
          <Card>
            <CardHeader>
              <CardTitle>Próximos passos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {minhaCandidatura.status === "pendente" && (
                <>
                  <p>✓ Sua inscrição foi recebida</p>
                  <p>⏳ Aguardando análise da liderança</p>
                  <p>📞 Entraremos em contato em breve</p>
                </>
              )}
              {minhaCandidatura.status === "em_analise" && (
                <>
                  <p>✓ Sua inscrição está sendo analisada</p>
                  <p>⏳ A liderança verificará seu perfil</p>
                  <p>📞 Você será contatado em breve</p>
                </>
              )}
              {minhaCandidatura.status === "aprovado" && (
                <>
                  <p>🎉 Você foi aprovado!</p>
                  <p>📞 A equipe entrará em contato</p>
                  <p>📅 Você será incluído nas escalas</p>
                </>
              )}
              {minhaCandidatura.status === "em_trilha" && (
                <>
                  <p>📚 Complete sua trilha de capacitação</p>
                  <p>👉 Acesse "Meus Cursos" no menu</p>
                  <p>✅ Após concluir, você será escalado</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Formulário de inscrição</CardTitle>
              <CardDescription>
                {profile 
                  ? "Seus dados foram preenchidos automaticamente. Complete os campos restantes."
                  : "Informe seus interesses e disponibilidade para participarmos do processo."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contato">Nome completo *</Label>
                    <Input
                      id="contato"
                      placeholder="Seu nome"
                      value={formData.contato}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, contato: event.target.value }))
                      }
                      disabled={!!profile?.nome}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">WhatsApp</Label>
                    <Input
                      id="telefone"
                      placeholder="(11) 99999-9999"
                      value={formData.telefone}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, telefone: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, email: event.target.value }))
                    }
                    disabled={!!profile?.email}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area">Ministério/área *</Label>
                    <Select
                      value={formData.area}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, area: value }))}
                    >
                      <SelectTrigger id="area">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ministryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disponibilidade">Disponibilidade *</Label>
                    <Select
                      value={formData.disponibilidade}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, disponibilidade: value }))
                      }
                    >
                      <SelectTrigger id="disponibilidade">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {availabilityOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experiencia">Experiência *</Label>
                    <Select
                      value={formData.experiencia}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, experiencia: value }))
                      }
                    >
                      <SelectTrigger id="experiencia">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {experienceOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Conte um pouco sobre seus dons, horários ou preferência de atuação."
                    rows={4}
                    value={formData.observacoes}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, observacoes: event.target.value }))
                    }
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setFormData(initialFormState)}
                  >
                    Limpar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar inscrição"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>1. Recebemos sua inscrição e alinhamos o ministério ideal.</p>
                <p>2. Entramos em contato para treinamento e integração.</p>
                <p>3. Você começa a servir no cronograma combinado.</p>
              </CardContent>
            </Card>

            {profile && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-4">
                  <p className="text-sm text-green-700">
                    ✓ Você está logado como <strong>{profile.nome}</strong>. 
                    Seus dados foram preenchidos automaticamente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
