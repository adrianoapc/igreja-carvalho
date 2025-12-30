import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

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
};

const initialFormState: VolunteerFormData = {
  area: "",
  disponibilidade: "",
  experiencia: "",
  observacoes: "",
  contato: "",
};

const sendVolunteerForm = async (data: VolunteerFormData) => {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return data;
};

export default function Voluntariado() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<VolunteerFormData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<VolunteerFormData | null>(null);

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

    setIsSubmitting(true);

    try {
      const response = await sendVolunteerForm(formData);
      setSubmittedData(response);
      setFormData(initialFormState);
      toast({
        title: "Inscrição enviada",
        description: "Recebemos seu interesse em servir. Em breve entraremos em contato.",
      });
    } catch (error) {
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

  const handleReset = () => {
    setSubmittedData(null);
    setFormData(initialFormState);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Voluntariado</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Faça sua inscrição para servir em nossos ministérios e projetos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Formulário de inscrição</CardTitle>
            <CardDescription>
              Informe seus interesses e disponibilidade para participarmos do processo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="contato">Nome ou contato principal</Label>
                <Input
                  id="contato"
                  placeholder="Ex: Ana Silva (WhatsApp 11 99999-9999)"
                  value={formData.contato}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, contato: event.target.value }))
                  }
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
                <Button type="button" variant="outline" onClick={handleReset}>
                  Limpar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar inscrição"}
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

          {submittedData && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle>Inscrição confirmada</CardTitle>
                <CardDescription>
                  Obrigado por se disponibilizar! Vamos falar com você em breve.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Área:</strong> {submittedData.area}</p>
                <p><strong>Disponibilidade:</strong> {submittedData.disponibilidade}</p>
                <p><strong>Experiência:</strong> {submittedData.experiencia}</p>
                {submittedData.observacoes && (
                  <p><strong>Observações:</strong> {submittedData.observacoes}</p>
                )}
                {submittedData.contato && (
                  <p><strong>Contato:</strong> {submittedData.contato}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
