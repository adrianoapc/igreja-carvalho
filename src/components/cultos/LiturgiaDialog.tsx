import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Clock, User, UserPlus, MessageCircle, Send, Film, ExternalLink, FileText, Video, Image as ImageIcon, GripVertical, Save, Download, Layers } from "lucide-react";
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
import { AplicarTemplateDialog } from "./AplicarTemplateDialog";
import { SalvarComoTemplateDialog } from "./SalvarComoTemplateDialog";
import RecursosLiturgiaSheet from "./RecursosLiturgiaSheet";

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
}

interface Membro {
  id: string;
  nome: string;
}

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  canal: string;
  url: string;
  ativo: boolean;
}

interface ItemLiturgia {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  duracao_minutos: number | null;
  responsavel_id: string | null;
  responsavel_externo: string | null;
  midias_ids: string[] | null;
  responsavel?: {
    nome: string;
    telefone: string | null;
  };
}

interface LiturgiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  culto: Culto | null;
}

const TIPOS_LITURGIA = [
  "Abertura",
  "Louvor",
  "Adoração",
  "Oração",
  "Leitura Bíblica",
  "Pregação",
  "Oferta",
  "Santa Ceia",
  "Anúncios",
  "Encerramento",
  "Outro"
];

// Componente sortable para mídia selecionada
function MidiaSelecionadaItem({ midia, index, onRemove }: { midia: Midia; index: number; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: midia.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isImage = midia.tipo === 'Imagem' || midia.tipo === 'imagem' || midia.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = midia.tipo === 'Vídeo' || midia.tipo === 'video' || midia.url.match(/\.(mp4|webm|ogg)$/i);

  return (
    <Card ref={setNodeRef} style={style} className="border-primary/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing flex items-center flex-shrink-0"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Ordem */}
          <Badge variant="outline" className="text-xs flex-shrink-0">
            #{index + 1}
          </Badge>
          
          {/* Thumbnail */}
          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {isImage ? (
              <img 
                src={midia.url} 
                alt={midia.titulo}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.classList.add('flex', 'items-center', 'justify-center');
                    parent.innerHTML = '<svg class="w-6 h-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                  }
                }}
              />
            ) : isVideo ? (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs truncate">{midia.titulo}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {midia.tipo}
            </Badge>
          </div>
          
          {/* Botão remover */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(midia.id)}
            className="flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiturgiaDialog({ open, onOpenChange, culto }: LiturgiaDialogProps) {
  const [itens, setItens] = useState<ItemLiturgia[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [midiasVinculadas, setMidiasVinculadas] = useState<Map<string, Midia[]>>(new Map());
  const [recursosCount, setRecursosCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<ItemLiturgia | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showMidiasDialog, setShowMidiasDialog] = useState(false);
  const [showAplicarTemplate, setShowAplicarTemplate] = useState(false);
  const [showSalvarTemplate, setShowSalvarTemplate] = useState(false);
  const [showRecursosSheet, setShowRecursosSheet] = useState(false);
  const [itemParaRecursos, setItemParaRecursos] = useState<ItemLiturgia | null>(null);

  // Form state
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState<number | undefined>(undefined);
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [isConvidadoExterno, setIsConvidadoExterno] = useState(false);
  const [nomeConvidadoExterno, setNomeConvidadoExterno] = useState("");
  const [midiasSelecionadas, setMidiasSelecionadas] = useState<string[]>([]);

  const sensorsMidias = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open && culto) {
      loadItens();
      loadMembros();
      loadMidias();
      loadRecursosCount();
    }
  }, [open, culto]);

  const loadRecursosCount = async () => {
    if (!culto) return;
    
    try {
      // Primeiro buscar todos os itens de liturgia deste culto
      const { data: itensData } = await supabase
        .from("liturgia_culto")
        .select("id")
        .eq("culto_id", culto.id);

      if (!itensData || itensData.length === 0) return;

      const itensIds = itensData.map(i => i.id);

      // Buscar contagem de recursos para cada item
      const { data, error } = await supabase
        .from("liturgia_recursos")
        .select("liturgia_item_id")
        .in("liturgia_item_id", itensIds);

      if (error) throw error;

      // Contar recursos por item
      const countMap = new Map<string, number>();
      (data || []).forEach(r => {
        countMap.set(r.liturgia_item_id, (countMap.get(r.liturgia_item_id) || 0) + 1);
      });
      
      setRecursosCount(countMap);
    } catch (error: any) {
      console.error("Erro ao carregar contagem de recursos:", error.message);
    }
  };

  const handleAbrirRecursos = (item: ItemLiturgia) => {
    setItemParaRecursos(item);
    setShowRecursosSheet(true);
  };

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("status", "membro")
        .order("nome", { ascending: true });

      if (error) throw error;
      setMembros(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar membros", {
        description: error.message
      });
    }
  };

  const loadMidias = async () => {
    try {
      // Carregar todas as mídias ativas (não filtrar por culto_id pois são reutilizáveis)
      const { data, error } = await supabase
        .from("midias")
        .select("id, titulo, tipo, canal, url, ativo")
        .eq("ativo", true)
        .order("titulo", { ascending: true });

      if (error) throw error;
      setMidias(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar mídias", {
        description: error.message
      });
    }
  };

  const loadMidiasVinculadas = async (itens: ItemLiturgia[]) => {
    try {
      const idsComMidias = itens
        .filter(item => item.midias_ids && item.midias_ids.length > 0)
        .map(item => item.midias_ids!)
        .flat();

      if (idsComMidias.length === 0) return;

      const { data, error } = await supabase
        .from("midias")
        .select("id, titulo, tipo, canal, url, ativo")
        .in("id", idsComMidias);

      if (error) throw error;

      const midiasMap = new Map<string, Midia[]>();
      itens.forEach(item => {
        if (item.midias_ids && item.midias_ids.length > 0) {
          const midiasDoItem = data?.filter(m => item.midias_ids!.includes(m.id)) || [];
          midiasMap.set(item.id, midiasDoItem);
        }
      });

      setMidiasVinculadas(midiasMap);
    } catch (error: any) {
      console.error("Erro ao carregar mídias vinculadas:", error.message);
    }
  };

  const loadItens = async () => {
    if (!culto) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("liturgia_culto")
        .select(`
          *,
          responsavel:profiles!responsavel_id(nome, telefone)
        `)
        .eq("culto_id", culto.id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      const itensData = data || [];
      setItens(itensData);
      await loadMidiasVinculadas(itensData);
    } catch (error: any) {
      toast.error("Erro ao carregar liturgia", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTipo("");
    setTitulo("");
    setDescricao("");
    setDuracaoMinutos(undefined);
    setResponsavelId("");
    setIsConvidadoExterno(false);
    setNomeConvidadoExterno("");
    setMidiasSelecionadas([]);
    setEditando(null);
    setShowForm(false);
  };

  const handleNovoItem = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditarItem = (item: ItemLiturgia) => {
    setEditando(item);
    setTipo(item.tipo);
    setTitulo(item.titulo);
    setDescricao(item.descricao || "");
    setDuracaoMinutos(item.duracao_minutos || undefined);
    setMidiasSelecionadas(item.midias_ids || []);
    
    // Verificar se é convidado externo ou membro
    if (item.responsavel_externo) {
      setIsConvidadoExterno(true);
      setNomeConvidadoExterno(item.responsavel_externo);
      setResponsavelId("");
    } else {
      setIsConvidadoExterno(false);
      setNomeConvidadoExterno("");
      setResponsavelId(item.responsavel_id || "");
    }
    
    setShowForm(true);
  };

  const handleSalvar = async () => {
    if (!culto || !tipo || !titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    // Validar responsável
    if (isConvidadoExterno && !nomeConvidadoExterno.trim()) {
      toast.error("Informe o nome do convidado externo");
      return;
    }

    setLoading(true);
    try {
      const dadosLiturgia = {
        tipo,
        titulo,
        descricao: descricao || null,
        duracao_minutos: duracaoMinutos || null,
        responsavel_id: isConvidadoExterno ? null : (responsavelId || null),
        responsavel_externo: isConvidadoExterno ? nomeConvidadoExterno.trim() : null,
        midias_ids: midiasSelecionadas.length > 0 ? midiasSelecionadas : null,
      };

      if (editando) {
        // Atualizar item existente
        const { error } = await supabase
          .from("liturgia_culto")
          .update(dadosLiturgia)
          .eq("id", editando.id);

        if (error) throw error;
        toast.success("Item atualizado com sucesso!");
      } else {
        // Criar novo item
        const novaOrdem = itens.length > 0 ? Math.max(...itens.map(i => i.ordem)) + 1 : 1;
        
        const { error } = await supabase
          .from("liturgia_culto")
          .insert([{
            culto_id: culto.id,
            ...dadosLiturgia,
            ordem: novaOrdem,
          }]);

        if (error) throw error;
        toast.success("Item adicionado com sucesso!");
      }

      await loadItens();
      resetForm();
    } catch (error: any) {
      toast.error("Erro ao salvar item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Deseja remover este item da liturgia?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("liturgia_culto")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Item removido com sucesso!");
      await loadItens();
    } catch (error: any) {
      toast.error("Erro ao remover item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarNotificacaoMake = async () => {
    if (!culto) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('notificar-liturgia-make', {
        body: { culto_id: culto.id }
      });

      if (error) throw error;

      toast.success("Notificação enviada via Make.com!");
    } catch (error: any) {
      toast.error("Erro ao enviar notificação", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirWhatsApp = (item: ItemLiturgia) => {
    const telefone = item.responsavel?.telefone?.replace(/\D/g, '');
    const nome = item.responsavel?.nome || item.responsavel_externo;
    
    if (!telefone && !item.responsavel_externo) {
      toast.error("Este responsável não possui telefone cadastrado");
      return;
    }

    const mensagem = `Olá ${nome}! Você foi escalado para a liturgia do culto *${culto?.titulo}* em ${new Date(culto?.data_culto || '').toLocaleDateString('pt-BR')}.

*Sua responsabilidade:*
Tipo: ${item.tipo}
Item: ${item.titulo}
${item.duracao_minutos ? `Duração: ${item.duracao_minutos} minutos` : ''}

Qualquer dúvida, entre em contato conosco.`;

    const url = telefone 
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
  };

  const handleMoverOrdem = async (item: ItemLiturgia, direcao: "up" | "down") => {
    const index = itens.findIndex(i => i.id === item.id);
    if ((direcao === "up" && index === 0) || (direcao === "down" && index === itens.length - 1)) {
      return;
    }

    const novoIndex = direcao === "up" ? index - 1 : index + 1;
    const outroItem = itens[novoIndex];

    setLoading(true);
    try {
      // Trocar as ordens
      const { error: error1 } = await supabase
        .from("liturgia_culto")
        .update({ ordem: outroItem.ordem })
        .eq("id", item.id);

      const { error: error2 } = await supabase
        .from("liturgia_culto")
        .update({ ordem: item.ordem })
        .eq("id", outroItem.id);

      if (error1 || error2) throw error1 || error2;
      await loadItens();
    } catch (error: any) {
      toast.error("Erro ao reordenar item", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEndMidias = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setMidiasSelecionadas((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleMidiaSelecao = (midiaId: string) => {
    setMidiasSelecionadas(prev =>
      prev.includes(midiaId)
        ? prev.filter(id => id !== midiaId)
        : [...prev, midiaId]
    );
  };

  const removerMidiaSelecionada = (midiaId: string) => {
    setMidiasSelecionadas(prev => prev.filter(id => id !== midiaId));
  };

  const duracaoTotal = itens.reduce((sum, item) => sum + (item.duracao_minutos || 0), 0);

  if (!culto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Liturgia - {culto.titulo}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnviarNotificacaoMake}
              disabled={loading}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar via Make
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Duração Total:</span>
              <Badge variant="outline">{duracaoTotal} min</Badge>
            </div>
            <Button size="sm" onClick={handleNovoItem} disabled={loading || showForm}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          {/* Formulário de adicionar/editar */}
          {showForm && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_LITURGIA.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duração (min)</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={duracaoMinutos || ""}
                      onChange={(e) => setDuracaoMinutos(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Título *</Label>
                  <Input
                    placeholder="Ex: Momento de Adoração"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Responsável</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="convidado-externo"
                        checked={isConvidadoExterno}
                        onCheckedChange={(checked) => {
                          setIsConvidadoExterno(checked as boolean);
                          if (checked) {
                            setResponsavelId("");
                          } else {
                            setNomeConvidadoExterno("");
                          }
                        }}
                      />
                      <label
                        htmlFor="convidado-externo"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Convidado externo
                      </label>
                    </div>
                  </div>
                  
                  {isConvidadoExterno ? (
                    <Input
                      placeholder="Nome do convidado externo"
                      value={nomeConvidadoExterno}
                      onChange={(e) => setNomeConvidadoExterno(e.target.value)}
                    />
                  ) : (
                    <Select value={responsavelId || "none"} onValueChange={(value) => setResponsavelId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {membros.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Detalhes adicionais..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Mídias Relacionadas</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMidiasDialog(true)}
                      disabled={midias.length === 0}
                    >
                      <Film className="w-4 h-4 mr-2" />
                      Selecionar Mídias
                    </Button>
                  </div>
                  {midiasSelecionadas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {midias
                        .filter(m => midiasSelecionadas.includes(m.id))
                        .map(midia => (
                          <Badge key={midia.id} variant="secondary" className="text-xs">
                            {midia.titulo}
                          </Badge>
                        ))}
                    </div>
                  )}
                  {midias.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma mídia cadastrada para este culto
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSalvar} disabled={loading}>
                    {loading ? "Salvando..." : editando ? "Atualizar" : "Adicionar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botões de Template */}
          {!showForm && itens.length > 0 && (
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAplicarTemplate(true)}
              >
                <Download className="w-4 h-4 mr-2" />
                Aplicar Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSalvarTemplate(true)}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar como Template
              </Button>
            </div>
          )}

          {/* Lista de itens */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {itens.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum item adicionado. Comece criando a liturgia do culto.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                itens.map((item, index) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {item.tipo}
                            </Badge>
                            {item.duracao_minutos && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {item.duracao_minutos} min
                              </Badge>
                            )}
                            {item.responsavel_externo ? (
                              <Badge variant="secondary" className="text-xs">
                                <UserPlus className="w-3 h-3 mr-1" />
                                {item.responsavel_externo}
                              </Badge>
                            ) : item.responsavel ? (
                              <Badge variant="secondary" className="text-xs">
                                <User className="w-3 h-3 mr-1" />
                                {item.responsavel.nome}
                              </Badge>
                            ) : null}
                            {recursosCount.get(item.id) ? (
                              <Badge 
                                variant="default" 
                                className="text-xs cursor-pointer hover:bg-primary/80"
                                onClick={() => handleAbrirRecursos(item)}
                              >
                                <Layers className="w-3 h-3 mr-1" />
                                {recursosCount.get(item.id)} slides
                              </Badge>
                            ) : null}
                          </div>
                          <h4 className="font-medium text-sm">{item.titulo}</h4>
                           {item.descricao && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.descricao}
                            </p>
                          )}
                          
                          {/* Mídias vinculadas */}
                          {midiasVinculadas.has(item.id) && midiasVinculadas.get(item.id)!.length > 0 && (
                            <div className="mt-3">
                              {item.tipo === "Anúncios" ? (
                                // Visualização expandida em galeria para Anúncios
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Film className="w-4 h-4 text-primary" />
                                    <span>Mídias de Anúncios ({midiasVinculadas.get(item.id)!.length})</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {midiasVinculadas.get(item.id)!.map(midia => {
                                      const isImage = midia.tipo === 'Imagem' || midia.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                      const isVideo = midia.tipo === 'Vídeo' || midia.url.match(/\.(mp4|webm|ogg|youtube|vimeo)$/i);
                                      
                                      return (
                                        <Card 
                                          key={midia.id}
                                          className="group cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                                          onClick={() => window.open(midia.url, '_blank')}
                                        >
                                          <CardContent className="p-0">
                                            {/* Thumbnail */}
                                            <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
                                              {isImage ? (
                                                <img 
                                                  src={midia.url} 
                                                  alt={midia.titulo}
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                                                    const icon = document.createElement('div');
                                                    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                                    e.currentTarget.parentElement!.appendChild(icon);
                                                  }}
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                  {isVideo ? (
                                                    <Video className="w-8 h-8 text-muted-foreground" />
                                                  ) : (
                                                    <FileText className="w-8 h-8 text-muted-foreground" />
                                                  )}
                                                </div>
                                              )}
                                              
                                              {/* Overlay com ícone de link */}
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                              </div>
                                              
                                              {/* Badge de tipo */}
                                              <div className="absolute top-2 right-2">
                                                <Badge variant="secondary" className="text-xs">
                                                  {midia.tipo}
                                                </Badge>
                                              </div>
                                            </div>
                                            
                                            {/* Título */}
                                            <div className="p-2">
                                              <p className="text-xs font-medium line-clamp-2 text-center">
                                                {midia.titulo}
                                              </p>
                                              <p className="text-xs text-muted-foreground text-center mt-1">
                                                {midia.canal}
                                              </p>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                // Visualização compacta em badges para outros tipos
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Film className="w-3 h-3" />
                                    <span>Mídias:</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {midiasVinculadas.get(item.id)!.map(midia => (
                                      <Badge
                                        key={midia.id}
                                        variant="outline"
                                        className="text-xs cursor-pointer hover:bg-accent"
                                        onClick={() => window.open(midia.url, '_blank')}
                                      >
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        {midia.titulo}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(item, "up")}
                            disabled={loading || index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoverOrdem(item, "down")}
                            disabled={loading || index === itens.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirWhatsApp(item)}
                            disabled={loading}
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirRecursos(item)}
                            disabled={loading}
                            title="Gerenciar Slides"
                          >
                            <Layers className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditarItem(item)}
                            disabled={loading || showForm}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemover(item.id)}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Dialog de seleção de mídias */}
        <Dialog open={showMidiasDialog} onOpenChange={setShowMidiasDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Selecionar Mídias</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Lista de mídias disponíveis */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mídias Disponíveis</Label>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {midias.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma mídia disponível
                      </p>
                    ) : (
                      midias.map(midia => {
                        const isSelected = midiasSelecionadas.includes(midia.id);
                        const isImage = midia.tipo === 'Imagem' || midia.tipo === 'imagem' || midia.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                        const isVideo = midia.tipo === 'Vídeo' || midia.tipo === 'video' || midia.url.match(/\.(mp4|webm|ogg)$/i);
                        
                        return (
                          <Card
                            key={midia.id}
                            className={`cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-accent ring-2 ring-primary/20'
                                : 'hover:bg-accent/50'
                            }`}
                            onClick={() => toggleMidiaSelecao(midia.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                {/* Thumbnail */}
                                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                  {isImage ? (
                                    <img 
                                      src={midia.url} 
                                      alt={midia.titulo}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const parent = e.currentTarget.parentElement;
                                        if (parent) {
                                          parent.classList.add('flex', 'items-center', 'justify-center');
                                          parent.innerHTML = '<svg class="w-8 h-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                        }
                                      }}
                                    />
                                  ) : isVideo ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Video className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <FileText className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{midia.titulo}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {midia.tipo}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {midia.canal}
                                    </Badge>
                                  </div>
                                </div>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => {}}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Mídias selecionadas com drag and drop */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Mídias Selecionadas ({midiasSelecionadas.length})
                </Label>
                <ScrollArea className="h-[400px] pr-4">
                  {midiasSelecionadas.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma mídia selecionada
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensorsMidias}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndMidias}
                    >
                      <SortableContext
                        items={midiasSelecionadas}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {midiasSelecionadas.map((midiaId, index) => {
                            const midia = midias.find(m => m.id === midiaId);
                            if (!midia) return null;
                            
                            return <MidiaSelecionadaItem key={midiaId} midia={midia} index={index} onRemove={removerMidiaSelecionada} />;
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </ScrollArea>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowMidiasDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setShowMidiasDialog(false)}>
                Confirmar ({midiasSelecionadas.length})
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogos de Template */}
        {culto && (
          <>
            <AplicarTemplateDialog
              open={showAplicarTemplate}
              onOpenChange={setShowAplicarTemplate}
              cultoId={culto.id}
              onSuccess={loadItens}
            />
            <SalvarComoTemplateDialog
              open={showSalvarTemplate}
              onOpenChange={setShowSalvarTemplate}
              cultoId={culto.id}
            />
          </>
        )}

        {/* Editor de Recursos */}
        <RecursosLiturgiaSheet
          open={showRecursosSheet}
          onOpenChange={setShowRecursosSheet}
          item={itemParaRecursos}
          onResourcesUpdate={loadRecursosCount}
        />
      </DialogContent>
    </Dialog>
  );
}
