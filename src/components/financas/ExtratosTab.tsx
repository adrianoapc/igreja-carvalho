import { useState } from "react";
import { Landmark, CreditCard } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HistoricoExtratos } from "./HistoricoExtratos";
import { CartaoExtratoResumo } from "./CartaoExtratoResumo";

type ModoExtrato = "banco" | "cartao";

interface ExtratosTabProps {
  onIrParaConciliacaoCartao: () => void;
}

/**
 * Separa a antiga aba "Histórico" em duas fontes distintas — o extrato de
 * Banco (`extratos_bancarios`, com as ações de vínculo já existentes) e o
 * resumo de Cartão (pipeline Getnet, `getnet_recebivel_lancamentos`) — que
 * antes ficavam empilhados sem separação clara. Default "banco" preserva o
 * comportamento de quem já usava a aba pra vincular/ignorar extratos.
 */
export function ExtratosTab({ onIrParaConciliacaoCartao }: ExtratosTabProps) {
  const [modo, setModo] = useState<ModoExtrato>("banco");
  // Cartão só monta na 1ª visita (não dispara Getnet enquanto o tesoureiro
  // fica em Banco) e depois permanece montado pra não perder o MonthPicker.
  const [cartaoVisitado, setCartaoVisitado] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Extratos</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={modo}
          onValueChange={(v) => {
            if (!v) return;
            const next = v as ModoExtrato;
            if (next === "cartao") setCartaoVisitado(true);
            setModo(next);
          }}
        >
          <ToggleGroupItem value="banco" className="gap-1.5">
            <Landmark className="w-3.5 h-3.5" />
            Banco
          </ToggleGroupItem>
          <ToggleGroupItem value="cartao" className="gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Cartão
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Banco fica sempre montado (filtros/página sobrevivem). Cartão
          monta na 1ª visita e permanece — o ternário antigo desmontava
          o inativo e zerava o estado (Codex P2). */}
      <div hidden={modo !== "banco"}>
        <HistoricoExtratos />
      </div>
      {cartaoVisitado && (
        <div hidden={modo !== "cartao"}>
          <CartaoExtratoResumo onIrParaConciliacaoCartao={onIrParaConciliacaoCartao} />
        </div>
      )}
    </div>
  );
}
