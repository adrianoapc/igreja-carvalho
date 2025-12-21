-- Criar evento de notificação para gabinete pastoral
INSERT INTO public.notificacao_eventos (slug, nome, categoria, provider_preferencial, variaveis)
VALUES (
  'alerta_gabinete_pastoral',
  'Alerta de Gabinete Pastoral',
  'gabinete',
  'make',
  ARRAY['nome_pessoa', 'gravidade', 'origem', 'conteudo']
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria;

-- Criar regra padrão para alertas de gabinete (role pastor)
INSERT INTO public.notificacao_regras (evento_slug, role_alvo, canais, ativo)
VALUES (
  'alerta_gabinete_pastoral',
  'pastor',
  '{"in_app": true, "whatsapp": true, "push": false}'::jsonb,
  true
)
ON CONFLICT DO NOTHING;