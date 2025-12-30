import { useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DialogTitle } from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Video,
  BookOpen,
  Timer,
  Image,
  Users,
  HelpCircle,
  Presentation,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Membro {
  id: string;
  nome: string;
}

interface LiturgiaItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cultoId?: string;
  eventoId?: string;
  membros: Membro[];
  onSaved: () => void;
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
  "Outro",
];

// Constantes visuais com categorias
const TIPOS_ITEM = [
  {
    label: "Manuais / Estáticos",
    items: [
      {
        value: "VIDEO",
        label: "Vídeo (YouTube)",
        icon: "🎬",
        color: "bg-red-100 text-red-700",
      },
      {
        value: "VERSICULO",
        label: "Versículo / Palavra",
        icon: "📖",
        color: "bg-blue-100 text-blue-700",
      },
      {
        value: "AVISO",
        label: "Aviso / Texto",
        icon: "📢",
        color: "bg-gray-100 text-gray-700",
      },
      {
        value: "TIMER",
        label: "Timer / Silêncio",
        icon: "⏱️",
        color: "bg-orange-100 text-orange-700",
      },
    ],
  },
  {
    label: "Automáticos (Inteligência)",
    items: [
      {
        value: "BLOCO_TESTEMUNHO",
        label: "Gratidão (Testemunhos)",
        icon: "🙏",
        color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      },
      {
        value: "BLOCO_SENTIMENTO",
        label: "Clamor (Sentimentos)",
        icon: "❤️‍🔥",
        color: "bg-amber-100 text-amber-700 border-amber-200",
      },
      {
        value: "BLOCO_VISITANTE",
        label: "Boas Vindas (Visitantes)",
        icon: "👋",
        color: "bg-purple-100 text-purple-700 border-purple-200",
      },
      {
        value: "BLOCO_PEDIDOS",
        label: "Intercessão (Pedidos)",
        icon: "🛡️",
        color: "bg-indigo-100 text-indigo-700 border-indigo-200",
      },
    ],
  },
];

export type TipoConteudo =
  | "ATO_PRESENCIAL"
  | "VIDEO"
  | "IMAGEM"
  | "VERSICULO"
  | "PEDIDOS"
  | "TIMER"
  | "QUIZ"
  | "BLOCO_TESTEMUNHO"
  | "BLOCO_SENTIMENTO"
  | "BLOCO_VISITANTE"
  | "BLOCO_PEDIDOS"
  | "AVISO";

export function LiturgiaItemDialog({
  open,
  onOpenChange,
  cultoId,
  eventoId,
  membros,
  onSaved,
}: LiturgiaItemDialogProps) {
  const targetId = eventoId || cultoId || "";
  const [tipo, setTipo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracaoMinutos, setDuracaoMinutos] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [isConvidadoExterno, setIsConvidadoExterno] = useState(false);
  const [nomeConvidadoExterno, setNomeConvidadoExterno] = useState("");
  const [saving, setSaving] = useState(false);

  // Novos estados para conteúdo digital
  const [tipoConteudo, setTipoConteudo] =
    useState<TipoConteudo>("ATO_PRESENCIAL");
  const [videoUrl, setVideoUrl] = useState("");
  const [versiculoRef, setVersiculoRef] = useState("");
  const [timerMinutos, setTimerMinutos] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

  const resetForm = () => {
    setTipo("");
    setTitulo("");
    setDescricao("");
    setDuracaoMinutos("");
    setResponsavelId("");
    setIsConvidadoExterno(false);
    setNomeConvidadoExterno("");
    setTipoConteudo("ATO_PRESENCIAL");
    setVideoUrl("");
    setVersiculoRef("");
    setTimerMinutos("");
    setImagemUrl("");
  };

  const buildConteudoConfig = () => {
    switch (tipoConteudo) {
      case "VIDEO":
        return { url: videoUrl, autoplay: false };
      case "VERSICULO":
        return { referencia: versiculoRef };
      case "TIMER":
        return { duracao_segundos: parseInt(timerMinutos || "0") * 60 };
      case "IMAGEM":
        return { url: imagemUrl };
      case "PEDIDOS":
        return { tags: [], limite: 10 };
      case "AVISO":
        return { texto: descricao };
      case "BLOCO_TESTEMUNHO":
        return { tipo_bloco: "testemunhos", fonte: "edge_function" };
      case "BLOCO_SENTIMENTO":
        return { tipo_bloco: "sentimentos", fonte: "edge_function" };
      case "BLOCO_VISITANTE":
        return { tipo_bloco: "visitantes", fonte: "edge_function" };
      case "BLOCO_PEDIDOS":
        return {
          tipo_bloco: "pedidos",
          fonte: "edge_function",
          classificacao: "BROADCAST",
        };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    if (!tipo || !titulo) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    // Validação client-side dos tipos aceitos
    const tiposValidos = [
      "ATO_PRESENCIAL",
      "VIDEO",
      "IMAGEM",
      "VERSICULO",
      "PEDIDOS",
      "QUIZ",
      "TIMER",
      "AUDIO",
      "TEXTO",
      "AVISO",
      "BLOCO_TESTEMUNHO",
      "BLOCO_SENTIMENTO",
      "BLOCO_VISITANTE",
      "BLOCO_PEDIDOS",
    ];

    const tipoAtual = tipoConteudo || "ATO_PRESENCIAL";

    if (!tiposValidos.includes(tipoAtual)) {
      toast.error("Tipo de conteúdo inválido", {
        description: `O tipo "${tipoAtual}" não é aceito. Por favor, aplique a migration SQL no banco de dados.`,
        duration: 8000,
      });
      return;
    }

    setSaving(true);
    try {
      // Buscar a maior ordem atual
      const { data: itensData } = await supabase
        .from("liturgias")
        .select("ordem")
        .eq("evento_id", targetId)
        .order("ordem", { ascending: false })
        .limit(1);

      const novaOrdem =
        itensData && itensData.length > 0 ? itensData[0].ordem + 1 : 1;

      // Tipos que permitem múltiplas mídias
      const tiposMultiplos = [
        "avisos",
        "anúncios",
        "anuncios",
        "comunicados",
        "outro",
      ];
      const permiteMultiplo = tiposMultiplos.includes(tipo.toLowerCase());

      const payload = {
        evento_id: targetId,
        tipo,
        titulo,
        descricao: descricao || null,
        duracao_minutos: duracaoMinutos ? parseInt(duracaoMinutos) : null,
        responsavel_id: isConvidadoExterno ? null : responsavelId || null,
        responsavel_externo: isConvidadoExterno
          ? nomeConvidadoExterno.trim()
          : null,
        ordem: novaOrdem,
        permite_multiplo: permiteMultiplo,
        tipo_conteudo: tipoConteudo || "ATO_PRESENCIAL",
        conteudo_config: buildConteudoConfig(),
      };

      console.log("📤 Inserindo liturgia:", payload);

      const { error } = await supabase.from("liturgias").insert(payload);

      if (error) {
        console.error("❌ Erro ao inserir liturgia:", error);
        throw error;
      }

      toast.success("Item adicionado com sucesso!");
      resetForm();
      onSaved();
    } catch (error: unknown) {
      console.error("❌ Erro completo:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao adicionar item", {
        description: errorMsg,
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
    >
      <div className="flex flex-col h-full">
        <DialogTitle className="sr-only">Adicionar Item à Liturgia</DialogTitle>
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold">Adicionar Item à Liturgia</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_LITURGIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
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
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Momento de Louvor"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Detalhes adicionais..."
            />
          </div>

          {/* Tipo de Conteúdo Digital */}
          <div className="space-y-2">
            <Label>Tipo de Conteúdo</Label>
            <Select
              value={tipoConteudo}
              onValueChange={(v) => setTipoConteudo(v as TipoConteudo)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ITEM.map((categoria) => (
                  <div key={categoria.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {categoria.label}
                    </div>
                    {categoria.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${item.color} border px-1.5 py-0.5 text-xs`}
                          >
                            {item.icon}
                          </Badge>
                          <span>{item.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos condicionais baseados no tipo de conteúdo */}
          {tipoConteudo === "VIDEO" && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label>URL do Vídeo (YouTube/Vimeo)</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          )}

          {tipoConteudo === "VERSICULO" && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label>Referência Bíblica</Label>
              <Input
                value={versiculoRef}
                onChange={(e) => setVersiculoRef(e.target.value)}
                placeholder="Ex: João 3:16 ou Salmos 23:1-6"
              />
            </div>
          )}

          {tipoConteudo === "TIMER" && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label>Duração do Timer (minutos)</Label>
              <Input
                type="number"
                value={timerMinutos}
                onChange={(e) => setTimerMinutos(e.target.value)}
                placeholder="Ex: 5"
                min="1"
              />
            </div>
          )}

          {tipoConteudo === "IMAGEM" && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label>URL da Imagem</Label>
              <Input
                value={imagemUrl}
                onChange={(e) => setImagemUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {/* Info para Blocos Inteligentes */}
          {(tipoConteudo === "BLOCO_TESTEMUNHO" ||
            tipoConteudo === "BLOCO_SENTIMENTO" ||
            tipoConteudo === "BLOCO_VISITANTE" ||
            tipoConteudo === "BLOCO_PEDIDOS") && (
            <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🤖</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">
                    Conteúdo Automático
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Este bloco será preenchido automaticamente pela Edge
                    Function durante o Relógio de Oração.
                    {tipoConteudo === "BLOCO_TESTEMUNHO" &&
                      " Exibirá testemunhos públicos recentes."}
                    {tipoConteudo === "BLOCO_SENTIMENTO" &&
                      " Mostrará análise espiritual da igreja (clamor/gratidão)."}
                    {tipoConteudo === "BLOCO_VISITANTE" &&
                      " Apresentará visitantes recentes da semana."}
                    {tipoConteudo === "BLOCO_PEDIDOS" &&
                      " Listará pedidos de oração prioritários."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="convidado-add"
              checked={isConvidadoExterno}
              onCheckedChange={(checked) => setIsConvidadoExterno(!!checked)}
            />
            <Label htmlFor="convidado-add">Convidado externo</Label>
          </div>

          {isConvidadoExterno ? (
            <div className="space-y-2">
              <Label>Nome do Convidado</Label>
              <Input
                value={nomeConvidadoExterno}
                onChange={(e) => setNomeConvidadoExterno(e.target.value)}
                placeholder="Nome do convidado"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro..." />
                </SelectTrigger>
                <SelectContent>
                  {membros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="border-t pt-4 px-6 pb-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
