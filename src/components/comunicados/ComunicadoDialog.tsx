import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  X,
  Image as ImageIcon,
  Megaphone,
  AlertCircle,
  AlertTriangle,
  Info,
  Link as LinkIcon,
  Eye,
  Settings,
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { useFilialId } from "@/hooks/useFilialId";

type TipoComunicado = Database["public"]["Enums"]["tipo_comunicado"];

interface Comunicado {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  tipo: TipoComunicado;
  nivel_urgencia: string | null;
  link_acao: string | null;
  ativo: boolean | null;
  data_inicio: string | null;
  data_fim: string | null;
}

interface ComunicadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comunicado?: Comunicado | null;
  onSuccess: () => void;
}

export function ComunicadoDialog({
  open,
  onOpenChange,
  comunicado,
  onSuccess,
}: ComunicadoDialogProps) {
  const { toast } = useToast();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "alerta" as TipoComunicado,
    nivel_urgencia: "info",
    link_acao: "",
    ativo: true,
    data_inicio: undefined as Date | undefined,
    data_fim: undefined as Date | undefined,
  });

  useEffect(() => {
    if (comunicado) {
      setFormData({
        titulo: comunicado.titulo || "",
        descricao: comunicado.descricao || "",
        tipo: comunicado.tipo,
        nivel_urgencia: comunicado.nivel_urgencia || "info",
        link_acao: comunicado.link_acao || "",
        ativo: comunicado.ativo ?? true,
        data_inicio: comunicado.data_inicio
          ? new Date(comunicado.data_inicio)
          : undefined,
        data_fim: comunicado.data_fim
          ? new Date(comunicado.data_fim)
          : undefined,
      });
      setImagePreview(comunicado.imagem_url || null);
    } else {
      setFormData({
        titulo: "",
        descricao: "",
        tipo: "alerta",
        nivel_urgencia: "info",
        link_acao: "",
        ativo: true,
        data_inicio: undefined,
        data_fim: undefined,
      });
      setImagePreview(null);
      setImageFile(null);
    }
  }, [comunicado, open]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Tamanho máximo: 2MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("comunicados")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("comunicados")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: unknown) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!formData.titulo.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (formData.tipo === "banner" && !imagePreview) {
      toast({
        title: "Erro",
        description: "Banner requer uma imagem",
        variant: "destructive",
      });
      return;
    }

    if (formData.tipo === "alerta" && !formData.descricao.trim()) {
      toast({
        title: "Erro",
        description: "Mensagem do alerta é obrigatória",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl = comunicado?.imagem_url || null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) {
          toast({
            title: "Erro no upload",
            description: "Falha ao enviar imagem",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      const payload = {
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        tipo: formData.tipo,
        nivel_urgencia:
          formData.tipo === "alerta" ? formData.nivel_urgencia : null,
        link_acao:
          formData.tipo === "banner" ? formData.link_acao || null : null,
        imagem_url: formData.tipo === "banner" ? imageUrl : null,
        ativo: formData.ativo,
        data_inicio:
          formData.data_inicio?.toISOString() || new Date().toISOString(),
        data_fim: formData.data_fim?.toISOString() || null,
        igreja_id: igrejaId,
        filial_id: isAllFiliais ? null : filialId,
      };

      if (comunicado) {
        const { error } = await supabase
          .from("comunicados")
          .update(payload)
          .eq("id", comunicado.id);
        if (error) throw error;
        toast({ title: "Comunicado atualizado!" });
      } else {
        const { error } = await supabase.from("comunicados").insert(payload);
        if (error) throw error;
        toast({
          title: "Comunicado criado!",
          description: "O comunicado está ativo e visível.",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getAlertVariant = () => {
    if (formData.nivel_urgencia === "destructive") return "destructive";
    return "default";
  };

  const getAlertIcon = () => {
    switch (formData.nivel_urgencia) {
      case "destructive":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getAlertStyle = () => {
    switch (formData.nivel_urgencia) {
      case "destructive":
        return "border-destructive/50 text-destructive bg-destructive/5";
      case "warning":
        return "border-yellow-500/50 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-400";
      default:
        return "border-blue-500/50 text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400";
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <div className="border-b pb-3 px-4 pt-4 md:px-6">
          <h2 className="text-lg font-semibold">
            {comunicado ? "Editar Comunicado" : "Novo Comunicado"}
          </h2>
        </div>

        <Tabs
          defaultValue="config"
          className="flex-1 flex flex-col overflow-hidden"
        >
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
            <TabsContent
              value="config"
              className="px-4 py-4 md:px-6 space-y-4 mt-0"
            >
              {/* Tipo */}
              <div className="space-y-2">
                <Label>Tipo de Comunicado</Label>
                <RadioGroup
                  value={formData.tipo}
                  onValueChange={(value: TipoComunicado) =>
                    setFormData({ ...formData, tipo: value })
                  }
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="alerta"
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      formData.tipo === "alerta"
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-input hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem
                      value="alerta"
                      id="alerta"
                      className="sr-only"
                    />
                    <Megaphone className="h-5 w-5 text-orange-500" />
                    <div className="text-center">
                      <p className="font-medium text-sm">Alerta</p>
                      <p className="text-xs text-muted-foreground">
                        Mensagem de texto
                      </p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="banner"
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      formData.tipo === "banner"
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-input hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem
                      value="banner"
                      id="banner"
                      className="sr-only"
                    />
                    <ImageIcon className="h-5 w-5 text-purple-500" />
                    <div className="text-center">
                      <p className="font-medium text-sm">Banner</p>
                      <p className="text-xs text-muted-foreground">
                        Com imagem
                      </p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo: e.target.value })
                  }
                  placeholder="Ex: Culto Especial de Domingo"
                  maxLength={100}
                />
              </div>

              {/* Campos Alerta */}
              {formData.tipo === "alerta" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Mensagem do Alerta *</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) =>
                        setFormData({ ...formData, descricao: e.target.value })
                      }
                      placeholder="Digite a mensagem do alerta..."
                      className="min-h-[100px] resize-none"
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.descricao.length}/500
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nivel">Nível de Urgência</Label>
                    <Select
                      value={formData.nivel_urgencia}
                      onValueChange={(value) =>
                        setFormData({ ...formData, nivel_urgencia: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />{" "}
                            Info (Azul)
                          </span>
                        </SelectItem>
                        <SelectItem value="warning">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-yellow-500" />{" "}
                            Atenção (Amarelo)
                          </span>
                        </SelectItem>
                        <SelectItem value="destructive">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />{" "}
                            Crítico (Vermelho)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Campos Banner */}
              {formData.tipo === "banner" && (
                <>
                  <div className="space-y-2">
                    <Label>Imagem do Banner *</Label>
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-lg border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={removeImage}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          id="banner-image"
                        />
                        <label
                          htmlFor="banner-image"
                          className="cursor-pointer block"
                        >
                          <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-primary font-medium">
                            Clique para upload
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG até 2MB
                          </p>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição (opcional)</Label>
                    <Input
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) =>
                        setFormData({ ...formData, descricao: e.target.value })
                      }
                      placeholder="Texto curto sobre o banner"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link_acao">Link de Ação (opcional)</Label>
                    <Input
                      id="link_acao"
                      value={formData.link_acao}
                      onChange={(e) =>
                        setFormData({ ...formData, link_acao: e.target.value })
                      }
                      placeholder="https://exemplo.com"
                      type="url"
                    />
                  </div>
                </>
              )}

              {/* Datas */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Data de Início</Label>
                  <DateTimePicker
                    value={formData.data_inicio}
                    onChange={(date) =>
                      setFormData({ ...formData, data_inicio: date })
                    }
                    placeholder="Agora"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Fim (opcional)</Label>
                  <DateTimePicker
                    value={formData.data_fim}
                    onChange={(date) =>
                      setFormData({ ...formData, data_fim: date })
                    }
                    placeholder="Sem expiração"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, ativo: !!checked })
                  }
                />
                <Label htmlFor="ativo" className="text-sm cursor-pointer">
                  Comunicado ativo
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="px-4 py-4 md:px-6 mt-0">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pré-visualização
                </p>
                {formData.tipo === "alerta" ? (
                  <Alert className={getAlertStyle()}>
                    {getAlertIcon()}
                    <AlertTitle>
                      {formData.titulo || "Título do Alerta"}
                    </AlertTitle>
                    <AlertDescription>
                      {formData.descricao ||
                        "A mensagem do alerta aparecerá aqui..."}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Card className="overflow-hidden">
                    <div className="relative h-48 bg-gradient-to-br from-purple-500/20 to-purple-600/30">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="font-semibold text-lg">
                          {formData.titulo || "Título do Banner"}
                        </h3>
                        {formData.descricao && (
                          <p className="text-sm text-white/90 mt-1">
                            {formData.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                    {formData.link_acao && (
                      <CardContent className="p-3 bg-muted/30">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <LinkIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formData.link_acao}</span>
                        </p>
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading
              ? "Salvando..."
              : comunicado
              ? "Atualizar"
              : "Criar Comunicado"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
