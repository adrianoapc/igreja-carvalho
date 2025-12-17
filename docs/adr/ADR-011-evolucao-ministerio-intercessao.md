# ADR-011 — Unificação da Gestão de Intercessão via Times e Triggers

## Status
**Aceito**

## Contexto

A gestão de voluntários do ministério de Intercessão estava isolada do restante dos ministérios da igreja:

- **Louvor, Multimídia, Kids**: Usam o módulo de Times (`times_culto`, `membros_time`) com gestão unificada de escalas, dados de contato, aniversários e liderança.
- **Intercessão**: Possuía tela e tabela específica (`intercessores`) desconectada da estrutura de Times.

### Problemas identificados

1. **Fragmentação de gestão**: Líderes de ministério usam ferramentas diferentes para gerenciar voluntários.
2. **Invisibilidade no organograma**: Intercessão não aparece como Time oficial na estrutura da igreja.
3. **Impossibilidade de escalas**: Não é possível escalar intercessores para cultos específicos (ex: Tenda de Oração, Sala de Oração).
4. **Duplicação de dados**: Nome, email, telefone são cadastrados em ambas as tabelas (`profiles` e `intercessores`).
5. **Visão fragmentada**: Um membro que é intercessor E louvor aparece em contextos desconectados.

### Requisitos para a solução

- Manter a **lógica de negócio específica** de Intercessão (distribuição automática de pedidos, `max_pedidos`, status de alocação).
- Unificar a **entrada e saída** de voluntários no módulo de Times.
- Permitir que Líderes de Intercessão **escalem membros para cultos** (mesmo fluxo de outros ministérios).
- Evitar reescrita massiva de código existente.

## ✅ Decisão

**Adotamos uma Arquitetura Híbrida com Sincronização via Database Triggers:**

### 1. Entrada Unificada (Módulo de Times)
- "Intercessão" passa a ser um **Time oficial** em `public.times_culto`.
- Líderes adicionam/removem membros via interface padrão de Times (`GerenciarTimeDialog`).
- Todos os dados de contato, aniversários e escalas ficam consolidados em `membros_time`.

### 2. Funcionalidade Mantida (Tabela Especializada)
- A tabela `public.intercessores` **permanece** para armazenar lógica de negócio específica:
  - `max_pedidos` (quantidade máxima de pedidos simultâneos)
  - `ativo` (disponibilidade para receber novos pedidos)
  - Relacionamento com `pedidos_oracao.intercessor_id`
- Essa tabela é usada **apenas** pela lógica de distribuição de pedidos (RPC `alocar_pedido_balanceado`).

### 3. Sincronização Automática (Database Trigger)
- Um **Trigger** monitora a tabela `membros_time`.
- Quando um membro é adicionado a um time relacionado a "Intercessão" ou "Oração", o sistema:
  1. Busca dados do perfil (`profiles`)
  2. Insere ou reativa o registro em `intercessores`
  3. Define valores padrão (`ativo=true`, `max_pedidos=10`)

```sql
-- Função de Sincronização
CREATE OR REPLACE FUNCTION public.sync_membro_intercessor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Se o time for relacionado à Intercessão
  IF v_time_nome ILIKE '%Intercessão%' OR v_time_nome ILIKE '%Oração%' THEN
    
    -- Busca dados do perfil
    SELECT user_id, nome, email, telefone 
    INTO v_user_id, v_user_nome, v_user_email, v_user_telefone
    FROM public.profiles 
    WHERE id = NEW.pessoa_id;

    -- Se o perfil tem vínculo de usuário (login)
    IF v_user_id IS NOT NULL THEN
      -- Insere ou Reativa na tabela especializada
      INSERT INTO public.intercessores (user_id, nome, email, telefone, ativo, max_pedidos)
      VALUES (v_user_id, v_user_nome, v_user_email, v_user_telefone, true, 10)
      ON CONFLICT (user_id) DO UPDATE SET ativo = true;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- Gatilho
CREATE TRIGGER trigger_sync_intercessor
  AFTER INSERT ON public.membros_time
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membro_intercessor();
```

## 📊 Consequências

### Positivas ✅
1. **Gestão unificada**: Líderes de todos os ministérios usam a mesma interface para gerenciar voluntários.
2. **Escalas de culto**: Intercessores podem ser escalados para cultos específicos (ex: Tenda de Oração aos domingos).
3. **Visibilidade no organograma**: Intercessão aparece como Time oficial na estrutura da igreja.
4. **Dados consolidados**: Nome, email, telefone são mantidos em `profiles` (fonte única de verdade).
5. **Compatibilidade retroativa**: Código existente de distribuição de pedidos (`alocar_pedido_balanceado`) **não precisa ser alterado**.

### Negativas ⚠️
1. **Lógica implícita no banco**: A sincronização via Trigger é "invisível" no código da aplicação; requer documentação clara para não ser esquecida.
2. **Dependência de nomenclatura**: O Trigger detecta "Intercessão" ou "Oração" no nome do Time; se o nome mudar, a sincronização quebra (mitigação: usar categoria ou campo dedicado no futuro).
3. **Não há sincronização reversa**: Remover um membro do Time **não** inativa automaticamente o registro em `intercessores` (decisão de design: permite histórico de pedidos).
4. **Requisito de login**: Apenas membros com `user_id` (login ativo) são sincronizados; visitantes não recebem pedidos (comportamento esperado).

## 🔄 Alternativas Consideradas

### A. Migração Total (Abandonar tabela `intercessores`)
- **Rejeitada**: Requer reescrita de toda a lógica de distribuição de pedidos e perda de histórico existente.

### B. Sincronização Bidirecional (Trigger em ambas as direções)
- **Rejeitada**: Complexidade de manter consistência; risco de loops infinitos; decisão de usar `membros_time` como fonte de verdade.

### C. Sincronização via Aplicação (não Trigger)
- **Rejeitada**: Requer mudanças em múltiplos pontos do código frontend; Trigger garante consistência mesmo em operações diretas no banco.

## 📚 Referências
- [ADR-010](./ADR-010-intercessao-redirecionamento-inteligente.md) — Redirecionamento Inteligente (decisão sobre fluxo de sentimentos)
- [Fluxo de Intercessão](../diagramas/fluxo-intercessao.md) — Diagrama visual atualizado
- [Database Schema](../database-schema.sql) — Implementação do Trigger

## 📅 Histórico
- **2025-12-17**: Decisão aceita e documentada
- **Próximos Passos**: 
  - Criar Time "Intercessão" via Admin
  - Executar migration para adicionar Trigger
  - Atualizar documentação de usuário
