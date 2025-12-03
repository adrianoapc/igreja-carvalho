import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Save, 
  Trash2, 
  Plus, 
  GripVertical, 
  Clock, 
  Search,
  Film,
  Image as ImageIcon,
  Video,
  FileText,
  Play
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SlideshowPreview from "./SlideshowPreview";

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  duracao_minutos: number | null;
  responsavel_id: string | null;
  responsavel_externo: string | null;
  permite_multiplo?: boolean;
}

interface Membro {
  id: string;
  nome: string;
}

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  url: string;
  descricao?: string;
}

interface RecursoLiturgia {
  id: string;
  liturgia_item_id: string;
  midia_id: string;
  ordem: number;
  duracao_segundos: number;
  midia?: Midia;
}

interface LiturgiaWorkspaceProps {
  item: ItemLiturgia | null;
  membros: Membro[];
  onSave: () => void;
  onDelete: (id: string) => void;
}

const TIPOS_LITURGIA = [
  "Abertura", "Louvor", "Adoração", "Oração", "Leitura Bíblica",
  "Pregação", "Oferta", "Santa Ceia", "Anúncios", "Encerramento", "Outro"
];

const TIPOS_MULTIPLOS = ["Anúncios", "Avisos", "Outro", "anúncios", "avisos", "comunicados"];

// Sortable Recurso Card
function SortableRecursoCard({ 
  recurso, 
  onRemove,
  onDurationChange 
}: { 
  recurso: RecursoLiturgia; 
  onRemove: (id: string) => void;
  onDurationChange: (id: string, duration: number) => void;
}) {
  const [editingDuration, setEditingDuration] = useState(false);
  const [tempDuration, setTempDuration] = useState(recurso.duracao_segundos.toString());

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recurso.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const midia = recurso.midia;
  if (!midia) return null;

  const isImage = midia.tipo?.toLowerCase() === 'imagem' || midia.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = midia.tipo?.toLowerCase() === 'vídeo' || midia.url?.match(/\.(mp4|webm|ogg)$/i);

  const handleDurationSave = () => {
    const newDuration = parseInt(tempDuration) || 10;
    onDurationChange(recurso.id, Math.max(1, Math.min(300, newDuration)));
    setEditingDuration(false);
  };

  return (
    <Card ref={setNodeRef} style={style} className="border-primary/30 bg-primary/5">
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <Badge variant="outline" className="text-xs shrink-0">#{recurso.ordem}</Badge>
          
          <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
            {isImage ? (
              <img src={midia.url} alt={midia.titulo} className="w-full h-full object-cover" />
            ) : isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{midia.titulo}</p>
            {editingDuration ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={tempDuration}
                  onChange={(e) => setTempDuration(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDurationSave();
                    if (e.key === 'Escape') setEditingDuration(false);
                  }}
                  onBlur={handleDurationSave}
                  autoFocus
                  className="h-5 w-14 text-xs px-1"
                />
                <span className="text-xs text-muted-foreground">s</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempDuration(recurso.duracao_segundos.toString());
                  setEditingDuration(true);
                }}
                className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock className="w-3 h-3" />
                {recurso.duracao_segundos}s
              </button>
            )}
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(recurso.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiturgiaWorkspace({ item, membros, onSave, onDelete }: LiturgiaWorkspaceProps) {
  // Form state
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState("");
  const [isConvidadoExterno, setIsConvidadoExterno] = useState(false);
  const [nomeConvidadoExterno, setNomeConvidadoExterno] = useState("");
  const [saving, setSaving] = useState(false);

  // Resources state
  const [midias, setMidias] = useState<Midia[]>([]);
  const [recursos, setRecursos] = useState<RecursoLiturgia[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const permiteMultiplo = item 
    ? (item.permite_multiplo ?? TIPOS_MULTIPLOS.includes(item.tipo?.toLowerCase() || ''))
    : false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load item data
  useEffect(() => {
    if (item) {
      setTipo(item.tipo);
      setTitulo(item.titulo);
      setDescricao(item.descricao || "");
      setDuracaoMinutos(item.duracao_minutos?.toString() || "");
      
      if (item.responsavel_externo) {
        setIsConvidadoExterno(true);
        setNomeConvidadoExterno(item.responsavel_externo);
        setResponsavelId("");
      } else {
        setIsConvidadoExterno(false);
        setNomeConvidadoExterno("");
        setResponsavelId(item.responsavel_id || "");
      }
      
      loadMidias();
      loadRecursos();
    }
  }, [item?.id]);

  const loadMidias = async () => {
    const { data, error } = await supabase
      .from("midias")
      .select("id, titulo, tipo, url, descricao")
      .eq("ativo", true)
      .order("titulo", { ascending: true });

    if (!error) setMidias(data || []);
  };

  const loadRecursos = async () => {
    if (!item) return;
    
    const { data, error } = await supabase
      .from("liturgia_recursos")
      .select(`
        id, liturgia_item_id, midia_id, ordem, duracao_segundos,
        midia:midias(id, titulo, tipo, url, descricao)
      `)
      .eq("liturgia_item_id", item.id)
      .order("ordem", { ascending: true });

    if (!error) {
      const recursosFormatados = (data || []).map(r => ({
        ...r,
        midia: Array.isArray(r.midia) ? r.midia[0] : r.midia
      }));
      setRecursos(recursosFormatados);
    }
  };

  const handleSaveItem = async () => {
    if (!item || !tipo || !titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("liturgia_culto")
        .update({
          tipo,
          titulo,
          descricao: descricao || null,
          duracao_minutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
          responsavel_id: isConvidadoExterno ? null : (responsavelId || null),
          responsavel_externo: isConvidadoExterno ? nomeConvidadoExterno.trim() : null,
        })
        .eq("id", item.id);

      if (error) throw error;
      toast.success("Item atualizado!");
      onSave();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMidia = async (midia: Midia) => {
    if (!item) return;

    try {
      if (!permiteMultiplo && recursos.length > 0) {
        await supabase.from("liturgia_recursos").delete().eq("liturgia_item_id", item.id);
      }

      const novaOrdem = permiteMultiplo && recursos.length > 0 
        ? Math.max(...recursos.map(r => r.ordem)) + 1 
        : 1;

      const { error } = await supabase
        .from("liturgia_recursos")
        .insert({
          liturgia_item_id: item.id,
          midia_id: midia.id,
          ordem: novaOrdem,
          duracao_segundos: 10,
        });

      if (error) throw error;
      toast.success(permiteMultiplo ? "Mídia adicionada!" : "Mídia substituída!");
      await loadRecursos();
      onSave();
    } catch (error: any) {
      toast.error("Erro ao adicionar mídia", { description: error.message });
    }
  };

  const handleRemoveMidia = async (recursoId: string) => {
    try {
      const { error } = await supabase
        .from("liturgia_recursos")
        .delete()
        .eq("id", recursoId);

      if (error) throw error;
      toast.success("Mídia removida!");
      await loadRecursos();
      onSave();
    } catch (error: any) {
      toast.error("Erro ao remover mídia", { description: error.message });
    }
  };

  const handleDurationChange = async (recursoId: string, newDuration: number) => {
    setRecursos(prev => prev.map(r => 
      r.id === recursoId ? { ...r, duracao_segundos: newDuration } : r
    ));

    try {
      await supabase
        .from("liturgia_recursos")
        .update({ duracao_segundos: newDuration })
        .eq("id", recursoId);
    } catch (error: any) {
      toast.error("Erro ao atualizar duração");
      await loadRecursos();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = recursos.findIndex(r => r.id === active.id);
    const newIndex = recursos.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newRecursos = arrayMove(recursos, oldIndex, newIndex);
    setRecursos(newRecursos);

    try {
      for (let i = 0; i < newRecursos.length; i++) {
        await supabase
          .from("liturgia_recursos")
          .update({ ordem: i + 1 })
          .eq("id", newRecursos[i].id);
      }
      onSave();
    } catch (error: any) {
      toast.error("Erro ao reordenar");
      await loadRecursos();
    }
  };

  const filteredMidias = midias.filter(m => 
    m.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const midiasSelecionadasIds = new Set(recursos.map(r => r.midia_id));
  const showMediaEditor = item && (permiteMultiplo || TIPOS_MULTIPLOS.some(t => item.tipo.toLowerCase().includes(t.toLowerCase())));

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Selecione um item na timeline</p>
          <p className="text-xs mt-1">para editar seus detalhes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Editando: {item.titulo}</h3>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir
          </Button>
          <Button size="sm" onClick={handleSaveItem} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            Salvar
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {showMediaEditor ? (
          // Split View: Form + Media Editor
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Form Column */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Detalhes do Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_LITURGIA.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duração (min)</Label>
                    <Input
                      type="number"
                      value={duracaoMinutos}
                      onChange={(e) => setDuracaoMinutos(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea 
                    value={descricao} 
                    onChange={(e) => setDescricao(e.target.value)} 
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="convidado"
                    checked={isConvidadoExterno}
                    onCheckedChange={(checked) => setIsConvidadoExterno(!!checked)}
                  />
                  <Label htmlFor="convidado" className="text-xs">Convidado externo</Label>
                </div>

                {isConvidadoExterno ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Convidado</Label>
                    <Input
                      value={nomeConvidadoExterno}
                      onChange={(e) => setNomeConvidadoExterno(e.target.value)}
                      className="h-9"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Responsável</Label>
                    <Select value={responsavelId} onValueChange={setResponsavelId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {membros.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Media Editor Column */}
            <div className="space-y-4">
              {/* Playlist */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Film className="w-4 h-4" />
                      Playlist ({recursos.length})
                    </CardTitle>
                    {recursos.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                        <Play className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={recursos.map(r => r.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {recursos.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Arraste mídias do acervo abaixo
                          </p>
                        ) : (
                          recursos.map(recurso => (
                            <SortableRecursoCard
                              key={recurso.id}
                              recurso={recurso}
                              onRemove={handleRemoveMidia}
                              onDurationChange={handleDurationChange}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>

              {/* Acervo */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Acervo de Mídias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-3">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filteredMidias.map(midia => {
                      const isSelected = midiasSelecionadasIds.has(midia.id);
                      const isImage = midia.tipo?.toLowerCase() === 'imagem' || midia.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      
                      return (
                        <Card 
                          key={midia.id}
                          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${isSelected ? 'opacity-50' : ''}`}
                          onClick={() => !isSelected && handleAddMidia(midia)}
                        >
                          <CardContent className="p-2">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
                                {isImage ? (
                                  <img src={midia.url} alt={midia.titulo} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Video className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{midia.titulo}</p>
                                <Badge variant="secondary" className="text-xs mt-0.5">{midia.tipo}</Badge>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isSelected}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Simple Form (no media)
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_LITURGIA.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea 
                  value={descricao} 
                  onChange={(e) => setDescricao(e.target.value)} 
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="convidado-simple"
                  checked={isConvidadoExterno}
                  onCheckedChange={(checked) => setIsConvidadoExterno(!!checked)}
                />
                <Label htmlFor="convidado-simple">Convidado externo</Label>
              </div>

              {isConvidadoExterno ? (
                <div className="space-y-2">
                  <Label>Nome do Convidado</Label>
                  <Input
                    value={nomeConvidadoExterno}
                    onChange={(e) => setNomeConvidadoExterno(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select value={responsavelId} onValueChange={setResponsavelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {membros.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </ScrollArea>

      {/* Preview Dialog */}
      <SlideshowPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        recursos={recursos}
        titulo={item?.titulo || "Preview"}
      />
    </div>
  );
}
