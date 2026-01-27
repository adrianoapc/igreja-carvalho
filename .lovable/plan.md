
# ADR-017: Fluxo Unificado de Despesas no Chatbot Financeiro com Baixa Automática

## Status
**Proposto** | Data: 27/01/2025

---

## 1. Contexto e Problema

### Situacao Atual
O `chatbot-financeiro` possui dois fluxos distintos:
- **REEMBOLSO**: Para membros que pagaram do bolso e querem ressarcimento
- **CONTA_UNICA**: Para registrar despesas gerais (notas fiscais)

### Problemas Identificados
| Problema | Impacto |
|----------|---------|
| Despesas pagas em dinheiro ficam como "pendente" | Tesoureiro precisa aprovar manualmente algo ja pago |
| Nao ha pergunta sobre forma de pagamento no CONTA_UNICA | Sistema nao sabe se dinheiro ja saiu do caixa |
| Fluxo confuso entre "Reembolso" vs "Conta" | Usuario nao sabe qual usar |

### Cenario Real
> Membro compra material com dinheiro do caixinha da igreja. Envia foto pelo WhatsApp.
> Hoje: Cria transacao com status "pendente" - tesoureiro precisa aprovar.
> Esperado: Baixa automatica pois dinheiro ja saiu.

---

## 2. Decisao

### Novo Fluxo: DESPESAS
Criar um terceiro fluxo unificado que:
1. Inicia com gatilho "despesas" ou "gastos"
2. Pergunta forma de pagamento ANTES de receber comprovantes
3. Processa fotos em loop ("Tem mais?")
4. Aplica baixa automatica para pagamentos em dinheiro/especie

### Logica de Baixa Automatica
```text
+----------------------------------------------------------+
| Forma de Pagamento   | Status          | data_pagamento  |
+----------------------------------------------------------+
| Dinheiro / Especie   | "pago"          | now()           |
| PIX (ja transferido) | "pago"          | now()           |
| Cartao / Boleto      | "pendente"      | null            |
| A definir            | "pendente"      | null            |
+----------------------------------------------------------+
```

---

## 3. Especificacao Tecnica

### 3.1 Alteracoes na Maquina de Estados

**Novos Estados:**
```typescript
type EstadoSessao =
  | "AGUARDANDO_FORMA_INICIAL"  // NOVO: Pergunta forma antes dos comprovantes
  | "AGUARDANDO_COMPROVANTES"
  | "AGUARDANDO_MAIS_DESPESAS"  // NOVO: Loop "Tem mais?"
  | "AGUARDANDO_DATA"
  | "AGUARDANDO_FORMA_PGTO"
  | "FINALIZADO";
```

**Novo Fluxo no MetaDados:**
```typescript
interface MetaDados {
  contexto: string;
  fluxo: "REEMBOLSO" | "CONTA_UNICA" | "DESPESAS";  // NOVO
  pessoa_id?: string;
  nome_perfil?: string;
  estado_atual: EstadoSessao;
  itens: ItemProcessado[];
  valor_total_acumulado: number;
  data_vencimento?: string;
  forma_pagamento?: "pix" | "dinheiro" | "cartao" | "boleto" | "a_definir";
  baixa_automatica?: boolean;  // NOVO
  resultado?: string;
}
```

### 3.2 Diagrama de Estados - Fluxo DESPESAS

```text
+-------------------+
| Usuario: DESPESAS |
+-------------------+
         |
         v
+---------------------------+
| AGUARDANDO_FORMA_INICIAL  |
| "Como foi pago?"          |
| 1. Dinheiro               |
| 2. PIX (ja transferido)   |
| 3. Cartao/Boleto          |
| 4. A definir (tesoureiro) |
+---------------------------+
         |
         v
+---------------------------+
| AGUARDANDO_COMPROVANTES   |
| "Envie a foto..."         |
+---------------------------+
         |
         | (recebe foto)
         v
+---------------------------+
| AGUARDANDO_MAIS_DESPESAS  |
| "Total: R$ X,XX"          |
| "Tem mais despesas? S/N"  |
+---------------------------+
         |
    +----+----+
    |         |
   SIM       NAO
    |         |
    v         v
  (loop)  +-----------+
          | FINALIZAR |
          +-----------+
                |
                v
      +---------------------+
      | Criar transacao(oes)|
      | status = pago/pend  |
      +---------------------+
```

### 3.3 Arquivo: `supabase/functions/chatbot-financeiro/index.ts`

**Modificacoes Necessarias:**

#### A. Adicionar Gatilho "DESPESAS" (linha ~528)
```typescript
// CENÁRIO A: SEM SESSÃO ATIVA
if (!sessao) {
  const texto = (mensagem || "").toLowerCase();
  const isReembolso = texto.includes("reembolso");
  const isContaUnica = texto.includes("conta") || texto.includes("nota");
  const isDespesas = texto.includes("despesa") || texto.includes("gasto");  // NOVO
  
  const isGatilho = isReembolso || isContaUnica || isDespesas;

  if (isDespesas) {
    // Iniciar fluxo DESPESAS - pergunta forma de pagamento primeiro
    const metaDadosInicial: MetaDados = {
      contexto: "FINANCEIRO",
      fluxo: "DESPESAS",
      pessoa_id: membroAutorizado.id,
      nome_perfil: nome_perfil || membroAutorizado.nome,
      estado_atual: "AGUARDANDO_FORMA_INICIAL",
      itens: [],
      valor_total_acumulado: 0,
    };

    await supabase.from("atendimentos_bot").insert({...});

    return new Response(JSON.stringify({
      text: `💸 Registro de Despesa iniciado!\n\n💳 *Como foi paga essa despesa?*\n\n1️⃣ Dinheiro/Espécie\n2️⃣ PIX (já transferido)\n3️⃣ Cartão/Boleto (a pagar)\n4️⃣ A definir pelo tesoureiro\n\nDigite o número da opção.`
    }));
  }
  // ... resto do código existente
}
```

#### B. Novo Estado: AGUARDANDO_FORMA_INICIAL
```typescript
// ========== ESTADO: AGUARDANDO_FORMA_INICIAL (NOVO) ==========
if (estadoAtual === "AGUARDANDO_FORMA_INICIAL") {
  const escolha = (mensagem || "").trim();
  let formaPagamento: string;
  let baixaAutomatica: boolean;

  switch (escolha) {
    case "1":
      formaPagamento = "dinheiro";
      baixaAutomatica = true;
      break;
    case "2":
      formaPagamento = "pix";
      baixaAutomatica = true;  // PIX já transferido = baixa
      break;
    case "3":
      formaPagamento = "cartao";
      baixaAutomatica = false;  // Aguarda confirmação
      break;
    case "4":
      formaPagamento = "a_definir";
      baixaAutomatica = false;
      break;
    default:
      return new Response(JSON.stringify({
        text: "⚠️ Opção inválida. Digite 1, 2, 3 ou 4."
      }));
  }

  await supabase.from("atendimentos_bot").update({
    meta_dados: {
      ...metaDados,
      estado_atual: "AGUARDANDO_COMPROVANTES",
      forma_pagamento: formaPagamento,
      baixa_automatica: baixaAutomatica,
    }
  }).eq("id", sessao.id);

  const textoForma = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao: "Cartão/Boleto",
    a_definir: "A definir"
  }[formaPagamento];

  return new Response(JSON.stringify({
    text: `✅ Forma: *${textoForma}*\n\n📸 Agora envie a(s) foto(s) dos comprovantes.\nDigite *Fechar* quando terminar.`
  }));
}
```

#### C. Modificar Finalizacao do Fluxo DESPESAS
```typescript
// No estado AGUARDANDO_COMPROVANTES, quando "Fechar"
if (metaDados.fluxo === "DESPESAS") {
  // Buscar conta padrão
  const { data: contaPadrao } = await supabase
    .from("contas")
    .select("id")
    .eq("ativo", true)
    .eq("igreja_id", igrejaId)
    .limit(1)
    .single();

  // Determinar status baseado na forma de pagamento
  const statusTransacao = metaDados.baixa_automatica ? "pago" : "pendente";
  const dataPagamento = metaDados.baixa_automatica 
    ? new Date().toISOString().split("T")[0] 
    : null;

  // Criar transações para cada item
  for (const item of metaDados.itens) {
    await supabase.from("transacoes_financeiras").insert({
      descricao: item.descricao || `Despesa - ${item.fornecedor || "WhatsApp"}`,
      valor: item.valor || 0,
      tipo: "saida",
      tipo_lancamento: "unico",
      data_vencimento: item.data_emissao || new Date().toISOString().split("T")[0],
      status: statusTransacao,               // NOVO: pago ou pendente
      data_pagamento: dataPagamento,         // NOVO: preenchido se baixa
      conta_id: contaPadrao.id,
      categoria_id: item.categoria_sugerida_id,
      subcategoria_id: item.subcategoria_sugerida_id,
      centro_custo_id: item.centro_custo_sugerido_id,
      anexo_url: item.anexo_storage,
      observacoes: `Fornecedor: ${item.fornecedor || "N/A"}\nOrigem: WhatsApp\nForma: ${metaDados.forma_pagamento}\nSolicitante: ${metaDados.nome_perfil}`,
      igreja_id: igrejaId,
    });
  }

  // Mensagem diferenciada por status
  const msgStatus = metaDados.baixa_automatica
    ? "💚 Baixa automática realizada!"
    : "⏳ Aguardando aprovação do tesoureiro.";

  return new Response(JSON.stringify({
    text: `✅ ${transacoesCriadas.length} despesa(s) registrada(s)!\n\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}\n💳 Forma: ${metaDados.forma_pagamento}\n\n${msgStatus}`
  }));
}
```

### 3.4 Mensagem de Boas-Vindas Atualizada (linha ~566)
```typescript
return new Response(JSON.stringify({
  text: "Olá! Sou o assistente financeiro. Para iniciar:\n\n• *Despesas* - registrar gastos (dinheiro, PIX, cartão)\n• *Reembolso* - solicitar ressarcimento pessoal\n• *Nova Conta* - registrar conta a pagar"
}));
```

---

## 4. Arquivo ADR a Criar

**Caminho:** `docs/adr/ADR-025-fluxo-despesas-baixa-automatica.md`

**Conteudo:**
- Contexto e problema
- Decisao de criar fluxo DESPESAS unificado
- Regras de baixa automatica por forma de pagamento
- Impacto no DRE (nao muda - fato gerador continua sendo a nota)
- Impacto no Caixa (transacao ja sai como "pago" para dinheiro)

---

## 5. Resumo das Alteracoes

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/chatbot-financeiro/index.ts` | MODIFICAR | Adicionar fluxo DESPESAS, estados novos, logica de baixa |
| `docs/adr/ADR-025-fluxo-despesas-baixa-automatica.md` | CRIAR | Documentar decisao arquitetural |

---

## 6. Casos de Teste

| Cenario | Entrada | Resultado Esperado |
|---------|---------|-------------------|
| Despesa em dinheiro | "despesas" -> "1" -> foto -> "fechar" | `status: "pago"`, `data_pagamento: hoje` |
| Despesa em PIX | "despesas" -> "2" -> foto -> "fechar" | `status: "pago"`, `data_pagamento: hoje` |
| Despesa cartao | "despesas" -> "3" -> foto -> "fechar" | `status: "pendente"`, `data_pagamento: null` |
| Despesa a definir | "despesas" -> "4" -> foto -> "fechar" | `status: "pendente"`, tesoureiro decide |
| Multiplas fotos | "despesas" -> "1" -> 3 fotos -> "fechar" | 3 transacoes, todas com baixa |
| Cancelamento | "despesas" -> "1" -> "cancelar" | Sessao encerrada, sem transacoes |

---

## 7. Estimativa de Implementacao

| Tarefa | Tempo |
|--------|-------|
| Criar ADR-025 documentacao | 10 min |
| Adicionar tipo DESPESAS e estados | 15 min |
| Implementar AGUARDANDO_FORMA_INICIAL | 20 min |
| Modificar finalizacao com baixa automatica | 20 min |
| Atualizar mensagem boas-vindas | 5 min |
| Testes manuais via WhatsApp | 30 min |
| **Total** | ~1h40 |

---

## 8. Consequencias

### Positivas
- Despesas em dinheiro nao precisam de aprovacao manual
- Fluxo mais intuitivo ("Despesas" cobre maioria dos casos)
- Caixa reflete realidade imediatamente
- Tesoureiro foca em aprovar apenas o que precisa

### Negativas
- Mais um fluxo para manter
- Risco de baixa indevida se usuario escolher errado

### Mitigacao de Riscos
- Mensagem clara sobre o que cada opcao significa
- Log completo na observacao da transacao (forma escolhida, origem WhatsApp)
- Tesoureiro pode estornar se necessario
