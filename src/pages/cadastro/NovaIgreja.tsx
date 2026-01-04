import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

export default function NovaIgreja() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    nome_igreja: '',
    cnpj: '',
    email: '',
    telefone: '',
    nome_responsavel: '',
    cidade: '',
    estado: '',
    observacoes: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nome_igreja || !form.email || !form.nome_responsavel) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome da igreja, email e nome do responsável',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('onboarding_requests').insert({
        nome_igreja: form.nome_igreja,
        cnpj: form.cnpj || null,
        email: form.email,
        telefone: form.telefone || null,
        nome_responsavel: form.nome_responsavel,
        cidade: form.cidade || null,
        estado: form.estado || null,
        observacoes: form.observacoes || null,
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: 'Solicitação enviada!',
        description: 'Você receberá um email quando sua solicitação for aprovada.',
      });
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      toast({
        title: 'Erro ao enviar',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Solicitação Enviada!</h2>
            <p className="text-muted-foreground mb-6">
              Sua solicitação de cadastro foi recebida e será analisada pela nossa equipe.
              Você receberá um email em <strong>{form.email}</strong> quando for aprovada.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Cadastre sua Igreja</CardTitle>
          <CardDescription>
            Preencha os dados abaixo para solicitar acesso ao sistema de gestão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nome_igreja">Nome da Igreja *</Label>
                <Input
                  id="nome_igreja"
                  placeholder="Ex: Igreja Batista Central"
                  value={form.nome_igreja}
                  onChange={(e) => handleChange('nome_igreja', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0001-00"
                  value={form.cnpj}
                  onChange={(e) => handleChange('cnpj', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="email">Email de Contato *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@igreja.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="nome_responsavel">Nome do Responsável *</Label>
                <Input
                  id="nome_responsavel"
                  placeholder="Nome completo do pastor ou líder"
                  value={form.nome_responsavel}
                  onChange={(e) => handleChange('nome_responsavel', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  placeholder="Cidade"
                  value={form.cidade}
                  onChange={(e) => handleChange('cidade', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => handleChange('estado', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Informações adicionais sobre sua igreja..."
                  value={form.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                <Send className="w-4 h-4 mr-2" />
                {loading ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
