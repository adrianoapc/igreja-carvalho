import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Clock, CheckCircle, XCircle, Loader2, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EdgeFunctionConfigDialog from "./EdgeFunctionConfigDialog";
import { useIgrejaId } from "@/hooks/useIgrejaId";
interface EdgeFunctionCardProps {
  title: string;
  description: string;
  functionName: string;
  icon: React.ReactNode;
  onUpdate?: () => void;
}
export default function EdgeFunctionCard({
  title,
  description,
  functionName,
  icon,
  onUpdate
}: EdgeFunctionCardProps) {
  const {
    toast
  } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [schedule, setSchedule] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");
  const [executionCount, setExecutionCount] = useState(0);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [lastExecution, setLastExecution] = useState<{
    success: boolean;
    timestamp: Date;
    message?: string;
  } | null>(null);
  const { igrejaId } = useIgrejaId();
  useEffect(() => {
    loadConfig();
  }, [functionName, igrejaId]);
  const loadConfig = async () => {
    try {
      if (!igrejaId) return;
      const {
        data,
        error
      } = await supabase
        .from('edge_function_config')
        .select('*')
        .eq('function_name', functionName)
        .eq('igreja_id', igrejaId)
        .single();
      if (error) throw error;
      if (data) {
        setIsEnabled(data.enabled);
        setSchedule(data.schedule_cron);
        setScheduleDescription(data.schedule_description);
        setExecutionCount(data.execution_count || 0);
        if (data.last_execution) {
          setLastExecution({
            success: data.last_execution_status === 'success',
            timestamp: new Date(data.last_execution),
            message: data.last_execution_status === 'success' ? 'Executado com sucesso' : 'Erro na execução'
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };
  const toggleEnabled = async (enabled: boolean) => {
    try {
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      const {
        error
      } = await supabase.from('edge_function_config').update({
        enabled
      }).eq('function_name', functionName).eq('igreja_id', igrejaId);
      if (error) throw error;
      setIsEnabled(enabled);
      toast({
        title: enabled ? "Função ativada" : "Função desativada",
        description: enabled ? "A função será executada no próximo agendamento" : "A função não será executada até ser reativada"
      });
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Erro ao alterar status:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Erro",
        description: message || "Não foi possível alterar o status",
        variant: "destructive"
      });
    }
  };
  const executeFunction = async () => {
    setIsExecuting(true);
    try {
      console.log(`Executando edge function: ${functionName}`);
      const {
        data,
        error
      } = await supabase.functions.invoke(functionName, {
        body: {
          time: new Date().toISOString(),
          igreja_id: igrejaId
        }
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
        description: `${title} executado com sucesso`
      });

      // Recarregar configuração para atualizar contadores
      loadConfig();
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Erro ao executar edge function:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Erro",
        description: message || "Não foi possível executar a função",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };
  return <>
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground">
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base md:text-lg">{title}</CardTitle>
                  <Badge variant={isEnabled ? "default" : "secondary"}>
                    {isEnabled ? "Ativa" : "Desativada"}
                  </Badge>
                </div>
                <CardDescription className="text-xs md:text-sm mt-1">
                  {description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          {/* Toggle Ativar/Desativar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#eff0cf]">
            <Label htmlFor={`toggle-${functionName}`} className="text-sm font-medium cursor-pointer">
              {isEnabled ? "Função ativa" : "Função desativada"}
            </Label>
            <Switch id={`toggle-${functionName}`} checked={isEnabled} onCheckedChange={toggleEnabled} />
          </div>

          {/* Informações de agendamento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{scheduleDescription || schedule}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setConfigDialogOpen(true)} className="h-8 px-2">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Executado {executionCount} vezes
            </p>
          </div>

        {/* Última execução */}
        {lastExecution && <div className="flex items-start gap-2 p-3 rounded-lg bg-[#eff0cf]">
            {lastExecution.success ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {lastExecution.success ? "Executado com sucesso" : "Erro na execução"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(lastExecution.timestamp, "dd/MM/yyyy 'às' HH:mm:ss", {
                locale: ptBR
              })}
              </p>
              {lastExecution.message && <p className="text-xs text-muted-foreground mt-1">
                  {lastExecution.message}
                </p>}
            </div>
          </div>}

          {/* Botão de execução manual */}
          <div className="flex gap-2">
            <Button onClick={executeFunction} disabled={isExecuting || !isEnabled} className="flex-1" variant="outline">
              {isExecuting ? <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executando...
                </> : <>
                  <Play className="w-4 h-4 mr-2" />
                  Executar Agora
                </>}
            </Button>
          </div>

          {!isEnabled && <p className="text-xs text-center text-muted-foreground">
              Ative a função para executar manualmente
            </p>}
        </CardContent>
      </Card>

      <EdgeFunctionConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} functionName={functionName} currentSchedule={schedule} onUpdate={loadConfig} />
    </>;
}
