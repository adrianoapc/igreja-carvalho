import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Heart, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SentimentoTipo = 'feliz' | 'cuidadoso' | 'abencoado' | 'grato' | 'angustiado' | 'sozinho' | 'triste' | 'doente' | 'com_pouca_fe';

interface SentimentoConfig {
  emoji: string;
  label: string;
  color: string;
  type: 'positive' | 'negative';
}

const sentimentosConfig: Record<SentimentoTipo, SentimentoConfig> = {
  feliz: { emoji: '😊', label: 'Feliz', color: 'text-green-600', type: 'positive' },
  cuidadoso: { emoji: '😇', label: 'Cuidadoso', color: 'text-blue-600', type: 'positive' },
  abencoado: { emoji: '😇', label: 'Abençoado', color: 'text-purple-600', type: 'positive' },
  grato: { emoji: '😄', label: 'Grato', color: 'text-yellow-600', type: 'positive' },
  angustiado: { emoji: '😔', label: 'Angustiado', color: 'text-orange-600', type: 'negative' },
  sozinho: { emoji: '😢', label: 'Sozinho', color: 'text-pink-600', type: 'negative' },
  triste: { emoji: '😭', label: 'Triste', color: 'text-red-600', type: 'negative' },
  doente: { emoji: '🤢', label: 'Doente', color: 'text-green-800', type: 'negative' },
  com_pouca_fe: { emoji: '😰', label: 'Com pouca fé', color: 'text-gray-600', type: 'negative' }
};

export default function Sentimentos() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("7");
  const [stats, setStats] = useState<Record<SentimentoTipo, number>>({
    feliz: 0,
    cuidadoso: 0,
    abencoado: 0,
    grato: 0,
    angustiado: 0,
    sozinho: 0,
    triste: 0,
    doente: 0,
    com_pouca_fe: 0
  });

  useEffect(() => {
    fetchStats();
  }, [periodo]);

  const fetchStats = async () => {
    try {
      const dias = parseInt(periodo);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabase
        .from('sentimentos_membros')
        .select('sentimento')
        .gte('data_registro', dataInicio.toISOString());

      if (error) throw error;

      // Contar sentimentos
      const counts: Record<string, number> = {};
      data?.forEach(item => {
        counts[item.sentimento] = (counts[item.sentimento] || 0) + 1;
      });

      setStats({
        feliz: counts.feliz || 0,
        cuidadoso: counts.cuidadoso || 0,
        abencoado: counts.abencoado || 0,
        grato: counts.grato || 0,
        angustiado: counts.angustiado || 0,
        sozinho: counts.sozinho || 0,
        triste: counts.triste || 0,
        doente: counts.doente || 0,
        com_pouca_fe: counts.com_pouca_fe || 0
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/intercessao")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Sentimentos</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Como os membros estão se sentindo
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <CardTitle className="text-base md:text-lg">Sentimentos</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Os membros podem registrar diariamente como estão se sentindo.
                      Sentimentos negativos direcionam para pedidos de oração.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="space-y-3">
            {(Object.entries(sentimentosConfig) as [SentimentoTipo, SentimentoConfig][]).map(([key, config]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.emoji}</span>
                  <span className="font-medium text-sm md:text-base">{config.label}</span>
                </div>
                <Badge
                  variant={config.type === 'positive' ? 'default' : 'destructive'}
                  className={`${config.color} text-base md:text-lg font-semibold`}
                >
                  {stats[key]}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Sobre os Sentimentos</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Sentimentos Positivos (Feliz, Cuidadoso):</strong> Membros recebem mensagem de agradecimento.
          </p>
          <p>
            <strong>Sentimentos de Gratidão (Grato, Abençoado):</strong> Membros são convidados a compartilhar um testemunho.
          </p>
          <p>
            <strong>Sentimentos Negativos:</strong> Membros são direcionados para criar um pedido de oração e recebem apoio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}