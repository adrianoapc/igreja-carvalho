-- ============================================================================
-- Ciclo 2 (C2-4) — Tabela de referência dos motivos de ajuste Getnet
--
-- `getnet_ajustes.motivo_ajuste` grava o código bruto ("01".."22") desde
-- sempre — nunca decodificado por nenhuma tela/RPC (grep no repo inteiro
-- não achou nenhum call site). O dicionário TS `MOTIVO_AJUSTE`
-- (`getnetExtratoParser.ts`) tinha os mesmos 22 pares código/descrição da
-- Tabela II do manual (V10.1, pág. 9-10), mas nunca foi importado/consumido
-- em lugar nenhum — puro código morto.
--
-- Esta tabela vira a ÚNICA fonte de verdade (não duplica o dicionário TS em
-- SQL como segunda cópia) — o dicionário TS foi removido no mesmo commit que
-- introduz esta migration. `fin_listar_ajustes_getnet` (próxima migration)
-- decodifica via LEFT JOIN nesta tabela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.getnet_motivos_ajuste (
  codigo text PRIMARY KEY,
  descricao text NOT NULL
);

COMMENT ON TABLE public.getnet_motivos_ajuste IS
  'Referência estática dos 22 motivos de ajuste do Extrato Eletrônico Getnet (manual V10.1, Tabela II, pág. 9-10). Seed via migration — não é dado transacional por igreja, sem igreja_id/filial_id.';

INSERT INTO public.getnet_motivos_ajuste (codigo, descricao) VALUES
  ('01', 'Ajuste a crédito ou a débito'),
  ('02', 'Aluguel de POS'),
  ('03', 'Cancelamento'),
  ('04', 'Chargeback'),
  ('05', 'Recarga Telecom'),
  ('06', 'Bilhetagem'),
  ('07', 'Consulta Serasa'),
  ('08', 'Aluguel de Verticais'),
  ('09', 'Carga e Recarga Cartão Pré Pago'),
  ('10', 'Manutenção de Cartão'),
  ('11', 'Venda de Cartão'),
  ('12', 'Cancelamento com motivo de Estorno'),
  ('13', 'Recarga com cartão'),
  ('14', 'Plataforma Digital'),
  ('15', 'GetData'),
  ('16', 'Reversão de Chargeback'),
  ('17', 'Liquidação de Gravame'),
  ('18', 'Débito de Cessão'),
  ('19', 'Estorno de Cessão'),
  ('20', 'Débito de Antecipação'),
  ('21', 'Estorno de Antecipação'),
  ('22', 'Cashback Conv Moedas (DCC)')
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao;

-- Reference data estática, sem tenant — RLS habilitada por padrão do
-- projeto (defesa em profundidade), mas a policy é aberta pra qualquer
-- usuário autenticado (não há igreja_id pra restringir). Escrita fica só
-- com service_role/migration — não é editável pela aplicação.
ALTER TABLE public.getnet_motivos_ajuste ENABLE ROW LEVEL SECURITY;

CREATE POLICY getnet_motivos_ajuste_select
  ON public.getnet_motivos_ajuste
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.getnet_motivos_ajuste TO authenticated;
GRANT ALL ON public.getnet_motivos_ajuste TO service_role;
