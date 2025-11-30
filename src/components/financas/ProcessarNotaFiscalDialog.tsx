import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface NotaFiscalData {
  fornecedor_cnpj_cpf?: string;
  fornecedor_nome: string;
  data_emissao: string;
  valor_total: number;
  data_vencimento?: string;
  descricao: string;
  numero_nota?: string;
  tipo_documento?: string;
}

interface ProcessarNotaFiscalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDadosExtraidos: (dados: NotaFiscalData) => void;
}

export default function ProcessarNotaFiscalDialog({ 
  open, 
  onOpenChange, 
  onDadosExtraidos 
}: ProcessarNotaFiscalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado', {
        description: 'Envie uma imagem (JPG, PNG, WEBP) ou PDF'
      });
      return;
    }

    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande', {
        description: 'O arquivo deve ter no máximo 10MB'
      });
      return;
    }

    setFileName(file.name);
    setLoading(true);

    try {
      // Criar preview se for imagem
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }

      // Converter para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        
        // Processar com IA
        toast.loading('Processando nota fiscal com IA...', { id: 'processing' });
        
        const { data, error } = await supabase.functions.invoke('processar-nota-fiscal', {
          body: {
            imageBase64: base64,
            mimeType: file.type
          }
        });

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        toast.success('Nota fiscal processada com sucesso!', { id: 'processing' });
        
        // Passar dados extraídos para o componente pai
        onDadosExtraidos(data.dados);
        onOpenChange(false);
        
        // Limpar estado
        setPreviewUrl(null);
        setFileName("");
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Erro ao processar nota fiscal:', error);
      toast.error('Erro ao processar nota fiscal', {
        description: error.message,
        id: 'processing'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setFileName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Processar Nota Fiscal com IA</DialogTitle>
          <DialogDescription>
            Envie uma foto ou PDF da nota fiscal. A IA irá extrair automaticamente os dados do fornecedor, valor e outras informações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          {!previewUrl && !fileName && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
              <input
                type="file"
                id="nota-fiscal-upload"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading}
              />
              <label htmlFor="nota-fiscal-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  {loading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">Processando...</p>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Upload className="w-12 h-12 text-muted-foreground" />
                        <ImageIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-base font-medium">Clique para enviar</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Imagem (JPG, PNG, WEBP) ou PDF - máx. 10MB
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>
          )}

          {/* Preview */}
          {(previewUrl || fileName) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-lg">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{fileName}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {loading ? 'Processando com IA...' : 'Pronto para processar'}
                    </p>
                  </div>
                  {!loading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instruções */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Dicas para melhor resultado:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Certifique-se que a foto está nítida e bem iluminada</li>
              <li>• Enquadre toda a nota fiscal na foto</li>
              <li>• Evite reflexos e sombras sobre o documento</li>
              <li>• PDFs de notas eletrônicas funcionam melhor</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}