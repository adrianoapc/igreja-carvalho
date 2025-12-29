import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { startOfDay, endOfDay } from "date-fns";

type SentimentoTipo = 'feliz' | 'cuidadoso' | 'abencoado' | 'grato' | 'angustiado' | 'sozinho' | 'triste' | 'doente' | 'com_pouca_fe';

interface SentimentoConfig {
  emoji: string;
  label: string;
  type: 'positive' | 'grateful' | 'negative';
}

const sentimentosConfig: Record<SentimentoTipo, SentimentoConfig> = {
  feliz: { emoji: '😊', label: 'Feliz', type: 'positive' },
  cuidadoso: { emoji: '😇', label: 'Cuidadoso', type: 'positive' },
  abencoado: { emoji: '😇', label: 'Abençoado', type: 'grateful' },
  grato: { emoji: '😄', label: 'Grato', type: 'grateful' },
  angustiado: { emoji: '😔', label: 'Angustiado', type: 'negative' },
  sozinho: { emoji: '😢', label: 'Sozinho', type: 'negative' },
  triste: { emoji: '😭', label: 'Triste', type: 'negative' },
  doente: { emoji: '🤢', label: 'Doente', type: 'negative' },
  com_pouca_fe: { emoji: '😰', label: 'Com pouca fé', type: 'negative' }
};

interface RegistrarSentimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RegistrarSentimentoDialog({ open, onOpenChange }: RegistrarSentimentoDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'message' | 'result' | 'already_registered'>('select');
  const [selectedSentimento, setSelectedSentimento] = useState<SentimentoTipo | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingSentimento, setExistingSentimento] = useState<SentimentoTipo | null>(null);

  // Verificar se já existe registro hoje ao abrir o dialog
  useEffect(() => {
    if (open) {
      checkExistingToday();
    }
  }, [open]);

  const checkExistingToday = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return;

      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      const { data: existing } = await supabase
        .from('sentimentos_membros')
        .select('sentimento')
        .eq('pessoa_id', profile.id)
        .gte('data_registro', dayStart)
        .lte('data_registro', dayEnd)
        .limit(1)
        .maybeSingle();

      if (existing) {
        setExistingSentimento(existing.sentimento as SentimentoTipo);
        setStep('already_registered');
      }
    } catch (error) {
      console.error('Erro ao verificar sentimento existente:', error);
    }
  };

  const handleSelectSentimento = (sentimento: SentimentoTipo) => {
    setSelectedSentimento(sentimento);
    const config = sentimentosConfig[sentimento];
    
    if (config.type === 'positive') {
      // Sentimentos positivos: apenas agradecer
      saveSentimento(sentimento, "");
    } else {
      // Outros sentimentos: mostrar próximo passo
      setStep('message');
    }
  };

  const saveSentimento = async (sentimento: SentimentoTipo, msg: string) => {
    try {
      setLoading(true);

      // Buscar pessoa_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error("Perfil não encontrado");

      // Verificar duplicidade antes de inserir
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      const { data: existing } = await supabase
        .from('sentimentos_membros')
        .select('sentimento')
        .eq('pessoa_id', profile.id)
        .gte('data_registro', dayStart)
        .lte('data_registro', dayEnd)
        .limit(1)
        .maybeSingle();

      if (existing) {
        setExistingSentimento(existing.sentimento as SentimentoTipo);
        setStep('already_registered');
        toast({
          title: "Sentimento já registrado",
          description: "Você já compartilhou como está se sentindo hoje.",
        });
        return;
      }

      const { data: insertedData, error } = await supabase
        .from('sentimentos_membros')
        .insert({
          pessoa_id: profile.id,
          sentimento,
          mensagem: msg || null
        })
        .select('id')
        .single();

      if (error) throw error;

      // Trigger AI analysis in background (non-blocking)
      if (msg && insertedData?.id) {
        supabase.functions.invoke('analise-sentimento-ia', {
          body: { sentimento_id: insertedData.id }
        }).catch(err => {
          console.error('AI analysis background error:', err);
        });
      }

      setStep('result');
      
      toast({
        title: "Obrigado por compartilhar!",
        description: "Seu sentimento foi registrado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar sentimento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar seu sentimento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMessage = () => {
    if (selectedSentimento) {
      saveSentimento(selectedSentimento, mensagem);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedSentimento(null);
    setMensagem("");
    setExistingSentimento(null);
    onOpenChange(false);
  };

  const renderAlreadyRegistered = () => {
    const config = existingSentimento ? sentimentosConfig[existingSentimento] : null;
    return (
      <div className="text-center space-y-4 py-6">
        <div className="flex justify-center">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold">Você já registrou hoje!</h3>
        {config && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <span className="text-2xl">{config.emoji}</span>
            <span>{config.label}</span>
          </div>
        )}
        <p className="text-muted-foreground text-sm">
          Volte amanhã para compartilhar como está se sentindo.
        </p>
        <Button onClick={handleClose} className="w-full">
          Fechar
        </Button>
      </div>
    );
  };

  const renderResultMessage = () => {
    if (!selectedSentimento) return null;
    const config = sentimentosConfig[selectedSentimento];

    if (config.type === 'positive') {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="text-6xl mb-4">{config.emoji}</div>
          <h3 className="text-xl font-semibold">Que maravilha!</h3>
          <p className="text-muted-foreground">
            Agradecemos por compartilhar sua alegria conosco. Que Deus continue abençoando sua vida!
          </p>
          <Button onClick={handleClose} className="w-full">
            Fechar
          </Button>
        </div>
      );
    }

    if (config.type === 'grateful') {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="text-6xl mb-4">{config.emoji}</div>
          <h3 className="text-xl font-semibold">Deus seja louvado!</h3>
          <p className="text-muted-foreground">
            Que bênção! Gostaríamos de convidar você a compartilhar seu testemunho para edificar outros irmãos.
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => {
                handleClose();
                navigate('/intercessao/testemunhos', { 
                  state: { 
                    openNew: true, 
                    content: mensagem 
                  } 
                });
              }}
              className="w-full"
            >
              <Heart className="w-4 h-4 mr-2" />
              Compartilhar Testemunho
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full">
              Agora não
            </Button>
          </div>
        </div>
      );
    }

    if (config.type === 'negative') {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="text-6xl mb-4">{config.emoji}</div>
          <h3 className="text-xl font-semibold">Estamos com você</h3>
          <p className="text-muted-foreground">
            Sentimos muito que esteja passando por isso. Gostaríamos de orar por você. 
            Que tal compartilhar um pedido de oração com nossa equipe de intercessão?
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => {
                handleClose();
                navigate('/intercessao/pedidos', { 
                  state: { 
                    openNew: true, 
                    description: mensagem 
                  } 
                });
              }}
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar Pedido de Oração
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full">
              Agora não
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={handleClose}
      title={step === 'already_registered' ? 'Sentimento do dia' : step === 'select' ? 'Como você está se sentindo hoje?' : step === 'message' ? 'Quer compartilhar mais?' : ''}
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {step === 'select' && (
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(sentimentosConfig) as [SentimentoTipo, SentimentoConfig][]).map(([key, config]) => (
                <Button
                  key={key}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10"
                  onClick={() => handleSelectSentimento(key)}
                  disabled={loading}
                >
                  <span className="text-3xl">{config.emoji}</span>
                  <span className="text-xs text-center">{config.label}</span>
                </Button>
              ))}
            </div>
          )}

          {step === 'message' && selectedSentimento && (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-6xl">{sentimentosConfig[selectedSentimento].emoji}</span>
              </div>
              <Textarea
                placeholder="Compartilhe o que está sentindo (opcional)..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
              />
              <div className="space-y-2">
                <Button 
                  onClick={handleSubmitMessage}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Salvando..." : "Continuar"}
                </Button>
                <Button 
                  onClick={() => saveSentimento(selectedSentimento, "")}
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  Pular
                </Button>
              </div>
            </div>
          )}

          {step === 'result' && renderResultMessage()}

          {step === 'already_registered' && renderAlreadyRegistered()}
        </div>
      </div>
    </ResponsiveDialog>
  );
}