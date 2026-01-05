-- Adicionar constraint de unicidade para permitir upsert
ALTER TABLE public.user_filial_access 
ADD CONSTRAINT user_filial_access_user_filial_unique 
UNIQUE (user_id, filial_id);