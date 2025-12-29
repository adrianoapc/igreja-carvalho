-- =============================================================================
-- MÓDULO: CONVITES E RSVP PARA EVENTOS
-- Objetivo: Gerenciar convites separadamente das escalas de trabalho
-- =============================================================================

-- 1. CRIAR TABELA eventos_convites
CREATE TABLE public.eventos_convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  pessoa_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo_recusa TEXT,
  visualizado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint para evitar convites duplicados
  CONSTRAINT eventos_convites_evento_pessoa_unique UNIQUE (evento_id, pessoa_id),
  
  -- Check constraint para valores válidos de status
  CONSTRAINT eventos_convites_status_check CHECK (
    status IN ('pendente', 'confirmado', 'recusado', 'talvez')
  )
);

-- 2. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE public.eventos_convites IS 'Gerenciamento de convites e RSVPs para eventos';
COMMENT ON COLUMN public.eventos_convites.status IS 'Status do convite: pendente, confirmado, recusado, talvez';
COMMENT ON COLUMN public.eventos_convites.visualizado_em IS 'Timestamp de quando o convidado visualizou o convite';
COMMENT ON COLUMN public.eventos_convites.enviado_em IS 'Timestamp de quando a notificação foi disparada';

-- 3. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_eventos_convites_evento_id ON public.eventos_convites(evento_id);
CREATE INDEX idx_eventos_convites_pessoa_id ON public.eventos_convites(pessoa_id);
CREATE INDEX idx_eventos_convites_status ON public.eventos_convites(status);

-- 4. TRIGGER PARA UPDATED_AT
CREATE TRIGGER update_eventos_convites_updated_at
  BEFORE UPDATE ON public.eventos_convites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. HABILITAR RLS
ALTER TABLE public.eventos_convites ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS RLS

-- Policy de Leitura: Admin/Líder vê todos, usuário vê apenas os seus
CREATE POLICY "Admin e lider podem ver todos os convites"
  ON public.eventos_convites
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role)
  );

CREATE POLICY "Usuario pode ver seus proprios convites"
  ON public.eventos_convites
  FOR SELECT
  USING (
    pessoa_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Policy de Criação: Apenas Admin pode criar convites
CREATE POLICY "Admin pode criar convites"
  ON public.eventos_convites
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role)
  );

-- Policy de Atualização: Usuário pode atualizar seu próprio convite (status/motivo)
CREATE POLICY "Usuario pode responder seu convite"
  ON public.eventos_convites
  FOR UPDATE
  USING (
    pessoa_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Policy de Atualização: Admin pode atualizar qualquer convite
CREATE POLICY "Admin pode atualizar convites"
  ON public.eventos_convites
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Policy de Deleção: Apenas Admin pode deletar convites
CREATE POLICY "Admin pode deletar convites"
  ON public.eventos_convites
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role)
  );