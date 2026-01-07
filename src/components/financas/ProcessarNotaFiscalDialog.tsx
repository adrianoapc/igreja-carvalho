import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ImageCaptureInput } from "@/components/ui/image-capture-input";
import { useIgrejaId } from "@/hooks/useIgrejaId";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface NotaFiscalData {
  fornecedor_cnpj_cpf?: string;
  fornecedor_nome: string;
  data_emissao: string;
  valor_total: number;
  data_vencimento?: string;
  descricao: string;
  numero_nota?: string;
  tipo_documento?: string;
  anexo_url?: string;
}

interface ProcessarNotaFiscalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDadosExtraidos: (dados: NotaFiscalData) => void;
}

export default function ProcessarNotaFiscalDialog({
  open,
  onOpenChange,
  onDadosExtraidos,
}: ProcessarNotaFiscalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { igrejaId } = useIgrejaId();

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);

    // Criar preview se for imagem
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    // Processar automaticamente
    processarArquivo(file);
  };

  const processarArquivo = async (file: File) => {
    setLoading(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Sessão inválida. Faça login novamente.");
        return;
      }
      // Converter para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];

        // Processar com IA
        toast.loading("Processando nota fiscal com IA...", {
          id: "processing",
        });

        const { data, error } = await supabase.functions.invoke(
          "processar-nota-fiscal",
          {
            body: {
              imageBase64: base64,
              mimeType: file.type,
              igreja_id: igrejaId,
            },
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
              apikey: supabaseAnonKey,
            },
          }
        );

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        // Fazer upload do arquivo para o Storage
        toast.loading("Salvando arquivo...", { id: "processing" });

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        const filePath = `notas-fiscais/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("transaction-attachments")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Obter URL pública do arquivo
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("transaction-attachments")
          .getPublicUrl(filePath);

        toast.success("Nota fiscal processada com sucesso!", {
          id: "processing",
        });

        // Passar dados extraídos + URL do anexo para o componente pai
        onDadosExtraidos({
          ...data.dados,
          anexo_url: publicUrl,
        });
        onOpenChange(false);

        // Limpar estado
        setPreviewUrl(null);
        setSelectedFile(null);
      };

      reader.readAsDataURL(file);
    } catch (error: unknown) {
      console.error("Erro ao processar nota fiscal:", error);
      toast.error("Erro ao processar nota fiscal", {
        description: error instanceof Error ? error.message : String(error),
        id: "processing",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Processar Nota Fiscal com IA"
    >
      <div className="flex flex-col h-full">
        <div className="px-4 pt-2 pb-0 md:px-6">
          <p className="text-sm text-muted-foreground">
            Envie uma foto ou PDF da nota fiscal. A IA irá extrair
            automaticamente os dados do fornecedor, valor e outras informações.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Processando com IA...
                </p>
              </div>
            )}

            {!loading && (
              <ImageCaptureInput
                onFileSelected={handleFileSelected}
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                maxSizeMB={10}
                previewUrl={previewUrl || undefined}
                onClear={handleClear}
              />
            )}

            {/* Instruções */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">
                Dicas para melhor resultado:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Certifique-se que a foto está nítida e bem iluminada</li>
                <li>• Enquadre toda a nota fiscal na foto</li>
                <li>• Evite reflexos e sombras sobre o documento</li>
                <li>• PDFs de notas eletrônicas funcionam melhor</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
