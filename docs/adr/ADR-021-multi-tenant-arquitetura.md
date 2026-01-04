# ADR-021: Arquitetura Multi-tenant com Isolamento por Igreja

**Status**: ✅ Implementado  
**Data**: 3-4 de Janeiro de 2026  
**Decisores**: Equipe de Desenvolvimento  
**Contexto**: Sistema multi-tenant para suporte a múltiplas igrejas

---

## Contexto

O sistema foi inicialmente desenvolvido para uma única igreja (Carvalho), mas com o crescimento e demanda de outras igrejas, era necessário suportar múltiplas instâncias isoladas no mesmo banco de dados.

Problemas identificados:

1. **Isolamento de dados**: Dados de uma igreja não podiam ser acessados por outra
2. **Gestão centralizada**: Super admins precisavam gerenciar múltiplas igrejas
3. **Filiais**: Suporte a congregações filiais vinculadas a uma igreja pai
4. **Onboarding**: Processo público para novas igrejas se cadastrarem
5. **Webhooks**: Configurações de integração isoladas por igreja
6. **Segurança**: RLS policies para garantir isolamento automático

Soluções existentes não atendiam:

- Instâncias separadas → Custo alto de manutenção, duplicação de código
- Schema compartilhado sem isolamento → Risco de vazamento de dados
- Configuração manual → Escalabilidade ruim

---

## Decisão

### 1. Modelo de Dados Multi-tenant

**Decisão**: Implementar isolamento por coluna `igreja_id` em todas as entidades principais.

**Estrutura**:

- **Tabela `igrejas`**: Cadastro central com dados da igreja (nome, CNPJ, responsável, contatos)
- **Tabela `filiais`**: Congregações filiais vinculadas via `igreja_id` pai
- **Coluna `igreja_id`**: Adicionada a 30+ tabelas (profiles, eventos, transacoes, pedidos_oracao, webhooks, etc.)
- **RLS Policies**: Políticas automáticas garantindo acesso apenas a dados da própria igreja

**Alternativas rejeitadas**:

- ❌ **Instâncias separadas**: Alto custo de infraestrutura, manutenção duplicada
- ❌ **Schema separado por igreja**: Complexidade de migrations, queries cross-igreja difíceis
- ❌ **Tenant por subdomain**: Requer infraestrutura de proxy/reverse proxy complexa

**Trade-offs**:

- ✅ **Escalabilidade**: Uma base de dados suporta milhares de igrejas
- ✅ **Manutenibilidade**: Código único, migrations centralizadas
- ⚠️ **Query performance**: Índices obrigatórios em `igreja_id`
- ✅ **Segurança**: RLS garante isolamento automático

---

### 2. Super Admin Dashboard

**Decisão**: Criar módulo `/superadmin` para gestão centralizada de igrejas.

**Funcionalidades**:

- **Listagem de igrejas**: Tabela com dados básicos e métricas agregadas
- **Gestão de filiais**: Drill-down hierárquico igreja → filiais
- **Onboarding approval**: Aprovar/rejeitar solicitações de novas igrejas
- **Métricas por tenant**: Membros, eventos, transações por igreja

**Componentes**:

- `SuperAdminDashboard.tsx`: Dashboard principal
- `NovaIgrejaDialog.tsx`: Modal para criar/editar igrejas
- `IgrejaRowExpandable.tsx`: Linha expansível com filiais
- `GerenciarFiliaisDialog.tsx`: Gestão de filiais

**Alternativas rejeitadas**:

- ❌ **Admin manual no banco**: Não escalável, propenso a erros
- ❌ **Ferramenta externa**: Perda de integração, dados dispersos

**Trade-offs**:

- ✅ **Centralização**: Um ponto para gerenciar tudo
- ⚠️ **Acesso restrito**: Apenas `profiles.super_admin = true`
- ✅ **Auditoria**: Logs de todas ações administrativas

---

### 3. Onboarding Público

**Decisão**: Permitir cadastro público de novas igrejas via `/cadastro/nova-igreja`.

**Fluxo**:

1. Formulário público coleta dados básicos (nome, CNPJ, responsável, contatos)
2. Cria registro em `onboarding_requests` com status `pendente`
3. Super admin aprova → Cria igreja + perfil de admin automaticamente
4. Super admin rejeita → Feedback enviado ao solicitante

**Alternativas rejeitadas**:

- ❌ **Cadastro direto**: Risco de spam, validação manual necessária
- ❌ **Convite-only**: Limita alcance, requer contato prévio

**Trade-offs**:

- ✅ **Acesso democrático**: Qualquer igreja pode se cadastrar
- ⚠️ **Validação manual**: Super admin precisa revisar solicitações
- ✅ **Automação**: Criação automática após aprovação

---

### 4. Webhooks por Igreja

**Decisão**: Migrar configurações de webhook para tabela `webhooks` scoped por `igreja_id`.

**Mudanças**:

- Tabela `webhooks`: `igreja_id`, `tipo`, `url`, `enabled`
- Edge functions atualizadas: `disparar-escala`, `notificar-liturgia-make`, `verificar-escalas-pendentes`
- Busca webhook por `igreja_id` + tipo ao invés de config global

**Alternativas rejeitadas**:

- ❌ **Config global**: Não funcionava em multi-tenant
- ❌ **Por filial**: Complexidade desnecessária, webhooks são por igreja

**Trade-offs**:

- ✅ **Isolamento**: Cada igreja configura seus próprios webhooks
- ⚠️ **Configuração manual**: Admins precisam configurar URLs
- ✅ **Flexibilidade**: Diferentes tipos de webhook por igreja

---

### 5. Hooks de Contexto

**Decisão**: Criar hooks `useIgrejaId` e `useFilialId` para contexto automático.

**Implementação**:

- `useIgrejaId`: Retorna `igreja_id` do usuário logado
- `useFilialId`: Retorna `filial_id` se aplicável (opcional)
- Uso obrigatório em todas queries para garantir isolamento

**Alternativas rejeitadas**:

- ❌ **Passar manualmente**: Propenso a erros, esquecimentos
- ❌ **Context global**: Menos performático, mais complexo

**Trade-offs**:

- ✅ **Segurança**: Impossível esquecer de filtrar por igreja
- ⚠️ **Performance**: Query extra para buscar `igreja_id`
- ✅ **Simplicidade**: Uso transparente nos componentes

---

## Consequências

### Positivas

- **Escalabilidade**: Suporte a milhares de igrejas em uma base
- **Isolamento**: Dados completamente separados por igreja
- **Manutenibilidade**: Código único, migrations centralizadas
- **Segurança**: RLS automático previne vazamentos
- **Flexibilidade**: Suporte a filiais hierárquicas

### Negativas

- **Complexidade**: Queries sempre precisam filtrar por `igreja_id`
- **Performance**: Índices obrigatórios, queries mais complexas
- **Migrations**: 30+ tabelas afetadas, cuidado com dados existentes
- **Testing**: Cenários multi-tenant precisam ser testados

### Riscos

- **Vazamento de dados**: RLS mal configurado pode expor dados
- **Performance**: Queries sem índice em `igreja_id` ficam lentas
- **Onboarding**: Processo manual pode criar gargalo

### Métricas de Sucesso

- Zero vazamentos de dados entre igrejas
- Tempo de resposta queries mantido (< 500ms)
- Onboarding de novas igrejas em < 24h
- 100% das tabelas com RLS ativo

---

## Referências

- Commits: 83fd49c, 1e7ecb5, fb95b60, d0af664, 5508bbd, 4c67aed, 1978381
- Arquivos: `src/hooks/useIgrejaId.tsx`, `src/pages/superadmin/SuperAdminDashboard.tsx`
- Migrações: 30+ migrations adicionando `igreja_id` e RLS
