import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Phone, 
  Mail, 
  Calendar, 
  Check, 
  X, 
  Gift,
  PhoneCall,
  Clock,
  User,
  ArrowRight
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

interface Visitante {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  aceitou_jesus: boolean | null;
  deseja_contato: boolean | null;
  recebeu_brinde: boolean | null;
  status: "visitante" | "frequentador" | "membro";
  user_id: string | null;
}

interface Contato {
  id: string;
  data_contato: string;
  tipo_contato: string;
  status: string;
  observacoes: string | null;
  membro_responsavel_id: string;
  profiles: {
    nome: string;
    user_id: string;
  } | null;
}

interface VisitanteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitante: Visitante;
  onAgendarContato: () => void;
  onUpdate?: () => void;
}

export function VisitanteDetailsDialog({ 
  open, 
  onOpenChange, 
  visitante,
  onAgendarContato,
  onUpdate
}: VisitanteDetailsDialogProps) {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && visitante.id) {
      fetchContatos();
    }
  }, [open, visitante.id]);

  const fetchContatos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("visitante_contatos")
        .select("*")
        .eq("visitante_id", visitante.id)
        .order("data_contato", { ascending: false });

      if (error) throw error;
      
      // Buscar nomes dos membros responsáveis
      if (data && data.length > 0) {
        const membroIds = [...new Set(data.map(c => c.membro_responsavel_id))];
        const { data: membros } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", membroIds);
        
        const contatosComNomes = data.map(contato => ({
          ...contato,
          profiles: membros?.find(m => m.user_id === contato.membro_responsavel_id) || null
        }));
        
        setContatos(contatosComNomes);
      } else {
        setContatos([]);
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "agendado":
        return "bg-accent/20 text-accent-foreground";
      case "realizado":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "cancelado":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
    }
  };

  const getTipoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      telefonico: "Telefônico",
      whatsapp: "WhatsApp",
      email: "Email",
      presencial: "Presencial"
    };
    return tipos[tipo] || tipo;
  };

  const getNextStatus = () => {
    if (visitante.status === "visitante") return "frequentador";
    if (visitante.status === "frequentador") return "membro";
    return null;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "visitante": return "outline";
      case "frequentador": return "secondary";
      case "membro": return "default";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "visitante": return "Visitante";
      case "frequentador": return "Frequentador";
      case "membro": return "Membro";
      default: return status;
    }
  };

  const handlePromote = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    setPromoting(true);
    try {
      const updateData: any = { status: nextStatus };
      
      // Se está promovendo para membro, adiciona data_cadastro_membro
      if (nextStatus === "membro") {
        updateData.data_cadastro_membro = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", visitante.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `${visitante.nome} foi promovido para ${getStatusLabel(nextStatus)}`,
      });

      setShowPromoteDialog(false);
      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error("Erro ao promover:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    } finally {
      setPromoting(false);
    }
  };

  const nextStatus = getNextStatus();

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <div className="flex flex-col h-full">
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">Detalhes do Visitante</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{visitante.nome}</h3>
                      <div className="flex flex-wrap gap-2 items-center mt-2">
                        <Badge variant={getStatusBadgeVariant(visitante.status)}>
                          {getStatusLabel(visitante.status)}
                        </Badge>
                        <Badge variant="outline" className="bg-primary/10">
                          {visitante.numero_visitas} {visitante.numero_visitas === 1 ? 'visita' : 'visitas'}
                        </Badge>
                        {visitante.data_primeira_visita && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            1ª visita: {format(new Date(visitante.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                        {visitante.data_ultima_visita && visitante.data_ultima_visita !== visitante.data_primeira_visita && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Última: {format(new Date(visitante.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      {visitante.telefone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{visitante.telefone}</span>
                        </div>
                      )}
                      {visitante.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{visitante.email}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {visitante.aceitou_jesus ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Aceitou Jesus</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {visitante.deseja_contato ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Deseja contato</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {visitante.recebeu_brinde ? (
                          <Gift className="w-4 h-4 text-green-600" />
                        ) : (
                          <Gift className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">Recebeu brinde</span>
                      </div>
                    </div>

                    {nextStatus && (
                      <>
                        <Separator />
                        <Button 
                          className="w-full"
                          onClick={() => setShowPromoteDialog(true)}
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Promover para {getStatusLabel(nextStatus)}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Histórico de Contatos</h4>
                <Button size="sm" onClick={onAgendarContato}>
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Agendar Contato
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Carregando contatos...
                </div>
              ) : contatos.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum contato agendado ainda
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {contatos.map((contato) => (
                    <Card key={contato.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {format(new Date(contato.data_contato), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getTipoLabel(contato.tipo_contato)}
                              </Badge>
                            </div>
                            
                            {contato.profiles && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="w-3 h-3" />
                                <span>{contato.profiles.nome}</span>
                              </div>
                            )}
                            
                            {contato.observacoes && (
                              <p className="text-sm text-muted-foreground">{contato.observacoes}</p>
                            )}
                          </div>
                          
                          <Badge className={getStatusColor(contato.status)}>
                            {contato.status === "agendado" && "Agendado"}
                            {contato.status === "realizado" && "Realizado"}
                            {contato.status === "cancelado" && "Cancelado"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </div>
        </div>
      </ResponsiveDialog>

      <AlertDialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover para {nextStatus && getStatusLabel(nextStatus)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a promover <strong>{visitante.nome}</strong> de {getStatusLabel(visitante.status)} para {nextStatus && getStatusLabel(nextStatus)}.
              {nextStatus === "frequentador" && " Isso permitirá que a pessoa tenha acesso ao aplicativo."}
              {nextStatus === "membro" && " Isso registrará a data de cadastro como membro e permitirá atribuição de cargos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote} disabled={promoting}>
              {promoting ? "Promovendo..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
