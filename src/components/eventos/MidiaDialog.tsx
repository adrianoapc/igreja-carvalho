import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2, Calendar as CalendarIcon, Clock, Tag, Plus, Eye, Settings } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TagMidiaDialog } from "./TagMidiaDialog";
import { ImageCaptureInput } from "@/components/ui/image-capture-input";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

interface Tag {
  id: string;
  nome: string;
  cor: string;
}

interface MidiaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  midia?: {
    id: string;
    titulo: string;
    descricao?: string;
    tipo: string;
    url: string;
    canal: string;
    ordem: number;
    ativo: boolean;
    evento_id?: string;
    scheduled_at?: string | null;
    expires_at?: string | null;
  };
  onSuccess: () => void;
}

export function MidiaDialog({ open, onOpenChange, midia, onSuccess }: MidiaDialogProps) {
  const [titulo, setTitulo] = useState(midia?.titulo || "");
  const [descricao, setDescricao] = useState(midia?.descricao || "");
  const [tipo, setTipo] = useState(midia?.tipo || "imagem");
  const [canal, setCanal] = useState(midia?.canal || "telao");
  const [ativo, setAtivo] = useState(midia?.ativo ?? true);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(midia?.url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(
    midia?.scheduled_at ? new Date(midia.scheduled_at) : undefined
  );
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(
    midia?.expires_at ? new Date(midia.expires_at) : undefined
  );
  
  // Tags
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();
  
  // Sincronizar dados quando midia mudar
  useEffect(() => {
    if (open && midia) {
      setTitulo(midia.titulo || "");
      setDescricao(midia.descricao || "");
      setTipo(midia.tipo || "imagem");
      setCanal(midia.canal || "telao");
      setAtivo(midia.ativo ?? true);
      setPreviewUrl(midia.url || "");
      setScheduledAt(midia.scheduled_at ? new Date(midia.scheduled_at) : undefined);
      setExpiresAt(midia.expires_at ? new Date(midia.expires_at) : undefined);
      setArquivo(null);
    } else if (open && !midia) {
      // Resetar para nova mídia
      resetForm();
    }
  }, [open, midia]);
  
  useEffect(() => {
    if (open) {
      loadTags();
      if (midia?.id) {
        loadTagsMidia();
      } else {
        setTagsSelecionadas([]);
      }
    }
  }, [open, midia?.id, igrejaId]);
  
  const loadTags = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from('tags_midias')
        .select('*')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId)
        .order('nome', { ascending: true });
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      setTags(data || []);
    } catch (error: unknown) {
      console.error('Erro ao carregar tags:', error);
    }
  };
  
  const loadTagsMidia = async () => {
    if (!midia?.id || !igrejaId) return;
    
    try {
      let query = supabase
        .from('midia_tags')
        .select('tag_id')
        .eq('midia_id', midia.id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      setTagsSelecionadas(data?.map(t => t.tag_id) || []);
    } catch (error: unknown) {
      console.error('Erro ao carregar tags da mídia:', error);
    }
  };

  const handleArquivoChange = (file: File) => {
    setArquivo(file);

    // Detectar tipo automaticamente
    if (file.type.startsWith('image/')) {
      setTipo('imagem');
      // Criar preview para imagens
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setTipo('video');
      setPreviewUrl(URL.createObjectURL(file));
    } else if (file.type === 'application/pdf') {
      setTipo('documento');
      setPreviewUrl('');
    }
  };

  const handleRemoverArquivo = () => {
    setArquivo(null);
    setPreviewUrl(midia?.url || "");
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    // Validar datas
    if (scheduledAt && expiresAt && expiresAt <= scheduledAt) {
      toast.error("A data de expiração deve ser posterior à data de publicação");
      return;
    }

    setSaving(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      let urlFinal = midia?.url || "";

      // Upload do arquivo se houver
      if (arquivo) {
        setUploading(true);
        const fileExt = arquivo.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${canal}/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('midias')
          .upload(filePath, arquivo, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('midias')
          .getPublicUrl(filePath);

        urlFinal = publicUrl;

        // Deletar arquivo antigo se estiver editando
        // RLS policies on storage bucket enforce ownership
        if (midia?.url) {
          const oldPath = midia.url.split('/midias/')[1];
          // Validate path to prevent path traversal
          if (oldPath && !oldPath.includes('..') && !oldPath.startsWith('/')) {
            try {
              await supabase.storage.from('midias').remove([oldPath]);
            } catch (e) {
              // Ignore deletion errors - file may not exist or user may not have permission
              console.warn('Could not delete old file:', e);
            }
          }
        }

        setUploading(false);
      }

      if (!urlFinal && !midia) {
        toast.error("Selecione um arquivo");
        setSaving(false);
        return;
      }

      // Salvar no banco
      let midiaId = midia?.id;
      
      if (midia) {
        // Editar
        let updateQuery = supabase
          .from('midias')
          .update({
            titulo,
            descricao,
            tipo,
            canal,
            ativo,
            url: urlFinal,
            scheduled_at: scheduledAt?.toISOString() || null,
            expires_at: expiresAt?.toISOString() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', midia.id)
          .eq('igreja_id', igrejaId);
        if (!isAllFiliais && filialId) {
          updateQuery = updateQuery.eq('filial_id', filialId);
        }
        const { error } = await updateQuery;

        if (error) throw error;
        
        // Atualizar tags
        await atualizarTags(midia.id);
        
        const successMessage = scheduledAt 
          ? `Mídia atualizada! Será publicada em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
          : "Mídia atualizada com sucesso!";
        
        toast.success(successMessage);
      } else {
        // Obter próxima ordem
        let maxOrdemQuery = supabase
          .from('midias')
          .select('ordem')
          .eq('canal', canal)
          .eq('igreja_id', igrejaId)
          .order('ordem', { ascending: false })
          .limit(1);
        if (!isAllFiliais && filialId) {
          maxOrdemQuery = maxOrdemQuery.eq('filial_id', filialId);
        }
        const { data: maxOrdem } = await maxOrdemQuery.single();

        const novaOrdem = (maxOrdem?.ordem || 0) + 1;

        // Criar
        const { data: novaMidia, error } = await supabase
          .from('midias')
          .insert({
            titulo,
            descricao,
            tipo,
            url: urlFinal,
            canal,
            ordem: novaOrdem,
            ativo,
            evento_id: null,
            scheduled_at: scheduledAt?.toISOString() || null,
            expires_at: expiresAt?.toISOString() || null,
            igreja_id: igrejaId,
            filial_id: !isAllFiliais ? filialId : null,
          })
          .select()
          .single();

        if (error) throw error;
        midiaId = novaMidia.id;
        
        // Sugerir tags automaticamente se não houver tags selecionadas
        let tagsFinais = tagsSelecionadas;
        if (tagsSelecionadas.length === 0) {
          const tagsSugeridas = sugerirTagsPorTipoCanal(tipo, canal);
          if (tagsSugeridas.length > 0) {
            tagsFinais = tagsSugeridas;
            setTagsSelecionadas(tagsSugeridas);
            const nomesTags = tagsSugeridas
              .map(id => tags.find(t => t.id === id)?.nome)
              .filter(Boolean)
              .join(', ');
            toast.info("Tags sugeridas aplicadas!", {
              description: nomesTags,
            });
          }
        }
        
        // Adicionar tags (incluindo as sugeridas)
        await atualizarTags(midiaId);
        
        const successMessage = scheduledAt 
          ? `Mídia adicionada! Será publicada em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
          : "Mídia adicionada com sucesso!";
        
        toast.success(successMessage);
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      console.error('Erro ao salvar mídia:', error);
      toast.error(error instanceof Error ? error.message : String(error) || "Erro ao salvar mídia");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const atualizarTags = async (midiaId: string) => {
    if (!igrejaId) return;
    // Remover todas as tags atuais
    let deleteQuery = supabase
      .from('midia_tags')
      .delete()
      .eq('midia_id', midiaId)
      .eq('igreja_id', igrejaId);
    if (!isAllFiliais && filialId) {
      deleteQuery = deleteQuery.eq('filial_id', filialId);
    }
    await deleteQuery;
    
    // Adicionar novas tags
    if (tagsSelecionadas.length > 0) {
      const tagsData = tagsSelecionadas.map(tagId => ({
        midia_id: midiaId,
        tag_id: tagId,
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId : null,
      }));
      
      await supabase
        .from('midia_tags')
        .insert(tagsData);
    }
  };

  // Função para sugerir tags automaticamente baseada em tipo e canal
  const sugerirTagsPorTipoCanal = (tipoMidia: string, canalMidia: string): string[] => {
    const sugestoes: string[] = [];
    
    // Mapeamento de tipos de mídia para nomes de tags
    const mapaTipoParaTag: Record<string, string[]> = {
      "imagem": ["Abertura", "Louvor", "Adoração", "Anúncio"],
      "video": ["Pregação", "Testemunho", "Evento Especial"],
      "documento": ["Pregação", "Ensino", "Leitura Bíblica"],
    };

    // Mapeamento de canais para tags
    const mapaCanalParaTag: Record<string, string[]> = {
      "telao": ["Abertura", "Louvor", "Adoração", "Pregação"],
      "app": ["Anúncio", "Evento Especial"],
      "redes_sociais": ["Evento Especial", "Anúncio", "Testemunho"],
      "site": ["Anúncio", "Evento Especial"],
    };

    // Coletar sugestões baseadas no tipo
    const sugestoesTipo = mapaTipoParaTag[tipoMidia] || [];
    
    // Coletar sugestões baseadas no canal
    const sugestoesCanal = mapaCanalParaTag[canalMidia] || [];
    
    // Combinar sugestões únicas (priorizar interseção)
    const todasSugestoes = [...new Set([...sugestoesTipo, ...sugestoesCanal])];
    
    // Encontrar IDs das tags sugeridas (máximo 3 tags)
    todasSugestoes.slice(0, 3).forEach(nomeSugestao => {
      const tagEncontrada = tags.find(
        t => t.nome.toLowerCase() === nomeSugestao.toLowerCase()
      );
      if (tagEncontrada) {
        sugestoes.push(tagEncontrada.id);
      }
    });

    return sugestoes;
  };

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setTipo("imagem");
    setCanal("telao");
    setAtivo(true);
    setArquivo(null);
    setPreviewUrl("");
    setScheduledAt(undefined);
    setExpiresAt(undefined);
    setTagsSelecionadas([]);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <div className="flex flex-col h-full max-h-[90vh]">
          <div className="border-b pb-3 px-4 pt-4 md:px-6">
            <h2 className="text-lg font-semibold">{midia ? "Editar" : "Nova"} Mídia</h2>
          </div>

          <Tabs defaultValue="config" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 md:px-6 pt-4 border-b">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="config" className="text-xs md:text-sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configuração
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs md:text-sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="config" className="px-4 py-4 md:px-6 space-y-4 mt-0">
          {/* Upload de Arquivo */}
          <div>
            <Label>Arquivo</Label>
            <div className="mt-2">
              {tipo === 'imagem' ? (
                <ImageCaptureInput
                  onFileSelected={handleArquivoChange}
                  accept="image/*"
                  maxSizeMB={20}
                  previewUrl={previewUrl}
                  onClear={handleRemoverArquivo}
                />
              ) : (
                <>
                  {!arquivo && !previewUrl && (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleArquivoChange(file);
                        }}
                        accept="image/*,video/*,application/pdf"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Clique para selecionar
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vídeos ou PDFs (máx. 20MB)
                        </p>
                      </label>
                    </div>
                  )}

                  {(arquivo || previewUrl) && (
                    <div className="relative rounded-lg overflow-hidden border">
                      {tipo === 'video' && previewUrl && (
                        <video src={previewUrl} controls className="w-full h-48" />
                      )}
                      {tipo === 'documento' && (
                        <div className="h-48 flex items-center justify-center bg-muted">
                          <p className="text-sm text-muted-foreground">
                            {arquivo?.name || "Documento PDF"}
                          </p>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={handleRemoverArquivo}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Título */}
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Aviso de Evento Especial"
            />
          </div>

          {/* Descrição */}
          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre a mídia..."
              rows={3}
            />
          </div>

          {/* Tipo */}
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imagem">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="documento">Documento/PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Canal */}
          <div>
            <Label htmlFor="canal">Canal de Exibição *</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app">App</SelectItem>
                <SelectItem value="redes_sociais">Redes Sociais</SelectItem>
                <SelectItem value="telao">Telão do Evento</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data de Publicação e Expiração */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduledAt">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Data de Publicação
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Se não definir, será publicado imediatamente
              </p>
              <DateTimePicker
                value={scheduledAt}
                onChange={setScheduledAt}
                placeholder="Publicar agora"
              />
            </div>

            <div>
              <Label htmlFor="expiresAt">
                <Clock className="w-4 h-4 inline mr-1" />
                Data de Expiração
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Mídia será ocultada automaticamente
              </p>
              <DateTimePicker
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="Sem expiração"
              />
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="ativo">Mídia Ativa</Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                <Tag className="w-4 h-4 inline mr-1" />
                Tags/Categorias
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTagDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Tag
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tag disponível
                </p>
              ) : (
                tags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={tagsSelecionadas.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: tagsSelecionadas.includes(tag.id) ? tag.cor : 'transparent',
                      borderColor: tag.cor,
                      color: tagsSelecionadas.includes(tag.id) ? 'white' : tag.cor
                    }}
                    onClick={() => {
                      setTagsSelecionadas(prev =>
                        prev.includes(tag.id)
                          ? prev.filter(id => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                  >
                    {tag.nome}
                  </Badge>
                ))
              )}
            </div>
          </div>

              </TabsContent>

              <TabsContent value="preview" className="px-4 py-4 md:px-6 mt-0">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Pré-visualização</p>
                  {tipo === 'imagem' && previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover rounded-lg border" />
                  ) : tipo === 'video' && previewUrl ? (
                    <video src={previewUrl} controls className="w-full h-48 rounded-lg border" />
                  ) : tipo === 'documento' ? (
                    <div className="h-48 flex items-center justify-center bg-muted rounded-lg border">
                      <p className="text-sm text-muted-foreground">Documento PDF</p>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-muted rounded-lg border">
                      <p className="text-sm text-muted-foreground">Nenhuma mídia selecionada</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? "Enviando..." : saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <TagMidiaDialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        onSuccess={loadTags}
      />
    </>
  );
}
