-- Atomic append to meta_dados->fila_pendente in atendimentos_bot.
-- Replaces the read-modify-write pattern in chatbot-financeiro that causes a
-- race condition when two WhatsApp images arrive simultaneously: both reads see
-- the same array, each appends its item, and the last UPDATE wins, dropping
-- the other. A single SQL UPDATE with jsonb_set eliminates the race.
--
-- Returns the new length of fila_pendente after appending.

CREATE OR REPLACE FUNCTION append_fila_pendente(
  p_sessao_id UUID,
  p_igreja_id UUID,
  p_item JSONB
) RETURNS INT
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH updated AS (
    UPDATE public.atendimentos_bot
    SET meta_dados = jsonb_set(
      meta_dados,
      '{fila_pendente}',
      COALESCE(meta_dados -> 'fila_pendente', '[]'::jsonb) || jsonb_build_array(p_item),
      true
    )
    WHERE id = p_sessao_id
      AND igreja_id = p_igreja_id
    RETURNING meta_dados -> 'fila_pendente' AS fila
  )
  SELECT COALESCE(jsonb_array_length(fila), 0) FROM updated;
$$;
