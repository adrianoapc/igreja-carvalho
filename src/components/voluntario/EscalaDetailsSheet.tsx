import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Music, FileText, Youtube, ExternalLink, BookOpen, ClipboardList, Baby } from "lucide-react";

interface Escala {
  id: string;
  culto: {
    id: string;
    titulo: string;
    data_culto: string;
    tipo: string;
    tema: string | null;
    local: string | null;
  };
  time: {
    id: string;
    nome: string;
    cor: string;
    categoria: string | null;
  };
  posicao: {
    id: string;
    nome: string;
  } | null;
  observacoes: string | null;
}

interface Cancao {
  id: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  bpm: number | null;
  cifra: string | null;
  link_youtube: string | null;
  link_spotify: string | null;
  ordem: number;
}

interface Aula {
  id: string;
  tema: string | null;
  data_inicio: string;
  sala: {
    nome: string;
  } | null;
  jornada: {
    titulo: string;
    descricao: string | null;
  } | null;
}

interface EscalaDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escala: Escala | null;
}

export function EscalaDetailsSheet({ open, onOpenChange, escala }: EscalaDetailsSheetProps) {
  const [cancoes, setCancoes] = useState<Cancao[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(false);

  const categoria = escala?.time.categoria?.toLowerCase() || "";
  const isLouvor = categoria.includes("louvor") || categoria.includes("música");
  const isKids = categoria.includes("kids") || categoria.includes("infantil");

  useEffect(() => {
    if (open && escala) {
      loadDetails();
    }
  }, [open, escala]);

  const loadDetails = async () => {
    if (!escala) return;
    
    setLoading(true);
    try {
      // Carregar canções do culto se for equipe de louvor
      if (isLouvor) {
        const { data: cancoesData } = await supabase
          .from("cancoes_culto")
          .select("*")
          .eq("culto_id", escala.culto.id)
          .order("ordem", { ascending: true });
        
        setCancoes(cancoesData || []);
      }

      // Carregar aulas se for Kids
      if (isKids) {
        const cultoDate = new Date(escala.culto.data_culto);
        const startOfDay = new Date(cultoDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(cultoDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: aulasData } = await supabase
          .from("aulas")
          .select(`
            id,
            tema,
            data_inicio,
            sala:salas!aulas_sala_id_fkey (nome),
            jornada:jornadas!aulas_jornada_id_fkey (titulo, descricao)
          `)
          .gte("data_inicio", startOfDay.toISOString())
          .lte("data_inicio", endOfDay.toISOString())
          .order("data_inicio", { ascending: true });
        
        setAulas(aulasData as Aula[] || []);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!escala) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: escala.time.cor }}
            />
            {escala.time.nome}
          </SheetTitle>
          <SheetDescription>
            {escala.culto.titulo} • {format(new Date(escala.culto.data_culto), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
              {isLouvor && <TabsTrigger value="repertorio" className="flex-1">Repertório</TabsTrigger>}
              {isKids && <TabsTrigger value="aula" className="flex-1">Aula</TabsTrigger>}
              {!isLouvor && !isKids && <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>}
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detalhes do Culto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span>{escala.culto.tipo}</span>
                  </div>
                  {escala.culto.tema && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tema:</span>
                      <span>{escala.culto.tema}</span>
                    </div>
                  )}
                  {escala.culto.local && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local:</span>
                      <span>{escala.culto.local}</span>
                    </div>
                  )}
                  {escala.posicao && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sua função:</span>
                      <Badge variant="outline">{escala.posicao.nome}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {escala.observacoes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{escala.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {isLouvor && (
              <TabsContent value="repertorio" className="space-y-4 mt-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : cancoes.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center py-8">
                      <Music className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhuma música definida ainda</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {cancoes.map((cancao, index) => (
                      <Card key={cancao.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{cancao.titulo}</h4>
                              {cancao.artista && (
                                <p className="text-sm text-muted-foreground">{cancao.artista}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {cancao.tom && (
                                  <Badge variant="secondary">Tom: {cancao.tom}</Badge>
                                )}
                                {cancao.bpm && (
                                  <Badge variant="secondary">{cancao.bpm} BPM</Badge>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                {cancao.cifra && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={cancao.cifra} target="_blank" rel="noopener noreferrer">
                                      <FileText className="h-4 w-4 mr-1" />
                                      Cifra
                                    </a>
                                  </Button>
                                )}
                                {cancao.link_youtube && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={cancao.link_youtube} target="_blank" rel="noopener noreferrer">
                                      <Youtube className="h-4 w-4 mr-1" />
                                      YouTube
                                    </a>
                                  </Button>
                                )}
                                {cancao.link_spotify && (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={cancao.link_spotify} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-1" />
                                      Spotify
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {isKids && (
              <TabsContent value="aula" className="space-y-4 mt-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
                  </div>
                ) : aulas.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center py-8">
                      <Baby className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhuma aula agendada para este dia</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {aulas.map(aula => (
                      <Card key={aula.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{aula.tema || "Aula"}</CardTitle>
                              {aula.sala && (
                                <p className="text-sm text-muted-foreground">Sala: {aula.sala.nome}</p>
                              )}
                            </div>
                            <Badge variant="outline">
                              {format(new Date(aula.data_inicio), "HH:mm")}
                            </Badge>
                          </div>
                        </CardHeader>
                        {aula.jornada && (
                          <CardContent>
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-1">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <span className="font-medium text-sm">{aula.jornada.titulo}</span>
                              </div>
                              {aula.jornada.descricao && (
                                <p className="text-sm text-muted-foreground">{aula.jornada.descricao}</p>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {!isLouvor && !isKids && (
              <TabsContent value="checklist" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Checklist do Ministério
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {escala.observacoes ? (
                      <div className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{escala.observacoes}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma instrução específica foi adicionada para esta escala.
                        Entre em contato com o líder do ministério se tiver dúvidas.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Lembrete Geral</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>• Chegue com pelo menos 30 minutos de antecedência</p>
                    <p>• Use vestimenta adequada ao ministério</p>
                    <p>• Em caso de imprevisto, avise o líder o quanto antes</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
