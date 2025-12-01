-- Adicionar permissões básicas para role 'basico' em módulos essenciais
INSERT INTO public.module_permissions (module_name, role, access_level)
VALUES 
  ('dashboard', 'basico', 'visualizar'),
  ('pessoas', 'basico', 'visualizar'),
  ('intercessao', 'basico', 'visualizar')
ON CONFLICT DO NOTHING;