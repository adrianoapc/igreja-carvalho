-- Permite acesso anônimo para o Telão (que não está logado)

-- Política para liturgia_recursos permitir acesso público
DROP POLICY IF EXISTS "Membros podem ver recursos liturgia" ON public.liturgia_recursos;

CREATE POLICY "Publico pode ver recursos liturgia" 
ON public.liturgia_recursos FOR SELECT 
TO anon, authenticated 
USING (true);