import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

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
    culto_id?: string;
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

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 20MB");
      return;
    }

    // Validar tipo
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo de arquivo não suportado");
      return;
    }

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

    setSaving(true);

    try {
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
        if (midia?.url) {
          const oldPath = midia.url.split('/midias/')[1];
          if (oldPath) {
            await supabase.storage.from('midias').remove([oldPath]);
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
      if (midia) {
        // Editar
        const { error } = await supabase
          .from('midias')
          .update({
            titulo,
            descricao,
            tipo,
            canal,
            ativo,
            url: urlFinal,
            updated_at: new Date().toISOString()
          })
          .eq('id', midia.id);

        if (error) throw error;
        toast.success("Mídia atualizada com sucesso!");
      } else {
        // Obter próxima ordem
        const { data: maxOrdem } = await supabase
          .from('midias')
          .select('ordem')
          .eq('canal', canal)
          .order('ordem', { ascending: false })
          .limit(1)
          .single();

        const novaOrdem = (maxOrdem?.ordem || 0) + 1;

        // Criar
        const { error } = await supabase
          .from('midias')
          .insert({
            titulo,
            descricao,
            tipo,
            url: urlFinal,
            canal,
            ordem: novaOrdem,
            ativo,
            culto_id: null
          });

        if (error) throw error;
        toast.success("Mídia adicionada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar mídia:', error);
      toast.error(error.message || "Erro ao salvar mídia");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitulo("");
    setDescricao("");
    setTipo("imagem");
    setCanal("telao");
    setAtivo(true);
    setArquivo(null);
    setPreviewUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{midia ? "Editar" : "Nova"} Mídia</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload de Arquivo */}
          <div>
            <Label>Arquivo</Label>
            <div className="mt-2 space-y-2">
              {!arquivo && !previewUrl && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleArquivoChange}
                    accept="image/*,video/*,application/pdf"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar ou arraste um arquivo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Imagens, vídeos ou PDFs (máx. 20MB)
                    </p>
                  </label>
                </div>
              )}

              {(arquivo || previewUrl) && (
                <div className="relative rounded-lg overflow-hidden border">
                  {tipo === 'imagem' && previewUrl && (
                    <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
                  )}
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

              {!arquivo && !previewUrl && midia && (
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Alterar Arquivo
                </Button>
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
                <SelectItem value="telao">Telão do Culto</SelectItem>
                <SelectItem value="site">Site</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Mídia Ativa</Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {(saving || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {uploading ? "Enviando..." : saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}