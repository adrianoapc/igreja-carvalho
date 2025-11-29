import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Phone, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Json } from "@/integrations/supabase/types";

interface AlertaCritico {
  id: string;
  created_at: string;
  metadata: Json;
}

interface AlertaMetadata {
  pessoa_id: string;
  pessoa_nome: string;
  pessoa_email?: string | null;
  pessoa_telefone?: string | null;
  data_alerta: string;
}

export default function AlertasCriticos() {
  const [alertas, setAlertas] = useState<AlertaCritico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertas();
  }, []);

  const fetchAlertas = async () => {
    try {
      setLoading(true);
      
      // Buscar alertas dos últimos 7 dias
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'alerta_sentimento_critico')
        .gte('created_at', seteDiasAtras.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAlertas(data || []);
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-base md:text-lg">Alertas Críticos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm text-muted-foreground">Carregando alertas...</p>
        </CardContent>
      </Card>
    );
  }

  if (alertas.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base md:text-lg">Alertas Críticos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm text-muted-foreground">
            Nenhum alerta nos últimos 7 dias. O sistema verifica diariamente membros com sentimentos negativos repetidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-base md:text-lg">Alertas Críticos</CardTitle>
          </div>
          <Badge variant="destructive">{alertas.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-3">
        {alertas.map((alerta) => {
          const metadata = alerta.metadata as unknown as AlertaMetadata;
          
          return (
            <Alert key={alerta.id} className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm md:text-base">
                      {metadata.pessoa_nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sentimentos negativos por 3+ dias consecutivos
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 text-xs">
                    {metadata.pessoa_telefone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{metadata.pessoa_telefone}</span>
                      </div>
                    )}
                    {metadata.pessoa_email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span>{metadata.pessoa_email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Detectado em {format(new Date(alerta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
