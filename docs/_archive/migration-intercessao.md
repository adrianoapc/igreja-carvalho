# Checklist de Migração: Intercessão como Time

Este documento contém os passos práticos para implementar a evolução do ministério de Intercessão conforme [ADR-011](../adr/ADR-011-evolucao-ministerio-intercessao.md).

## 📋 Etapas de Implementação

### 1. Banco de Dados (Migration)

#### 1.1. Criar Trigger de Sincronização
Execute o SQL abaixo no Supabase SQL Editor ou via migration:

```sql
-- Função de Sincronização
CREATE OR REPLACE FUNCTION public.sync_membro_intercessor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_time_nome TEXT;
  v_user_id UUID;
  v_user_nome TEXT;
  v_user_email TEXT;
  v_user_telefone TEXT;
BEGIN
  -- Identifica o nome do time
  SELECT nome INTO v_time_nome FROM public.times_culto WHERE id = NEW.time_id;

  -- Se o time for relacionado à Intercessão/Oração
  IF v_time_nome ILIKE '%Intercessão%' OR v_time_nome ILIKE '%Oração%' THEN
    
    -- Busca dados do perfil
    SELECT user_id, nome, email, telefone 
    INTO v_user_id, v_user_nome, v_user_email, v_user_telefone
    FROM public.profiles 
    WHERE id = NEW.pessoa_id;

    -- Apenas sincroniza se o perfil tem user_id (login ativo)
    IF v_user_id IS NOT NULL THEN
      -- Insere ou Reativa na tabela especializada
      INSERT INTO public.intercessores (user_id, nome, email, telefone, ativo, max_pedidos)
      VALUES (v_user_id, v_user_nome, v_user_email, v_user_telefone, true, 10)
      ON CONFLICT (user_id) DO UPDATE SET 
        ativo = true,
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- Gatilho que executa após inserção em membros_time
DROP TRIGGER IF EXISTS trigger_sync_intercessor ON public.membros_time;
CREATE TRIGGER trigger_sync_intercessor
  AFTER INSERT ON public.membros_time
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membro_intercessor();
```

**Validação:**
```sql
-- Testar se o trigger foi criado
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_sync_intercessor';
```

---

### 2. Criação do Time "Intercessão" via Admin

#### 2.1. Acessar Módulo de Times
1. Fazer login como **Admin**
2. Navegar para **Cultos & Escalas** → **Times**
3. Clicar em **"+ Novo Time"**

#### 2.2. Preencher Dados do Time
- **Nome**: `Intercessão` (exato, case-sensitive para o trigger)
- **Categoria**: `Ministérios` ou criar nova categoria "Oração"
- **Cor**: `#9333ea` (roxo) ou cor desejada
- **Líder**: Selecionar o líder do ministério
- **Sublíder**: (opcional)

#### 2.3. Adicionar Membros Existentes
1. Abrir o Time recém-criado
2. Aba **"Membros"**
3. Clicar em **"+ Adicionar Membro"**
4. Buscar e selecionar os intercessores existentes
5. (Opcional) Atribuir posição (ex: "Coordenador", "Intercessor")

**Resultado esperado:**
- Ao adicionar um membro, o trigger `sync_membro_intercessor()` será disparado
- O registro será criado/reativado automaticamente em `intercessores`
- Confirmar via SQL:
  ```sql
  SELECT * FROM public.intercessores WHERE ativo = true;
  ```

---

### 3. Migração de Intercessores Antigos (Opcional)

Se existem intercessores cadastrados **antes** da criação do Time:

#### 3.1. Script de Migração Manual
```sql
-- Listar intercessores ativos sem vínculo no Time
SELECT i.user_id, i.nome, i.email 
FROM public.intercessores i
WHERE i.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.membros_time mt
    JOIN public.times_culto t ON mt.time_id = t.id
    WHERE t.nome ILIKE '%Intercessão%'
      AND mt.pessoa_id = (SELECT id FROM public.profiles WHERE user_id = i.user_id)
  );
```

Para cada intercessor listado, adicionar manualmente via Admin (passo 2.3).

---

### 4. Validação e Testes

#### 4.1. Teste de Sincronização
1. Criar um usuário de teste com perfil completo (nome, email, telefone)
2. Garantir que o usuário tem `user_id` (login ativo)
3. Adicionar ao Time "Intercessão" via Admin
4. Verificar no banco:
   ```sql
   SELECT * FROM public.intercessores WHERE nome LIKE '%[nome do teste]%';
   ```
5. Confirmar que `ativo = true` e `max_pedidos = 10`

#### 4.2. Teste de Distribuição de Pedidos
1. Criar um pedido de oração via frontend
2. Admin aloca pedido via "Alocar Pedido"
3. Verificar que intercessores sincronizados aparecem na lista

#### 4.3. Teste de Escalas (Novo Recurso)
1. Criar um culto futuro
2. Adicionar escala para o Time "Intercessão"
3. Confirmar que intercessores podem ser escalados

---

### 5. Ajustes de UI (Futuro / Opcional)

#### 5.1. Deprecar Tela Antiga (se desejado)
- A tela **Intercessão → Intercessores** pode ser mantida apenas para:
  - Ajustar `max_pedidos` individual
  - Inativar temporariamente (sem remover do Time)
- Ou pode ser completamente removida, delegando gestão ao módulo de Times

#### 5.2. Adicionar Badge "Time" na Lista de Intercessores
- Na tela de Intercessores, exibir badge indicando que a pessoa é membro do Time oficial

---

## ✅ Checklist Resumido

- [ ] Executar SQL de criação do Trigger no Supabase
- [ ] Validar que o Trigger foi criado com sucesso
- [ ] Criar Time "Intercessão" via Admin (nome exato)
- [ ] Adicionar Líder do ministério ao Time
- [ ] Adicionar membros existentes ao Time
- [ ] Confirmar que registros foram criados em `intercessores`
- [ ] Testar distribuição de pedidos com intercessores sincronizados
- [ ] Testar criação de escalas para o Time de Intercessão
- [ ] (Opcional) Migrar intercessores antigos via script
- [ ] (Opcional) Deprecar ou ajustar tela antiga de Intercessores
- [ ] Atualizar manual do usuário para refletir novo fluxo

---

## 🔗 Referências
- [ADR-011: Unificação via Times e Triggers](../adr/ADR-011-evolucao-ministerio-intercessao.md)
- [Fluxo Atualizado de Intercessão](../diagramas/fluxo-intercessao.md)
- [Database Schema Completo](../database-schema.sql)

---

## 📅 Status da Migração
- **Data de criação**: 2025-12-17
- **Responsável**: (a definir)
- **Status**: Pendente
- **Data de conclusão**: (a definir)
