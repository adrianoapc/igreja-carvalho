import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Phone, Mail, User, Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contato {
  id: string;
  data_contato: string;
  tipo_contato: string | null;
  status: string | null;
  observacoes: string | null;
  visitante_id: string;
  membro_responsavel_id: string;
  visitante: {
    nome: string;
    telefone: string | null;
    email: string | null;
  };
  membro_responsavel: {
    nome: string;
  };
}

export default function ContatosDashboard() {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchContatos = async () => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("visitante_contatos")
        .select(`
          id,
          data_contato,
          tipo_contato,
          status,
          observacoes,
          visitante_id,
          membro_responsavel_id,
          visitante:profiles!fk_visitante(nome, telefone, email),
          membro_responsavel:profiles!fk_membro_responsavel(nome)
        `)
        .gte("data_contato", hoje.toISOString())
        .in("status", ["agendado", "pendente"])
        .order("data_contato", { ascending: true });

      if (error) throw error;
      setContatos(data || []);
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos agendados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContatos();
  }, []);

  const marcarComoRealizado = async (contatoId: string) => {
    try {
      const { error } = await supabase
        .from("visitante_contatos")
        .update({ status: "realizado" })
        .eq("id", contatoId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato marcado como realizado"
      });

      fetchContatos();
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contato",
        variant: "destructive"
      });
    }
  };

  const marcarComoNaoRealizado = async (contatoId: string) => {
    try {
      const { error } = await supabase
        .from("visitante_contatos")
        .update({ status: "nao_realizado" })
        .eq("id", contatoId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato marcado como não realizado"
      });

      fetchContatos();
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contato",
        variant: "destructive"
      });
    }
  };

  const agruparContatos = () => {
    const hoje: Contato[] = [];
    const amanha: Contato[] = [];
    const proximos: Contato[] = [];

    contatos.forEach((contato) => {
      const dataContato = parseISO(contato.data_contato);
      
      if (isToday(dataContato)) {
        hoje.push(contato);
      } else if (isTomorrow(dataContato)) {
        amanha.push(contato);
      } else {
        proximos.push(contato);
      }
    });

    return { hoje, amanha, proximos };
  };

  const renderContato = (contato: Contato) => (
    <div
      key={contato.id}
      className="p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-sm md:text-base flex-shrink-0">
              {contato.visitante.nome.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm md:text-base text-foreground truncate">{contato.visitante.nome}</p>
              <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 truncate">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{contato.membro_responsavel.nome}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1 text-xs md:text-sm">
            {contato.visitante.telefone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {contato.visitante.telefone}
              </p>
            )}
            {contato.visitante.email && (
              <p className="flex items-center gap-2 text-muted-foreground truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{contato.visitante.email}</span>
              </p>
            )}
            <p className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3 flex-shrink-0" />
              {format(parseISO(contato.data_contato), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {contato.observacoes && (
            <p className="text-xs md:text-sm text-muted-foreground italic line-clamp-2">
              {contato.observacoes}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {contato.tipo_contato && (
              <Badge variant="outline" className="text-xs">
                {contato.tipo_contato}
              </Badge>
            )}
            {contato.status && (
              <Badge variant="outline" className="text-xs">
                {contato.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs md:text-sm"
          onClick={() => marcarComoRealizado(contato.id)}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Realizado
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs md:text-sm"
          onClick={() => marcarComoNaoRealizado(contato.id)}
        >
          <XCircle className="w-3 h-3 mr-1" />
          Não Realizado
        </Button>
      </div>
    </div>
  );

  const { hoje, amanha, proximos } = agruparContatos();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contatos Agendados</h1>
          <p className="text-muted-foreground mt-1">Acompanhe os contatos programados</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Contatos Agendados</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Acompanhe os contatos programados com visitantes</p>
        </div>
      </div>

      {contatos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum contato agendado para os próximos dias</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {hoje.length > 0 && (
            <Card className="shadow-soft border-primary/20">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-primary text-base md:text-lg">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  Hoje ({hoje.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 md:p-6">
                {hoje.map(renderContato)}
              </CardContent>
            </Card>
          )}

          {amanha.length > 0 && (
            <Card className="shadow-soft">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  Amanhã ({amanha.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 md:p-6">
                {amanha.map(renderContato)}
              </CardContent>
            </Card>
          )}

          {proximos.length > 0 && (
            <Card className="shadow-soft">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  Próximos Dias ({proximos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3 md:p-6">
                {proximos.map(renderContato)}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
