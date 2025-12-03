import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, Image as ImageIcon, Video, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Midia {
  id: string;
  titulo: string;
  url: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
  tags?: { tag_id: string; tags_midias: { nome: string } }[];
}

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (midia: Midia) => void;
  selectedId?: string | null;
  tipoFiltro?: "imagem" | "video" | null;
}

export function MediaPickerDialog({ 
  open, 
  onOpenChange, 
  onSelect, 
  selectedId,
  tipoFiltro 
}: MediaPickerDialogProps) {
  const [midias, setMidias] = useState<Midia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadMidias();
    }
  }, [open]);

  const loadMidias = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("midias")
        .select(`
          id, titulo, url, tipo, descricao, created_at,
          midia_tags(tag_id, tags_midias(nome))
        `)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (tipoFiltro) {
        query = query.eq("tipo", tipoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMidias(data || []);
    } catch (error) {
      console.error("Erro ao carregar mídias:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMidias = midias.filter(m => {
    const searchLower = searchTerm.toLowerCase();
    const matchTitle = m.titulo.toLowerCase().includes(searchLower);
    const matchDesc = m.descricao?.toLowerCase().includes(searchLower);
    const matchTags = m.tags?.some(t => 
      t.tags_midias?.nome?.toLowerCase().includes(searchLower)
    );
    return matchTitle || matchDesc || matchTags;
  });

  const getMediaIcon = (tipo: string) => {
    if (tipo === "video") return Video;
    if (tipo === "imagem") return ImageIcon;
    return FileText;
  };

  const handleSelect = (midia: Midia) => {
    onSelect(midia);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Selecionar Mídia do Acervo</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou tag..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Grid de Mídias */}
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredMidias.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="text-muted-foreground">Nenhuma mídia encontrada</p>
              <p className="text-xs text-muted-foreground">
                Acesse /midias para adicionar novas mídias ao acervo
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredMidias.map(midia => {
                const Icon = getMediaIcon(midia.tipo);
                const isSelected = selectedId === midia.id;
                
                return (
                  <button
                    key={midia.id}
                    onClick={() => handleSelect(midia)}
                    className={cn(
                      "group relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:ring-2 hover:ring-primary/50",
                      isSelected 
                        ? "border-primary ring-2 ring-primary" 
                        : "border-transparent"
                    )}
                  >
                    {midia.tipo === "video" ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Video className="h-10 w-10 text-muted-foreground" />
                      </div>
                    ) : (
                      <img
                        src={midia.url}
                        alt={midia.titulo}
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Overlay */}
                    <div className={cn(
                      "absolute inset-0 bg-black/60 flex flex-col justify-end p-2 transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <p className="text-white text-xs font-medium truncate">
                        {midia.titulo}
                      </p>
                      {midia.tags && midia.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {midia.tags.slice(0, 2).map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                              {t.tags_midias?.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            {filteredMidias.length} mídia{filteredMidias.length !== 1 ? "s" : ""} disponíve{filteredMidias.length !== 1 ? "is" : "l"}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
