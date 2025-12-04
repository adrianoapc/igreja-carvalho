import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface EtapaContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapa: {
    id?: string;
    titulo: string;
    tipo_conteudo?: string | null;
    conteudo_url?: string | null;
    conteudo_texto?: string | null;
  } | null;
  jornadaId: string;
  onSuccess: () => void;
}

const TIPOS_CONTEUDO = [
  { value: "video", label: "Vídeo (YouTube/Vimeo)", icon: Play },
  { value: "texto", label: "Leitura (Texto)", icon: FileText },
  { value: "presencial", label: "Aula Presencial", icon: Users },
];

export default function EtapaContentDialog({
  open,
  onOpenChange,
  etapa,
  jornadaId,
  onSuccess,
}: EtapaContentDialogProps) {
  const queryClient = useQueryClient();
  const [tipoConteudo, setTipoConteudo] = useState<string>("video");
  const [conteudoUrl, setConteudoUrl] = useState("");
  const [conteudoTexto, setConteudoTexto] = useState("");

  useEffect(() => {
    if (open && etapa) {
      setTipoConteudo(etapa.tipo_conteudo || "video");
      setConteudoUrl(etapa.conteudo_url || "");
      setConteudoTexto(etapa.conteudo_texto || "");
    }
  }, [open, etapa]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!etapa?.id) throw new Error("Etapa não encontrada");

      const { error } = await supabase
        .from("etapas_jornada")
        .update({
          tipo_conteudo: tipoConteudo,
          conteudo_url: tipoConteudo === "video" ? conteudoUrl : null,
          conteudo_texto: tipoConteudo === "texto" ? conteudoTexto : null,
        })
        .eq("id", etapa.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo salvo!");
      queryClient.invalidateQueries({ queryKey: ["etapas-jornada-edit", jornadaId] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating etapa content:", error);
      toast.error("Erro ao salvar conteúdo");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tipoConteudo === "video" && !conteudoUrl.trim()) {
      toast.error("Informe a URL do vídeo");
      return;
    }
    
    if (tipoConteudo === "texto" && !conteudoTexto.trim()) {
      toast.error("Informe o conteúdo do texto");
      return;
    }

    updateMutation.mutate();
  };

  const TipoIcon = TIPOS_CONTEUDO.find((t) => t.value === tipoConteudo)?.icon || FileText;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TipoIcon className="w-5 h-5" />
            Configurar Conteúdo
          </SheetTitle>
          <SheetDescription>
            {etapa?.titulo}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Tipo de Conteúdo */}
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Select value={tipoConteudo} onValueChange={setTipoConteudo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CONTEUDO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    <div className="flex items-center gap-2">
                      <tipo.icon className="w-4 h-4" />
                      {tipo.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos Condicionais */}
          {tipoConteudo === "video" && (
            <div className="space-y-2">
              <Label htmlFor="video-url">URL do Vídeo</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={conteudoUrl}
                onChange={(e) => setConteudoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cole o link do YouTube, Vimeo ou outra plataforma de vídeo
              </p>
            </div>
          )}

          {tipoConteudo === "texto" && (
            <div className="space-y-2">
              <Label htmlFor="texto-conteudo">Conteúdo da Leitura</Label>
              <Textarea
                id="texto-conteudo"
                placeholder="Digite o conteúdo da aula aqui..."
                value={conteudoTexto}
                onChange={(e) => setConteudoTexto(e.target.value)}
                rows={12}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Você pode usar formatação básica com Markdown
              </p>
            </div>
          )}

          {tipoConteudo === "presencial" && (
            <Alert>
              <Users className="w-4 h-4" />
              <AlertDescription>
                Esta etapa será vinculada a um check-in físico. O aluno precisará
                comparecer presencialmente para marcar como concluído.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview do Vídeo */}
          {tipoConteudo === "video" && conteudoUrl && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {conteudoUrl.includes("youtube.com") || conteudoUrl.includes("youtu.be") ? (
                  <iframe
                    src={getYouTubeEmbedUrl(conteudoUrl)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : conteudoUrl.includes("vimeo.com") ? (
                  <iframe
                    src={getVimeoEmbedUrl(conteudoUrl)}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Preview não disponível para esta URL
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Conteúdo"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[7].length === 11 ? match[7] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}

function getVimeoEmbedUrl(url: string): string {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);
  const videoId = match ? match[1] : null;
  return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
}
