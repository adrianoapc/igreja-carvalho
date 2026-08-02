import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHideValues } from "@/hooks/useHideValues";
import {
  useLotesAntecipacao,
  calcularDesagio,
  type LoteAntecipacao,
} from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { VincularExtratoLoteDialog } from "@/components/financas/VincularExtratoLoteDialog";
import { LancarDesagioDialog } from "@/components/financas/LancarDesagioDialog";
import { ConferenciaTotaisGetnetCard } from "@/components/financas/ConferenciaTotaisGetnetCard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2, TrendingDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const STATUS_LABEL: Record<LoteAntecipacao["status"], string> = {
  pendente_vinculo: "Pendente de vínculo",
  vinculado: "Vinculado",
  lancamento_criado: "Deságio lançado",
};

function StatusBadge({ status }: { status: LoteAntecipacao["status"] }) {
  if (status === "lancamento_criado") {
    return (
      <Badge className="bg-green-500 text-white gap-1">
        <CheckCircle2 className="w-3 h-3" /> {STATUS_LABEL[status]}
      </Badge>
    );
  }
  if (status === "vinculado") {
    return (
      <Badge className="bg-blue-500 text-white gap-1">
        <Link2 className="w-3 h-3" /> {STATUS_LABEL[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <AlertCircle className="w-3 h-3" /> {STATUS_LABEL[status]}
    </Badge>
  );
}

export function LotesAntecipacaoTab() {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const { data: lotes = [], isLoading, refetch } = useLotesAntecipacao();
  const [loteVinculando, setLoteVinculando] = useState<LoteAntecipacao | null>(null);
  const [loteLancando, setLoteLancando] = useState<LoteAntecipacao | null>(null);

  return (
    <div className="space-y-4">
      <ConferenciaTotaisGetnetCard />

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Lotes de antecipação Getnet importados do Recebível Extrato Detalhado
          (Gerenciar Dados). Vincule manualmente cada lote à linha real do
          extrato bancário para calcular o deságio e lançá-lo como saída — sem
          match automático, a escolha é sempre do tesoureiro.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : lotes.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground text-sm">
          Nenhum lote de antecipação importado ainda.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Contrato</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-right">Valor do contrato</th>
                <th className="px-3 py-2 text-right">Deságio</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => {
                const desagio = calcularDesagio(lote);
                return (
                  <tr key={lote.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{lote.contrato_registradora}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {lote.data_contratacao_contrato
                        ? format(parseISO(lote.data_contratacao_contrato), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{formatValue(lote.valor_atual_contrato ?? 0)}</td>
                    <td className="px-3 py-2 text-right">
                      {desagio != null ? (
                        <span className="text-destructive font-medium">{formatValue(desagio)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={lote.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {lote.status === "pendente_vinculo" && (
                        <Button size="sm" variant="outline" onClick={() => setLoteVinculando(lote)}>
                          <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular extrato
                        </Button>
                      )}
                      {lote.status === "vinculado" && (
                        <div className="flex justify-end gap-2">
                          {/* fin_vincular_lote_antecipacao permite trocar o
                              vínculo até o deságio ser lançado — mantém a
                              ação disponível pro caso de extrato errado ou
                              deságio não-positivo rejeitado pela RPC de
                              lançamento (achado do /code-review). */}
                          <Button size="sm" variant="outline" onClick={() => setLoteVinculando(lote)}>
                            <Link2 className="w-3.5 h-3.5 mr-1" /> Corrigir vínculo
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setLoteLancando(lote)}>
                            <TrendingDown className="w-3.5 h-3.5 mr-1" /> Lançar como saída
                          </Button>
                        </div>
                      )}
                      {lote.status === "lancamento_criado" && (
                        <span className="text-xs text-muted-foreground">Concluído</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loteVinculando && (
        <VincularExtratoLoteDialog
          open={!!loteVinculando}
          onOpenChange={(open) => !open && setLoteVinculando(null)}
          lote={loteVinculando}
          onVinculado={() => {
            refetch();
            setLoteVinculando(null);
          }}
        />
      )}

      {loteLancando && (
        <LancarDesagioDialog
          open={!!loteLancando}
          onOpenChange={(open) => !open && setLoteLancando(null)}
          lote={loteLancando}
          onLancado={() => {
            refetch();
            // Lançar o deságio muda oferta_bruto/taxa_mdr/desagio_lancado
            // de fin_conferencia_totais_getnet pra essa conta/período — o
            // card de conferência (montado nesta mesma tela) só refetch
            // por causa própria (troca de conta/período), então sem isso
            // continuava mostrando os totais de ANTES do lançamento até
            // um remount não relacionado (achado do /code-review).
            queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
            setLoteLancando(null);
          }}
        />
      )}
    </div>
  );
}
