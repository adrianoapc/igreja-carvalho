import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, RotateCw, Eye, EyeOff, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  igrejaId: string | null;
  provedor: string;
  /** Type/discriminator persisted in webhook_secrets.tipo. Today we only use "pix" (Santander). */
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Mapa provedor → tipo de webhook suportado pelo backend.
// Hoje só Santander entrega PIX via webhook autenticado.
const WEBHOOK_BY_PROVIDER: Record<
  string,
  { tipo: string; endpoint: string; label: string } | null
> = {
  santander: { tipo: "pix", endpoint: "pix-webhook", label: "PIX Recebido (Santander)" },
  getnet: null,
  api_generico: null,
};

function generateSecret(length = 48) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function IntegracaoWebhookTab({ igrejaId, provedor }: Props) {
  const cfg = WEBHOOK_BY_PROVIDER[provedor] ?? null;
  const [rotating, setRotating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const webhookUrl = cfg
    ? `${SUPABASE_URL}/functions/v1/${cfg.endpoint}`
    : "";

  // Stats: usa pix_webhook_temp (única tabela de eventos PIX recebidos hoje)
  const { data: stats } = useQuery({
    queryKey: ["webhook-stats", igrejaId, cfg?.tipo],
    queryFn: async () => {
      if (!igrejaId || !cfg) return null;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: ultimo } = await supabase
        .from("pix_webhook_temp")
        .select("data_recebimento, status")
        .eq("igreja_id", igrejaId)
        .order("data_recebimento", { ascending: false })
        .limit(1);
      const { count } = await supabase
        .from("pix_webhook_temp")
        .select("id", { count: "exact", head: true })
        .eq("igreja_id", igrejaId)
        .gte("data_recebimento", since);
      return {
        ultimoEvento: ultimo?.[0]?.data_recebimento ?? null,
        contagem24h: count ?? 0,
      };
    },
    enabled: !!igrejaId && !!cfg,
    refetchInterval: 30000,
  });

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleRotate = async () => {
    if (!igrejaId || !cfg) return;
    if (
      !confirm(
        "Rotacionar o secret invalida o atual imediatamente. Você precisará atualizar a configuração no provedor. Continuar?"
      )
    ) {
      return;
    }
    setRotating(true);
    try {
      const newSecret = generateSecret();
      const { error } = await supabase.functions.invoke("set-webhook-secret", {
        body: {
          p_igreja_id: igrejaId,
          p_tipo: cfg.tipo,
          p_secret: newSecret,
        },
      });
      if (error) {
        toast.error(error.message || "Erro ao rotacionar secret");
        return;
      }
      setRevealedSecret(newSecret);
      setShowSecret(true);
      toast.success("Novo secret gerado", {
        description: "Copie agora — ele não será mostrado novamente.",
      });
    } catch (err) {
      console.error("[webhook] rotate error:", err);
      toast.error("Erro ao rotacionar secret");
    } finally {
      setRotating(false);
    }
  };

  if (!cfg) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-2">
        <Info className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Webhook não disponível para este provedor</p>
        <p className="text-xs text-muted-foreground">
          Hoje apenas Santander recebe eventos via webhook autenticado (PIX). Para{" "}
          {provedor.replace(/_/g, " ")} usamos polling / SFTP.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Webhook de recebimento</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure esta URL e secret no portal do provedor para receber{" "}
            <strong>{cfg.label}</strong> em tempo real.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">URL do webhook</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy(webhookUrl, "URL")}
              title="Copiar URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            Header de autenticação <code className="text-xs">X-Webhook-Secret</code>
          </Label>
          <div className="flex gap-2">
            <Input
              value={
                revealedSecret
                  ? showSecret
                    ? revealedSecret
                    : "•".repeat(Math.min(revealedSecret.length, 32))
                  : "•••••••••••••••••••••••• (configurado — rotacione para revelar)"
              }
              readOnly
              className="font-mono text-xs"
            />
            {revealedSecret && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret((v) => !v)}
                  title={showSecret ? "Ocultar" : "Revelar"}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(revealedSecret, "Secret")}
                  title="Copiar secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleRotate}
              disabled={rotating}
              title="Gerar novo secret"
            >
              {rotating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Rotacionar</span>
            </Button>
          </div>
          {revealedSecret && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Copie agora. Este secret não será mostrado novamente após fechar o
              diálogo.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border p-4 space-y-2">
        <p className="text-sm font-medium">Atividade (últimas 24h)</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Eventos recebidos</p>
            <p className="text-2xl font-bold">{stats?.contagem24h ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Último evento</p>
            <p className="text-sm">
              {stats?.ultimoEvento
                ? format(new Date(stats.ultimoEvento), "dd/MM HH:mm", {
                    locale: ptBR,
                  })
                : "Nenhum ainda"}
            </p>
          </div>
        </div>
        <div className="pt-1">
          <WebhookStatusBadge ultimoEvento={stats?.ultimoEvento ?? null} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como configurar no Santander</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Portal Santander Developers → App PIX → Webhooks.</li>
          <li>Cole a URL acima como endpoint de notificação.</li>
          <li>
            Adicione o header <code>X-Webhook-Secret</code> com o valor gerado ao
            rotacionar.
          </li>
        </ol>
      </div>
    </div>
  );
}

export function WebhookStatusBadge({
  ultimoEvento,
}: {
  ultimoEvento: string | null;
}) {
  if (!ultimoEvento) {
    return <Badge variant="outline">Sem eventos recentes</Badge>;
  }
  const ageMs = Date.now() - new Date(ultimoEvento).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 24) {
    return (
      <Badge className="bg-green-600 hover:bg-green-700">Recebendo eventos</Badge>
    );
  }
  return <Badge variant="secondary">Configurado · sem atividade recente</Badge>;
}
