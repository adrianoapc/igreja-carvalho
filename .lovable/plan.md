
# Plano: Reestruturação Completa do Fluxo de Inscrição no Chatbot de Triagem

## Objetivo

Transformar o `chatbot-triagem` de um fluxo "IA-first" (toda mensagem passa pela IA) para um fluxo **híbrido inteligente** que:
1. Verifica sessão existente ANTES de chamar IA
2. Usa regras determinísticas para respostas SIM/NÃO
3. Integra busca de eventos e fuzzy match diretamente
4. Só aciona IA para classificação inicial ou casos ambíguos

---

## Arquitetura do Novo Fluxo

```text
┌─────────────────────────────────────────────────────────────────┐
│                     MENSAGEM RECEBIDA                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. VERIFICAR SESSÃO ATIVA                                      │
│     • Buscar em atendimentos_bot (telefone + igreja_id)         │
│     • Verificar timeout 24h                                     │
│     • Checar meta_dados.flow                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
    TEM SESSÃO COM FLOW?          NÃO TEM / SEM FLOW
          │                             │
          ▼                             ▼
┌─────────────────────┐   ┌─────────────────────────────────────┐
│ 2A. HANDLER DIRETO  │   │ 2B. CLASSIFICAR COM IA              │
│ • Sem reclassificar │   │ • Detecta intenção                  │
│ • Regras determinis.│   │ • Cria sessão com flow              │
└─────────┬───────────┘   └──────────────────┬──────────────────┘
          │                                  │
          └──────────────┬───────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. FLUXO DE INSCRIÇÃO (quando flow = "inscricao")              │
│                                                                 │
│  STEP inicial:                                                  │
│   • Buscar eventos abertos (igreja_id + status + data)          │
│   • Fuzzy match pelo texto do usuário                           │
│   • 0 eventos → "Sem inscrições abertas" + encerra              │
│   • 1 evento ou match exato → ir para confirmação               │
│   • N eventos → listar para escolha                             │
│                                                                 │
│  STEP selecionando_evento:                                      │
│   • Detectar número digitado (regex)                            │
│   • Selecionar evento da lista                                  │
│                                                                 │
│  STEP confirmando_dados:                                        │
│   • "SIM" (regex) → finalizar inscrição                         │
│   • "NÃO" (regex) → pedir correção                              │
│   • Ambíguo → repetir pergunta                                  │
│                                                                 │
│  STEP correcao:                                                 │
│   • Capturar novo nome                                          │
│   • Voltar para confirmação                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhamento Técnico

### Arquivo: `supabase/functions/chatbot-triagem/index.ts`

#### 1. Nova Interface para Estado de Sessão

```typescript
interface SessionMeta {
  flow?: "inscricao" | "oracao" | "testemunho" | "pastoral" | null;
  step?: string;
  evento_id?: string;
  evento_titulo?: string;
  nome_confirmado?: string;
  eventos_disponiveis?: Array<{ id: string; titulo: string }>;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
}
```

#### 2. Funções Auxiliares Determinísticas (SEM IA)

```typescript
// Detectar SIM/NÃO sem chamar IA
const isAfirmativo = (text: string) =>
  /^(sim|s|ok|isso|confirmo|confirmar|pode|certo|correto|confirma|isso\s*mesmo)$/i.test(text.trim());

const isNegativo = (text: string) =>
  /^(nao|não|n|errado|corrigir|cancelar|cancela|mudar|incorreto)$/i.test(text.trim());

// Fuzzy match de evento (sua versão corrigida)
function inferirEvento(eventos: Array<{id: string; titulo: string}>, textoUsuario: string) {
  const textoNorm = textoUsuario.toLowerCase().trim();
  
  const eventoExato = eventos.find(e => {
    const titulo = e.titulo.toLowerCase();
    return (
      textoNorm.includes(titulo) ||
      (titulo.includes("compartilhe") && textoNorm.includes("compartilhe"))
    );
  });
  
  return eventoExato || null;
}
```

#### 3. Função para Buscar Eventos Abertos

```typescript
async function buscarEventosAbertos(
  supabase: SupabaseClient,
  igrejaId: string,
  filialId: string | null
): Promise<Array<{ id: string; titulo: string; data_evento: string }>> {
  const agora = new Date().toISOString();
  
  let query = supabase
    .from("eventos")
    .select("id, titulo, data_evento, vagas_limite, requer_pagamento, inscricoes_abertas_ate")
    .eq("igreja_id", igrejaId)
    .eq("status", "confirmado")
    .eq("requer_inscricao", true)
    .gte("data_evento", agora)
    .order("data_evento", { ascending: true })
    .limit(10);
  
  if (filialId) {
    query = query.eq("filial_id", filialId);
  }
  
  const { data: eventos } = await query;
  
  // Filtrar eventos com inscrições ainda abertas
  return (eventos || []).filter(e => 
    !e.inscricoes_abertas_ate || e.inscricoes_abertas_ate >= agora
  );
}
```

#### 4. Novo Fluxo Principal (Simplificado)

O fluxo principal será refatorado para:

```typescript
// PASSO 1: Buscar sessão existente
// (código atual já faz isso)

// PASSO 2: NOVO - Verificar se sessão tem flow definido
const meta = (sessao?.meta_dados || {}) as SessionMeta;

if (sessao && meta.flow) {
  // HANDLER DIRETO - sem chamar IA para reclassificar
  switch (meta.flow) {
    case "inscricao":
      return await handleFluxoInscricao(sessao, meta, inputTexto, supabase, igrejaId, filialId, nome_perfil);
    
    case "oracao":
    case "testemunho":
    case "pastoral":
      // Continua com IA, mas NÃO reclassifica intenção
      // Apenas coleta dados adicionais
      break;
  }
}

// PASSO 3: Sem sessão ou sem flow → classificar com IA (código atual)
// ... chamada IA ...

// PASSO 4: NOVO - Se detectou INSCRICAO_EVENTO, iniciar fluxo integrado
if (parsedJson?.intencao === "INSCRICAO_EVENTO") {
  return await iniciarFluxoInscricao(sessao, inputTexto, supabase, igrejaId, filialId, nome_perfil);
}
```

#### 5. Handler de Inscrição Integrado

```typescript
async function handleFluxoInscricao(
  sessao: any,
  meta: SessionMeta,
  texto: string,
  supabase: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
  nomePerfil: string
) {
  const step = meta.step || "inicial";
  const textoNorm = texto.toLowerCase().trim();

  // STEP: Usuário escolhendo de uma lista de eventos
  if (step === "selecionando_evento" && meta.eventos_disponiveis) {
    const escolha = parseInt(textoNorm);
    if (!isNaN(escolha) && escolha >= 1 && escolha <= meta.eventos_disponiveis.length) {
      const eventoEscolhido = meta.eventos_disponiveis[escolha - 1];
      await atualizarMetaSessao(supabase, sessao.id, {
        ...meta,
        step: "confirmando_dados",
        evento_id: eventoEscolhido.id,
        evento_titulo: eventoEscolhido.titulo,
        nome_confirmado: nomePerfil
      });
      
      return respostaJson(`Evento: *${eventoEscolhido.titulo}*\n\nSeus dados:\nNome: ${nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`);
    }
    return respostaJson(`Por favor, digite o número do evento (1 a ${meta.eventos_disponiveis.length}).`);
  }

  // STEP: Confirmação de dados (SEM IA!)
  if (step === "confirmando_dados") {
    if (isAfirmativo(textoNorm)) {
      // Delegar para inscricao-compartilhe com evento já definido
      return await delegarParaInscricao(sessao, meta, supabase, igrejaId, filialId);
    }
    if (isNegativo(textoNorm)) {
      await atualizarMetaSessao(supabase, sessao.id, { ...meta, step: "correcao" });
      return respostaJson("Qual o nome correto para a inscrição?");
    }
    // Resposta ambígua
    return respostaJson(`Nome: ${meta.nome_confirmado || nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`);
  }

  // STEP: Correção de dados
  if (step === "correcao") {
    const nomeCorrigido = texto.trim();
    if (nomeCorrigido.length < 2) {
      return respostaJson("Por favor, envie o nome correto.");
    }
    await atualizarMetaSessao(supabase, sessao.id, { 
      ...meta, 
      step: "confirmando_dados", 
      nome_confirmado: nomeCorrigido 
    });
    return respostaJson(`Nome: ${nomeCorrigido}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`);
  }

  // Fallback: reiniciar fluxo
  return await iniciarFluxoInscricao(sessao, texto, supabase, igrejaId, filialId, nomePerfil);
}
```

#### 6. Inicialização do Fluxo de Inscrição

```typescript
async function iniciarFluxoInscricao(
  sessao: any,
  texto: string,
  supabase: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
  nomePerfil: string
) {
  const eventos = await buscarEventosAbertos(supabase, igrejaId, filialId);
  
  // CENÁRIO 1: Sem eventos
  if (eventos.length === 0) {
    await supabase.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
    return respostaJson("No momento não temos eventos com inscrições abertas, mas agradecemos muito seu contato! 🙏");
  }
  
  // CENÁRIO 2: Tentar inferir evento pelo texto
  const eventoInferido = inferirEvento(eventos, texto);
  
  if (eventoInferido || eventos.length === 1) {
    const evento = eventoInferido || eventos[0];
    await atualizarMetaSessao(supabase, sessao.id, {
      flow: "inscricao",
      step: "confirmando_dados",
      evento_id: evento.id,
      evento_titulo: evento.titulo,
      nome_confirmado: nomePerfil
    });
    
    return respostaJson(`Encontrei o evento *${evento.titulo}*! 🎉\n\nSeus dados:\nNome: ${nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`);
  }
  
  // CENÁRIO 3: Múltiplos eventos, listar para escolha
  const lista = eventos.slice(0, 5).map((e, i) => `${i + 1}. ${e.titulo}`).join("\n");
  
  await atualizarMetaSessao(supabase, sessao.id, {
    flow: "inscricao",
    step: "selecionando_evento",
    eventos_disponiveis: eventos.slice(0, 5).map(e => ({ id: e.id, titulo: e.titulo })),
    nome_confirmado: nomePerfil
  });
  
  return respostaJson(`Temos ${eventos.length} eventos com inscrições abertas:\n\n${lista}\n\nDigite o *número* do evento desejado.`);
}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | Refatoração completa: verificação de flow antes da IA, handlers determinísticos, busca integrada de eventos, fuzzy match |

## Comparativo Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| SIM/NÃO do usuário | Passa pela IA | Regex direto (~0ms) |
| Sessão com flow ativo | Reclassifica toda mensagem | Handler direto sem IA |
| Seleção de evento | Delegava cegamente | Busca eventos + fuzzy match |
| Múltiplos eventos | Não suportado | Lista opções numeradas |
| Sem eventos | Erro ou resposta genérica | Mensagem amigável + encerra |
| Custo de tokens | Alto (IA em toda mensagem) | Reduzido (~60-80%) |

## Benefícios

1. **Performance**: Respostas SIM/NÃO são instantâneas (sem IA)
2. **Custo**: Menos chamadas à IA = economia de tokens
3. **Consistência**: Flow definido não muda no meio da conversa
4. **Flexibilidade**: Suporta múltiplos eventos com seleção
5. **UX**: Experiência mais fluida e previsível
6. **Debug**: Logs claros em cada etapa do fluxo

## Testes Recomendados

1. Enviar "COMPARTILHE" → deve buscar eventos e iniciar fluxo
2. Com 1 evento → vai direto para confirmação de dados
3. Com N eventos → lista opções numeradas
4. Responder "SIM" → finaliza sem chamar IA
5. Responder "NÃO" → pede nome correto
6. Digitar nome → volta para confirmação
7. Sem eventos abertos → mensagem amigável e encerra
8. Timeout 24h → cria nova sessão
