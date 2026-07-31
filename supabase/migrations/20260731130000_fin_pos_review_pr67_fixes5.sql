-- ============================================================================
-- Mais 2 achados do /code-review sobre os fixes anteriores desta mesma PR
-- (verificados por leitura direta antes de agir; outros 8 comentários da
-- mesma rodada eram repetição do que já estava corrigido em commits
-- anteriores — 3 stale de sempre, 2 já mitigados fora do diff, 3 apontando
-- pra versões antigas de arquivo já substituídas):
--
-- 1) atualizar_saldo_conta() — branch "pago -> pendente/cancelado" (a
--    ÚNICA das três que não foi escrita nesta sessão; existe desde a
--    criação do trigger em nov/2025 e sobreviveu, sem ninguém notar,
--    através de 20260730110000/20260731100000/20260731120000) desfaz o
--    movimento usando NEW.tipo em vez de OLD.tipo. fin_atualizar_lancamento
--    permite trocar `tipo` e `status` no mesmo patch (ambos estão na
--    allow-list) — mudar uma entrada paga de R$100 pra saída pendente no
--    mesmo patch cai no branch (OLD.status='pago', NEW.status≠'pago') mas
--    testa NEW.tipo='saida' (o tipo NOVO, ainda não confirmado) em vez de
--    OLD.tipo='entrada' (o tipo que efetivamente gerou o crédito quando
--    ficou pago) — soma R$100 de novo em vez de subtrair os R$100
--    originais, deixando o saldo R$200 alto. As outras duas branches (pago
--    novo e pago->pago) já usam o tipo certo pra cada lado (NEW pra aplicar
--    o novo movimento, OLD pra desfazer o antigo); só faltava esta.
--
-- 2) getnet_antecipacao_lotes_filial_id_fkey (20260731110000) foi
--    adicionada sem limpar filial_id órfão antes — se existisse alguma
--    linha com um UUID de filial já deletada, o ADD CONSTRAINT falharia
--    (Postgres valida todas as linhas existentes). Na prática não há risco
--    real agora: a tabela nasce nesta mesma sequência de migrations
--    (20260729100000) e o deploy é sempre atômico no merge (não existe
--    janela entre a tabela existir em produção e a FK ser adicionada onde
--    uma filial pudesse ser deletada no meio). Mantido como rede de
--    segurança mesmo assim — barato e não muda nada quando não há linha
--    órfã (garantido hoje).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      IF NEW.tipo = 'entrada' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' (só dispara em UPDATE OF status — presente no SET de
  -- fin_atualizar_lancamento/fin_alterar_status_lancamento mesmo quando o
  -- valor do status em si não muda).
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- pendente/cancelado -> pago: aplica o movimento NOVO (NEW.tipo — é a
    -- confirmação que está acontecendo agora, com o tipo atual do patch).
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    -- pago -> pendente/cancelado: desfaz o movimento ANTIGO — usa OLD.tipo
    -- (o tipo que efetivamente gerou o movimento quando ficou pago), não
    -- NEW.tipo, que pode ter mudado no mesmo patch junto com o status
    -- (achado do /code-review — bug herdado do trigger original, nov/2025).
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF OLD.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status = 'pago' THEN
    -- pago -> pago: desfaz o movimento antigo (conta/tipo/valor de antes) e
    -- aplica o novo — cobre edição de valor numa mesma conta E o caso mais
    -- raro de trocar conta_id/tipo mantendo status pago.
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF OLD.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ─── Rede de segurança: filial_id órfão antes da FK já existente ──────────

UPDATE public.getnet_antecipacao_lotes
   SET filial_id = NULL
 WHERE filial_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.filiais WHERE id = getnet_antecipacao_lotes.filial_id);
