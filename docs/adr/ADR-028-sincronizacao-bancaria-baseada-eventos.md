# ADR 028: Sincronização Bancária Baseada em Eventos do Calendário

**Status**: Aceito  
**Data**: 2026-02-09  
**Decisores**: Equipe de Desenvolvimento  
**Tags**: #financeiro #pix #sincronizacao #eventos #ofertas

## Contexto

O sistema de relatório de ofertas precisava de uma solução robusta para sincronizar transações PIX do banco Santander com as sessões de contagem. Os desafios identificados eram:

1. **Janela de Tempo Arbitrária**: A lógica anterior usava janelas fixas (7 dias) ou timestamps arbitrários, sem relação com eventos reais da igreja
2. **Duplicação de Dados**: Múltiplos cliques no botão "Sincronizar API" podiam duplicar transações
3. **Falta de Contexto**: Relatórios não estavam vinculados aos eventos (cultos) reais do calendário
4. **Controle de Fechamento**: Não havia registro de quando uma sessão foi finalizada, dificultando auditorias

## Decisão

Implementamos uma arquitetura de sincronização bancária baseada em eventos do calendário da igreja, com as seguintes mudanças:

### 1. Evolução do Schema

```sql
ALTER TABLE sessoes_contagem 
ADD COLUMN evento_id UUID REFERENCES eventos(id),
ADD COLUMN data_fechamento TIMESTAMPTZ;

ALTER TABLE sessoes_contagem 
ADD status 'finalizado' to enum;
```

**Justificativa**: 
- `evento_id`: Vincula cada sessão a um evento real do calendário (culto, evento especial)
- `data_fechamento`: Marca o timestamp exato de quando a sessão foi finalizada, criando um ponto de corte para sincronizações futuras

### 2. Interface com Seleção de Eventos

Substituímos os campos "Data" e "Período" por um componente `EventoSelect` que:
- Lista eventos dos últimos 30 dias (`status IN ('confirmado', 'realizado')`)
- Permite entrada manual para casos sem evento cadastrado
- Auto-preenche data e período baseado no horário do evento

**Justificativa**: Conecta o processo financeiro ao calendário litúrgico/administrativo real da igreja.

### 3. Lógica de Sincronização Inteligente

#### Cálculo da Janela de Tempo

```typescript
function calcularJanelaSincronizacao(igrejaId, filialId) {
  const fim = now();
  
  const ultimaSessao = getUltimaSessaoFinalizada(igrejaId, filialId);
  
  const inicio = ultimaSessao?.data_fechamento 
    ? new Date(ultimaSessao.data_fechamento + 1s)
    : now() - 7 dias; // fallback
  
  return { inicio, fim };
}
```

**Justificativa**: 
- Usa o fechamento real da última sessão como ponto de partida
- Elimina gaps e overlaps entre relatórios
- Fallback de 7 dias apenas para primeiro uso

#### Prevenção de Duplicação

```typescript
// Busca PIX já vinculados a OUTRAS sessões
const pixVinculados = await supabase
  .from("sessoes_itens_draft")
  .select("id")
  .eq("origem_registro", "api")
  .neq("sessao_id", sessaoAtual.id);

// Filtra ao inserir
const novos = pixRows.filter(pix => 
  !existentesNaSessaoAtual.has(pix.pix_id) &&
  !pixVinculados.has(pix.pix_id)
);
```

**Justificativa**: 
- Evita duplicação mesmo com múltiplos cliques
- Permite re-sincronizar a mesma sessão sem duplicar
- Impede que PIX apareçam em múltiplas sessões

### 4. Finalização Automática

Ao clicar "Encerrar e Lançar":
1. Cria transações financeiras
2. Marca sessão como `status = 'finalizado'`
3. Registra `data_fechamento = NOW()`
4. Limpa rascunhos

**Justificativa**: Automatiza o fechamento e cria ponto de corte auditável.

## Consequências

### Positivas

✅ **Rastreabilidade**: Cada relatório está vinculado a um evento real  
✅ **Janelas Precisas**: Sincronização usa timestamps reais de fechamento  
✅ **Sem Duplicação**: Sistema impede PIX duplicados entre sessões  
✅ **Auditoria**: `data_fechamento` registra quando cada relatório foi fechado  
✅ **UX Melhorada**: Usuário seleciona evento em vez de digitar data/período  
✅ **Automação**: Fechamento automático ao lançar transações  

### Negativas

⚠️ **Dependência de Eventos**: Relatórios manuais (sem evento) perdem parte do contexto  
⚠️ **Migração**: Sessões antigas não têm `evento_id` nem `data_fechamento`  
⚠️ **Complexidade**: Lógica de janela depende de estado distribuído (última sessão)  

### Neutras

🔄 **Retrocompatibilidade**: Sistema funciona com ou sem `evento_id`  
🔄 **Fallback**: Janela de 7 dias para primeiro uso ou sem sessões anteriores  

## Alternativas Consideradas

### 1. Janela Fixa de N Dias
❌ **Rejeitada**: Pode duplicar ou perder transações dependendo da frequência de uso

### 2. Timestamp Manual pelo Usuário
❌ **Rejeitada**: Sujeito a erro humano, sem garantias de continuidade

### 3. Polling Contínuo (Cron apenas)
❌ **Rejeitada**: Não resolve duplicação em múltiplas sessões simultâneas

### 4. Solução Escolhida: Baseada em Eventos + data_fechamento
✅ **Escolhida**: Combina contexto real (eventos) com controle preciso (fechamento)

## Implementação

### Migrations
- `20260209170000_add_evento_sync_to_sessoes.sql`
- `20260209170100_update_open_sessao_rpc.sql`

### Código
- `src/hooks/useFinanceiroSessao.ts`: novas funções de sincronização
- `src/components/financas/EventoSelect.tsx`: novo componente
- `src/pages/financas/RelatorioOferta.tsx`: integração completa

### Deployment
Build validado sem erros. Mudanças são retrocompatíveis.

## Validação

### Cenários de Teste

1. ✅ Criar relatório vinculado a evento do calendário
2. ✅ Sincronizar PIX pela primeira vez (fallback 7 dias)
3. ✅ Sincronizar PIX após sessão anterior finalizada (janela precisa)
4. ✅ Clicar "Sincronizar API" múltiplas vezes (sem duplicação)
5. ✅ Criar relatório manual sem evento (entrada tradicional)
6. ✅ Finalizar sessão (registra `data_fechamento`)

## Referências

- ADR-008: Eventos de Domínio
- Documentação API Santander PIX
- `docs/DASHBOARD_VOLUNTARIADO.md`: padrão de janelas temporais
- Migration `20260209133822`: estrutura `cob_pix` e `pix_webhook_temp`

## Notas de Implementação

### Cron Fallback
O sistema mantém um cron (`buscar-pix-cron`) que roda a cada 30min como fallback caso webhook falhe. A lógica de janela também se aplica ao cron.

### Eventos Elegíveis
Apenas eventos com `status IN ('confirmado', 'realizado')` aparecem no selector, evitando vincular a eventos cancelados.

### Horário do Evento
O período (manhã/noite) é inferido automaticamente:
- `hora < 12`: manhã
- `hora >= 12`: noite

---

**Última Atualização**: 2026-02-09  
**Próxima Revisão**: Após 3 meses de uso em produção
