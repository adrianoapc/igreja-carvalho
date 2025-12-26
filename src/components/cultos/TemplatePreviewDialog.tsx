import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  FileText, 
  Users, 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  MessageSquare,
  Film,
  CheckCircle2
} from "lucide-react";

interface Template {
  id: string;
  nome: string;
  descricao?: string;
  tipo_culto?: string;
  tema_padrao?: string;
  local_padrao?: string;
  duracao_padrao?: number;
  pregador_padrao?: string;
  observacoes_padrao?: string;
  incluir_escalas?: boolean;
  categoria?: string;
}

interface ItemLiturgia {
  tipo: string;
  titulo: string;
  descricao?: string;
  duracao_minutos?: number;
  responsavel_externo?: string;
  ordem: number;
  midias_ids?: string[];
}

interface Escala {
  time: { nome: string; cor?: string };
  posicao?: { nome: string };
  pessoa: { nome: string };
}

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  onConfirm?: (template: Template) => void;
}

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  templateId,
  onConfirm
}: TemplatePreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [itensLiturgia, setItensLiturgia] = useState<ItemLiturgia[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [midias, setMidias] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open && templateId) {
      loadTemplatePreview();
    }
  }, [open, templateId]);

  const loadTemplatePreview = async () => {
    if (!templateId) return;

    setLoading(true);
    try {
      // Buscar dados do template
      const { data: templateData, error: templateError } = await supabase
        .from("templates_culto")
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError) throw templateError;
      setTemplate(templateData);

      // Buscar itens da liturgia
      const { data: itensData, error: itensError } = await supabase
        .from("itens_template_culto")
        .select("*")
        .eq("template_id", templateId)
        .order("ordem");

      if (itensError) throw itensError;
      setItensLiturgia(itensData || []);

      // Buscar títulos das mídias
      const allMidiaIds = (itensData || [])
        .flatMap(item => item.midias_ids || [])
        .filter((id, index, self) => self.indexOf(id) === index);

      if (allMidiaIds.length > 0) {
        const { data: midiasData } = await supabase
          .from("midias")
          .select("id, titulo")
          .in("id", allMidiaIds);

        const midiasMap = new Map(
          (midiasData || []).map(m => [m.id, m.titulo])
        );
        setMidias(midiasMap);
      }

      // Buscar escalas se incluídas
      if (templateData.incluir_escalas) {
        const { data: escalasData, error: escalasError } = await supabase
          .from("escalas_template")
          .select(`
            *,
            time:time_id(nome, cor),
            posicao:posicao_id(nome),
            pessoa:pessoa_id(nome)
          `)
          .eq("template_id", templateId);

        if (escalasError) throw escalasError;
        setEscalas(escalasData || []);
      }

    } catch (error: any) {
      console.error("Erro ao carregar preview:", error);
      toast.error("Erro ao carregar preview do template");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (template && onConfirm) {
      onConfirm(template);
      onOpenChange(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!template) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Preview do Template</h2>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="space-y-6">
            {/* Informações do Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {template.nome}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.descricao && (
                  <p className="text-sm text-muted-foreground">{template.descricao}</p>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {template.categoria && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{template.categoria}</Badge>
                    </div>
                  )}
                  {template.tipo_culto && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{template.tipo_culto}</span>
                    </div>
                  )}
                  {template.duracao_padrao && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{template.duracao_padrao} min</span>
                    </div>
                  )}
                  {template.local_padrao && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{template.local_padrao}</span>
                    </div>
                  )}
                  {template.pregador_padrao && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{template.pregador_padrao}</span>
                    </div>
                  )}
                  {template.tema_padrao && (
                    <div className="flex items-center gap-2 text-sm col-span-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{template.tema_padrao}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Liturgia */}
            {itensLiturgia.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Liturgia ({itensLiturgia.length} itens)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {itensLiturgia.map((item, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Badge variant="outline" className="shrink-0">
                          #{item.ordem}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge>{item.tipo}</Badge>
                            {item.duracao_minutos && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {item.duracao_minutos} min
                              </Badge>
                            )}
                            {item.responsavel_externo && (
                              <Badge variant="secondary" className="text-xs">
                                <User className="w-3 h-3 mr-1" />
                                {item.responsavel_externo}
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm">{item.titulo}</p>
                          {item.descricao && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.descricao}
                            </p>
                          )}
                          {item.midias_ids && item.midias_ids.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <Film className="w-3 h-3 text-muted-foreground" />
                              <div className="flex flex-wrap gap-1">
                                {item.midias_ids.map(midiaId => (
                                  <Badge key={midiaId} variant="outline" className="text-xs">
                                    {midias.get(midiaId) || "Mídia"}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Escalas */}
            {template.incluir_escalas && escalas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Escalas ({escalas.length} pessoas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {escalas.map((escala, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Badge 
                          style={{ 
                            backgroundColor: escala.time.cor || '#8B5CF6',
                            color: 'white'
                          }}
                        >
                          {escala.time.nome}
                        </Badge>
                        {escala.posicao && (
                          <Badge variant="outline">{escala.posicao.nome}</Badge>
                        )}
                        <span className="font-medium text-sm">{escala.pessoa.nome}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Observações */}
            {template.observacoes_padrao && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {template.observacoes_padrao}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 border-t bg-muted/50 px-4 py-3 md:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Usar Este Template
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
