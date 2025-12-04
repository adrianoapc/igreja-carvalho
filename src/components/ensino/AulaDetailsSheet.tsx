import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Church,
  UserCheck,
  UserX,
  Baby,
  Download,
  CheckCircle2,
  Printer
} from "lucide-react";
import PrintLabelDialog from "./PrintLabelDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Aula {
  id: string;
  tema: string | null;
  data_inicio: string;
  duracao_minutos: number;
  modalidade: string;
  link_reuniao: string | null;
  status: string;
  sala_id: string | null;
  jornada_id: string | null;
  culto_id: string | null;
  professor_id: string | null;
  sala?: { id: string; nome: string } | null;
  jornada?: { id: string; titulo: string } | null;
  culto?: { id: string; titulo: string } | null;
  professor?: { id: string; nome: string; avatar_url: string | null } | null;
}

interface Presenca {
  id: string;
  aluno_id: string;
  checkin_at: string;
  checkout_at: string | null;
  status: string;
  responsavel_checkout_id: string | null;
  aluno?: { id: string; nome: string; avatar_url: string | null };
}

interface Aluno {
  id: string;
  nome: string;
  avatar_url: string | null;
  presente: boolean;
  presenca_id?: string;
  necessidades_especiais?: string;
  telefone?: string;
}

interface AulaDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aula: Aula | null;
  onUpdate: () => void;
}

interface PrintLabelData {
  crianca: {
    id: string;
    nome: string;
    alergias?: string;
    necessidades_especiais?: string;
  };
  responsavel: {
    nome: string;
    telefone?: string;
  };
  checkinId: string;
  checkinTime: Date;
}

export default function AulaDetailsSheet({ 
  open, 
  onOpenChange, 
  aula,
  onUpdate 
}: AulaDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [checkoutResponsavelId, setCheckoutResponsavelId] = useState("");
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string; telefone?: string }[]>([]);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);

  const isKids = aula?.sala?.nome?.toLowerCase().includes("kids") || 
                 aula?.sala?.nome?.toLowerCase().includes("berçário") ||
                 aula?.sala?.nome?.toLowerCase().includes("criança");

  useEffect(() => {
    if (open && aula) {
      fetchAlunos();
      fetchPresencas();
      if (isKids) {
        fetchResponsaveis();
      }
    }
  }, [open, aula]);

  const fetchAlunos = async () => {
    if (!aula?.jornada_id) return;

    // Buscar alunos inscritos na jornada
    const { data, error } = await supabase
      .from("inscricoes_jornada")
      .select(`
        pessoa_id,
        pessoa:profiles!inscricoes_jornada_pessoa_id_fkey(id, nome, avatar_url, necessidades_especiais, telefone)
      `)
      .eq("jornada_id", aula.jornada_id)
      .eq("concluido", false);

    if (error) {
      console.error("Erro ao carregar alunos:", error);
      return;
    }

    const alunosList = (data || []).map((item: any) => ({
      id: item.pessoa_id,
      nome: item.pessoa?.nome || "Sem nome",
      avatar_url: item.pessoa?.avatar_url,
      presente: false,
      necessidades_especiais: item.pessoa?.necessidades_especiais,
      telefone: item.pessoa?.telefone,
    }));

    setAlunos(alunosList);
  };

  const fetchPresencas = async () => {
    if (!aula) return;

    const { data, error } = await supabase
      .from("presencas_aula")
      .select(`
        *,
        aluno:profiles!presencas_aula_aluno_id_fkey(id, nome, avatar_url)
      `)
      .eq("aula_id", aula.id);

    if (error) {
      console.error("Erro ao carregar presenças:", error);
      return;
    }

    setPresencas(data || []);

    // Atualizar status de presença nos alunos
    setAlunos((prev) =>
      prev.map((aluno) => ({
        ...aluno,
        presente: (data || []).some((p: any) => p.aluno_id === aluno.id),
        presenca_id: (data || []).find((p: any) => p.aluno_id === aluno.id)?.id,
      }))
    );
  };

  const fetchResponsaveis = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, telefone")
      .eq("status", "membro")
      .order("nome");
    
    setResponsaveis(data || []);
  };

  const togglePresenca = async (alunoId: string, presente: boolean, responsavelId?: string) => {
    if (!aula) return;

    setLoading(true);

    if (presente) {
      // Adicionar presença
      const { data: insertedData, error } = await supabase
        .from("presencas_aula")
        .insert({
          aula_id: aula.id,
          aluno_id: alunoId,
          status: "presente",
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao registrar presença");
        setLoading(false);
        return;
      }

      await fetchPresencas();
      setLoading(false);
      toast.success("Check-in realizado!");

      // Se for modo Kids, mostrar dialog de impressão
      if (isKids && insertedData) {
        const aluno = alunos.find(a => a.id === alunoId);
        const responsavel = responsavelId 
          ? responsaveis.find(r => r.id === responsavelId) 
          : { nome: "Responsável", telefone: undefined };
        
        if (aluno) {
          setPrintLabelData({
            crianca: {
              id: aluno.id,
              nome: aluno.nome,
              necessidades_especiais: aluno.necessidades_especiais,
            },
            responsavel: {
              nome: responsavel?.nome || "Responsável",
              telefone: responsavel?.telefone,
            },
            checkinId: insertedData.id,
            checkinTime: new Date(),
          });
          setPrintDialogOpen(true);
        }
      }
    } else {
      // Remover presença
      const { error } = await supabase
        .from("presencas_aula")
        .delete()
        .eq("aula_id", aula.id)
        .eq("aluno_id", alunoId);

      if (error) {
        toast.error("Erro ao remover presença");
        setLoading(false);
        return;
      }

      await fetchPresencas();
      setLoading(false);
      toast.success("Presença removida");
    }
  };

  const handleReprintLabel = (presenca: Presenca) => {
    if (!aula) return;
    
    const aluno = alunos.find(a => a.id === presenca.aluno_id);
    if (!aluno) return;

    setPrintLabelData({
      crianca: {
        id: aluno.id,
        nome: aluno.nome,
        necessidades_especiais: aluno.necessidades_especiais,
      },
      responsavel: {
        nome: "Responsável",
        telefone: aluno.telefone,
      },
      checkinId: presenca.id,
      checkinTime: new Date(presenca.checkin_at),
    });
    setPrintDialogOpen(true);
  };

  const handleCheckout = async (presencaId: string) => {
    if (!checkoutResponsavelId) {
      toast.error("Selecione o responsável pela retirada");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("presencas_aula")
      .update({
        checkout_at: new Date().toISOString(),
        responsavel_checkout_id: checkoutResponsavelId,
      })
      .eq("id", presencaId);

    setLoading(false);

    if (error) {
      toast.error("Erro ao registrar checkout");
      return;
    }

    await fetchPresencas();
    toast.success("Checkout realizado!");
    setCheckoutResponsavelId("");
  };

  const importarPresencasCulto = async () => {
    if (!aula?.culto_id) return;

    setLoading(true);

    // Buscar presenças do culto
    const { data: presencasCulto, error: fetchError } = await supabase
      .from("presencas_culto")
      .select("pessoa_id")
      .eq("culto_id", aula.culto_id);

    if (fetchError) {
      toast.error("Erro ao buscar presenças do culto");
      setLoading(false);
      return;
    }

    if (!presencasCulto?.length) {
      toast.info("Nenhuma presença registrada no culto");
      setLoading(false);
      return;
    }

    // Inserir presenças na aula (ignorar duplicatas)
    const presencasToInsert = presencasCulto.map((p) => ({
      aula_id: aula.id,
      aluno_id: p.pessoa_id,
      status: "presente",
    }));

    const { error: insertError } = await supabase
      .from("presencas_aula")
      .upsert(presencasToInsert, { 
        onConflict: "aula_id,aluno_id",
        ignoreDuplicates: true 
      });

    setLoading(false);

    if (insertError) {
      console.error("Erro ao importar:", insertError);
      toast.error("Erro ao importar presenças");
      return;
    }

    await fetchPresencas();
    toast.success(`${presencasCulto.length} presenças importadas!`);
  };

  if (!aula) return null;

  const presentesCount = presencas.filter(p => p.status === "presente").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{aula.tema || "Aula sem tema"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Info da Aula */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {format(new Date(aula.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {format(new Date(aula.data_inicio), "HH:mm")} ({aula.duracao_minutos}min)
            </div>
            {aula.sala && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {aula.sala.nome}
              </div>
            )}
            {aula.modalidade === "online" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Video className="w-4 h-4" />
                Online
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {aula.jornada && (
              <Badge variant="secondary">{aula.jornada.titulo}</Badge>
            )}
            {aula.culto_id && (
              <Badge className="gap-1 bg-primary/10 text-primary">
                <Church className="w-3 h-3" />
                Vinculado ao Culto
              </Badge>
            )}
            <Badge 
              variant={aula.status === "em_andamento" ? "default" : "outline"}
              className="capitalize"
            >
              {aula.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Ação de Importar Presenças do Culto */}
          {aula.culto_id && (
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={importarPresencasCulto}
              disabled={loading}
            >
              <Download className="w-4 h-4" />
              Importar Presenças do Culto
            </Button>
          )}

          {/* Lista de Chamada */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Lista de Chamada
              </h3>
              <Badge variant="outline">
                {presentesCount} presentes
              </Badge>
            </div>

            {isKids && (
              <div className="p-3 rounded-lg bg-pink-50 border border-pink-200 text-sm text-pink-700">
                <Baby className="w-4 h-4 inline mr-2" />
                Modo Kids: Check-in/Check-out com responsável obrigatório
              </div>
            )}

            {alunos.length === 0 && presencas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {aula.jornada_id 
                  ? "Nenhum aluno inscrito nesta jornada"
                  : "Vincule a aula a uma jornada para ver os alunos"}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Mostrar alunos inscritos */}
                {alunos.map((aluno) => (
                  <div
                    key={aluno.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={aluno.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {aluno.nome?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{aluno.nome}</span>
                    </div>

                    {isKids ? (
                      <div className="flex items-center gap-2">
                        {!aluno.presente ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => togglePresenca(aluno.id, true)}
                            disabled={loading}
                          >
                            <UserCheck className="w-3 h-3" />
                            Check-in
                          </Button>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Presente
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Checkbox
                        checked={aluno.presente}
                        onCheckedChange={(checked) => 
                          togglePresenca(aluno.id, checked as boolean)
                        }
                        disabled={loading}
                      />
                    )}
                  </div>
                ))}

                {/* Mostrar presenças (para checkout Kids) */}
                {isKids && presencas.filter(p => !p.checkout_at).length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <UserX className="w-4 h-4" />
                      Aguardando Checkout
                    </h4>
                    
                    <div className="space-y-2">
                      <Label>Responsável pela retirada</Label>
                      <Select 
                        value={checkoutResponsavelId} 
                        onValueChange={setCheckoutResponsavelId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {presencas
                      .filter((p) => !p.checkout_at)
                      .map((presenca) => (
                        <div
                          key={presenca.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={presenca.aluno?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {presenca.aluno?.nome?.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-sm">
                                {presenca.aluno?.nome}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                Check-in: {format(new Date(presenca.checkin_at), "HH:mm")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleReprintLabel(presenca)}
                              title="Reimprimir etiqueta"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => handleCheckout(presenca.id)}
                              disabled={loading || !checkoutResponsavelId}
                            >
                              <UserX className="w-3 h-3" />
                              Checkout
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Dialog de impressão de etiquetas */}
      {printLabelData && (
        <PrintLabelDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          crianca={printLabelData.crianca}
          responsavel={printLabelData.responsavel}
          sala={aula?.sala?.nome || "Sala Kids"}
          checkinId={printLabelData.checkinId}
          checkinTime={printLabelData.checkinTime}
        />
      )}
    </Sheet>
  );
}
