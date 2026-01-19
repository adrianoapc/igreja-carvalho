import { Suspense } from "react";
import { PixWebhookReceiver } from "@/components/financas/PixWebhookReceiver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Página PIX Recebido
 * Exibe e gerencia notificações de PIX recebidas via webhook do Santander
 */
export default function PixRecebido() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PIX Recebido</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as notificações de PIX recebidas via webhook do Santander
        </p>
      </div>

      {/* Painel de Contexto */}
      <Card>
        <CardHeader>
          <CardTitle>Sobre PIX Webhook</CardTitle>
          <CardDescription>
            Sistema de integração com Santander BACEN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Este painel exibe todas as notificações de PIX recebidas automaticamente via webhook do banco Santander.
          </p>
          <p>
            Os dados são sincronizados em tempo real e armazenados na tabela <code className="bg-muted px-2 py-1 rounded">pix_webhook_temp</code> com status inicial <code className="bg-muted px-2 py-1 rounded">recebido</code>.
          </p>
          <p>
            Você pode revisar, filtrar, deletar erros e vincular PIX a ofertas/comprovantes para reconciliação.
          </p>
        </CardContent>
      </Card>

      {/* Componente Principal */}
      <Suspense fallback={<PixRecebidoSkeleton />}>
        <PixWebhookReceiver />
      </Suspense>
    </div>
  );
}

/**
 * Skeleton de Loading
 */
function PixRecebidoSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
