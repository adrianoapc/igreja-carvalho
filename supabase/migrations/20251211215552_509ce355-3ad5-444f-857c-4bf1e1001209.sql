-- 1. Garantir que as tabelas existem e limpar dados antigos para evitar duplicatas
TRUNCATE TABLE public.notificacao_regras CASCADE;
TRUNCATE TABLE public.notificacao_eventos CASCADE;

-- 2. Inserir os Eventos do Sistema (O Catálogo)
INSERT INTO public.notificacao_eventos (slug, nome, categoria, provider_preferencial, variaveis) VALUES
('financeiro_conta_vencer', 'Nova Conta a Pagar', 'financeiro', 'meta_direto', ARRAY['descricao', 'valor', 'vencimento']),
('financeiro_reembolso_aprovacao', 'Reembolso Aguardando Aprovação', 'financeiro', 'make', ARRAY['solicitante', 'valor']),
('kids_checkin', 'Check-in Realizado', 'kids', 'meta_direto', ARRAY['crianca', 'responsavel']),
('kids_ocorrencia', 'Ocorrência/Choro no Kids', 'kids', 'meta_direto', ARRAY['crianca', 'motivo']),
('novo_visitante', 'Novo Visitante Cadastrado', 'pessoas', 'make', ARRAY['nome', 'telefone']),
('pedido_oracao', 'Novo Pedido de Oração', 'intercessao', 'make', ARRAY['nome', 'motivo']);

-- 3. Inserir uma Regra Padrão (Para testar imediatamente)
-- Envia para o Admin (você) quando uma conta for criada
INSERT INTO public.notificacao_regras (evento_slug, role_alvo, canais, ativo)
VALUES 
('financeiro_conta_vencer', 'admin', '{"inapp": true, "push": false, "whatsapp": false}'::jsonb, true);

-- 4. Garantir Permissões de Leitura (Essencial para aparecer na tela)
-- Política: Todos autenticados podem LER os eventos (para listar na tela)
DROP POLICY IF EXISTS "Leitura publica eventos" ON public.notificacao_eventos;
CREATE POLICY "Leitura publica eventos" ON public.notificacao_eventos FOR SELECT TO authenticated USING (true);

-- Política: Todos autenticados podem LER as regras (para o sistema disparar)
DROP POLICY IF EXISTS "Leitura publica regras" ON public.notificacao_regras;
CREATE POLICY "Leitura publica regras" ON public.notificacao_regras FOR SELECT TO authenticated USING (true);

-- Política: Apenas Admin pode EDITAR regras
DROP POLICY IF EXISTS "Admin gerencia regras" ON public.notificacao_regras;
CREATE POLICY "Admin gerencia regras" ON public.notificacao_regras FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);