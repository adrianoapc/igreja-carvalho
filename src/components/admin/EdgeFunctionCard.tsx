import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Clock, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EdgeFunctionCardProps {
  title: string;
  description: string;
  functionName: string;
  schedule: string;
  icon: React.ReactNode;
}

export default function EdgeFunctionCard({
  title,
  description,
  functionName,
  schedule,
  icon
}: EdgeFunctionCardProps) {
  const { toast } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<{
    success: boolean;
    timestamp: Date;
    message?: string;
  } | null>(null);

  const executeFunction = async () => {
    setIsExecuting(true);
    try {
      console.log(`Executando edge function: ${functionName}`);
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { time: new Date().toISOString() }
      });

      if (error) {
        console.error('Erro ao executar função:', error);
        setLastExecution({
          success: false,
          timestamp: new Date(),
          message: error.message
        });
        throw error;
      }

      console.log('Resposta da função:', data);
      
      setLastExecution({
        success: true,
        timestamp: new Date(),
        message: data?.message || 'Executado com sucesso'
      });

      toast({
        title: "Sucesso!",
        description: `${title} executado com sucesso`,
      });
    } catch (error: any) {
      console.error('Erro ao executar edge function:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível executar a função",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base md:text-lg">{title}</CardTitle>
              <CardDescription className="text-xs md:text-sm mt-1">
                {description}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-4">
        {/* Informações de agendamento */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Execução automática: {schedule}</span>
        </div>

        {/* Última execução */}
        {lastExecution && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary">
            {lastExecution.success ? (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {lastExecution.success ? "Executado com sucesso" : "Erro na execução"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(lastExecution.timestamp, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
              {lastExecution.message && (
                <p className="text-xs text-muted-foreground mt-1">
                  {lastExecution.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Botão de execução manual */}
        <div className="flex gap-2">
          <Button 
            onClick={executeFunction}
            disabled={isExecuting}
            className="flex-1"
            variant="outline"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Executar Agora
              </>
            )}
          </Button>
        </div>

        {/* Link para logs no backend */}
        <p className="text-xs text-center text-muted-foreground">
          Logs detalhados disponíveis no backend
        </p>
      </CardContent>
    </Card>
  );
}
