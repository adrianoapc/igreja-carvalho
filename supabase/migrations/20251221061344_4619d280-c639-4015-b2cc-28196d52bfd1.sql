-- Função para sincronizar e_pastor quando membro_funcoes é alterado
CREATE OR REPLACE FUNCTION public.sync_e_pastor_from_funcao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcao_nome TEXT;
  v_is_pastor_funcao BOOLEAN;
  v_has_active_pastor_funcao BOOLEAN;
BEGIN
  -- Pega o nome da função
  SELECT nome INTO v_funcao_nome
  FROM public.funcoes_igreja
  WHERE id = COALESCE(NEW.funcao_id, OLD.funcao_id);
  
  -- Verifica se é uma função de pastor (case insensitive)
  v_is_pastor_funcao := v_funcao_nome ILIKE '%pastor%';
  
  -- Se não é função de pastor, não faz nada
  IF NOT v_is_pastor_funcao THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Para INSERT ou UPDATE com ativo = true, marca e_pastor = true
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.ativo = true THEN
    UPDATE public.profiles
    SET e_pastor = true
    WHERE id = NEW.membro_id;
    RETURN NEW;
  END IF;
  
  -- Para DELETE ou UPDATE com ativo = false, verifica se há outras funções de pastor ativas
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.ativo = false) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.membro_funcoes mf
      JOIN public.funcoes_igreja f ON f.id = mf.funcao_id
      WHERE mf.membro_id = COALESCE(NEW.membro_id, OLD.membro_id)
        AND mf.ativo = true
        AND f.nome ILIKE '%pastor%'
        AND mf.id != COALESCE(NEW.id, OLD.id)
    ) INTO v_has_active_pastor_funcao;
    
    -- Se não tem mais função de pastor ativa, remove o flag
    IF NOT v_has_active_pastor_funcao THEN
      UPDATE public.profiles
      SET e_pastor = false
      WHERE id = COALESCE(NEW.membro_id, OLD.membro_id);
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger para sincronizar e_pastor
DROP TRIGGER IF EXISTS sync_e_pastor_on_funcao_change ON public.membro_funcoes;
CREATE TRIGGER sync_e_pastor_on_funcao_change
  AFTER INSERT OR UPDATE OR DELETE ON public.membro_funcoes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_e_pastor_from_funcao();

-- Atualiza dados existentes: garante que quem tem função Pastor ativa tenha e_pastor = true
UPDATE public.profiles p
SET e_pastor = true
WHERE EXISTS (
  SELECT 1
  FROM public.membro_funcoes mf
  JOIN public.funcoes_igreja f ON f.id = mf.funcao_id
  WHERE mf.membro_id = p.id
    AND mf.ativo = true
    AND f.nome ILIKE '%pastor%'
)
AND p.e_pastor = false;

-- E quem NÃO tem função Pastor ativa tenha e_pastor = false
UPDATE public.profiles p
SET e_pastor = false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.membro_funcoes mf
  JOIN public.funcoes_igreja f ON f.id = mf.funcao_id
  WHERE mf.membro_id = p.id
    AND mf.ativo = true
    AND f.nome ILIKE '%pastor%'
)
AND p.e_pastor = true;