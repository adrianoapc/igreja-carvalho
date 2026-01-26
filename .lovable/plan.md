

# Plano: Verificação de Inscrição + Lista de Espera Interna

## Resumo

Corrigir o bug de inscrição existente e implementar lista de espera **interna** para gestão pela equipe, sem expor detalhes da fila ao usuário.

---

## Alterações no Comportamento

### Resposta ao Usuário (Vagas Esgotadas)

**Antes (proposta anterior)**:
> "Vagas esgotadas! Você está na posição 5º da lista de espera."

**Agora (ajustado)**:
> "As vagas para este evento estão esgotadas, mas registramos seu interesse! Caso surja uma vaga, entraremos em contato."

A posição na fila é **somente visível internamente** para a equipe.

---

## Estrutura da Tabela

```sql
CREATE TABLE public.evento_lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  telefone varchar(50) NOT NULL,
  email varchar(255),
  posicao_fila integer NOT NULL DEFAULT 1,
  status varchar(20) DEFAULT 'aguardando',
  -- aguardando: na fila
  -- contatado: equipe entrou em contato
  -- convertido: virou inscrição
  -- expirado: não respondeu / desistiu
  visitante_lead_id uuid REFERENCES visitantes_leads(id),
  pessoa_id uuid REFERENCES profiles(id),
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid REFERENCES filiais(id),
  created_at timestamptz DEFAULT now(),
  contatado_em timestamptz,
  observacoes text,
  
  UNIQUE(evento_id, telefone)
);

CREATE INDEX idx_lista_espera_evento_status ON evento_lista_espera(evento_id, status);
CREATE INDEX idx_lista_espera_posicao ON evento_lista_espera(evento_id, posicao_fila);

ALTER TABLE evento_lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Igreja members can manage" ON evento_lista_espera
  FOR ALL USING (
    igreja_id IN (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  );
```

---

## Configuração Opcional por Evento

Adicionar campo na tabela `eventos`:

```sql
ALTER TABLE public.eventos
ADD COLUMN mostrar_posicao_fila boolean DEFAULT false;
```

Se `mostrar_posicao_fila = true`, informa a posição ao usuário. Caso contrário (padrão), apenas registra internamente.

---

## Fluxo no Chatbot

```text
+------------------------------------------------------------------+
| 1. Buscar pessoa pelo telefone                                   |
+------------------------------------------------------------------+
| 2. SE pessoa existe e inscrita -> Retorna QR existente           |
+------------------------------------------------------------------+
| 3. Verificar vagas disponíveis                                   |
+------------------------------------------------------------------+
| 4. SE vagas esgotadas:                                           |
|    +----------------------------------------------------+        |
|    | - Criar/atualizar lead em visitantes_leads         |        |
|    | - Verificar se já está na lista de espera          |        |
|    |   - SE sim: "Já registramos seu interesse!"        |        |
|    |   - SE não: Inserir na fila                        |        |
|    | - Retornar mensagem genérica (sem posição)         |        |
|    +----------------------------------------------------+        |
+------------------------------------------------------------------+
| 5. SE vagas disponíveis -> Criar inscrição + retornar QR         |
+------------------------------------------------------------------+
```

---

## Mensagens ao Usuário

| Cenário | Mensagem |
|---------|----------|
| Já inscrito | "Você já está inscrito! Seu QR Code: [link]" |
| Vagas esgotadas (1ª vez) | "As vagas estão esgotadas, mas registramos seu interesse! Caso surja uma vaga, entraremos em contato." |
| Vagas esgotadas (já na lista) | "Seu interesse já foi registrado anteriormente! Caso surja uma vaga, entraremos em contato." |
| Inscrito com sucesso | "Inscrição confirmada! Seu QR Code: [link]" |

---

## Código da Função `finalizarInscricao`

```typescript
// Quando vagas esgotadas...
if ((count || 0) >= evento.vagas_limite) {
  // Criar/buscar lead
  let leadId = await buscarOuCriarLead(telefone, nomeConfirmado, igrejaId, filialId);

  // Verificar se já está na lista
  const { data: jaEspera } = await supabaseClient
    .from("evento_lista_espera")
    .select("id")
    .eq("evento_id", evento.id)
    .eq("telefone", telefone)
    .maybeSingle();

  if (jaEspera) {
    await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
    return respostaJson(
      `Seu interesse já foi registrado anteriormente! 📋\n\nCaso surja uma vaga, entraremos em contato.`
    );
  }

  // Calcular posição (interno)
  const { count: posicaoAtual } = await supabaseClient
    .from("evento_lista_espera")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", evento.id);

  const posicao = (posicaoAtual || 0) + 1;

  // Inserir na lista
  await supabaseClient.from("evento_lista_espera").insert({
    evento_id: evento.id,
    nome: nomeConfirmado,
    telefone,
    posicao_fila: posicao,
    status: "aguardando",
    visitante_lead_id: leadId,
    pessoa_id: pessoaId,
    igreja_id: igrejaId,
    filial_id: filialId,
  });

  await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);

  // Mensagem genérica (sem posição) - ou com posição se configurado
  let mensagem = `As vagas para "${evento.titulo}" estão esgotadas, mas registramos seu interesse! 📋\n\nCaso surja uma vaga, entraremos em contato.`;
  
  if (evento.mostrar_posicao_fila) {
    mensagem = `As vagas estão esgotadas, mas você foi adicionado à lista de espera! 📋\n\nSua posição: ${posicao}º\n\nCaso surja uma vaga, entraremos em contato.`;
  }

  return respostaJson(mensagem);
}
```

---

## Uso Interno pela Equipe

### Fluxo de Trabalho

1. **Cancelamento/Não Pagamento** acontece
2. Equipe acessa lista de espera do evento
3. Contata pessoa na **posição 1** da fila
4. Atualiza status para "contatado"
5. Se pessoa aceitar: cria inscrição, marca como "convertido"
6. Se não responder/recusar: marca como "expirado", passa para próximo

### Interface Futura (não neste escopo)

```text
+-----------------------------------------------------+
| Lista de Espera - Compartilhe 2026                  |
+-----------------------------------------------------+
| 📋 15 aguardando | ✓ 3 convertidos | ✗ 2 expirados  |
+-----------------------------------------------------+
| Pos | Nome           | Telefone        | Status     |
|-----|----------------|-----------------|------------|
| 1   | Maria Silva    | (17) 99999-1111 | Aguardando |
| 2   | João Santos    | (17) 99888-2222 | Contatado  |
| 3   | Ana Costa      | (17) 99777-3333 | Aguardando |
+-----------------------------------------------------+
| Ações: [Marcar Contatado] [Converter em Inscrição]  |
+-----------------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Banco de Dados** | Criar tabela `evento_lista_espera` + campo `mostrar_posicao_fila` em `eventos` |
| `supabase/functions/chatbot-triagem/index.ts` | Reordenar validações + inserir na lista de espera |

---

## Ordem de Implementação

1. Migração de banco: criar tabela `evento_lista_espera`
2. Migração de banco: adicionar campo `mostrar_posicao_fila` em `eventos`
3. Atualizar `chatbot-triagem/index.ts`:
   - Verificar inscrição existente ANTES de vagas
   - Adicionar lógica de lista de espera interna
4. (Futuro) Interface de gestão da lista de espera

---

## Benefícios

- **Zero leads perdidos**: Todo interessado é capturado
- **Gestão interna**: Equipe controla a fila sem expor detalhes
- **Flexibilidade**: Configurável se quer mostrar posição ou não
- **CRM enriquecido**: Leads com interesse específico por evento
- **Processo organizado**: Contato por ordem de chegada

