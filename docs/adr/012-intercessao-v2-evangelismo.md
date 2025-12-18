# ADR-012: Módulo Intercessão V2, CRM de Evangelismo e Chatbot IA

* **Status:** Aceito
* **Data:** 18/12/2025
* **Decisores:** Adriano, Arquitetura de Sistemas
* **Contexto:**
    O sistema atual de Intercessão (V1) opera em modelo "Passivo" (Lista de Pedidos), sem integração automatizada com o mundo externo, sem controle de carga de trabalho dos voluntários e sem distinção clara entre o cuidado pastoral de membros e o evangelismo de visitantes. Além disso, há a necessidade de compliance jurídico (LGPD) e auditoria nas conversas automatizadas.

## Decisão

Decidimos evoluir o módulo para uma arquitetura **Centrada no Supabase** (V2), onde a inteligência sai do Make e vai para **Edge Functions** e **Banco de Dados**, transformando o sistema em um **Hub de Cuidado e Evangelismo**.

### 1. Arquitetura de Chatbot e Triagem (IA)
* **Mudança de Fluxo:** O Make (Integromat) deixa de conter a lógica de negócio. Ele atuará apenas como "Dumb Pipe" (Gateway), recebendo o Webhook do WhatsApp (WABA) e repassando o payload cru para uma Edge Function (`/processar-atendimento`).
* **Janela de 24h:** A interação de triagem ocorrerá via código para manter a conversa dentro da janela de serviço (Service Window), reduzindo custos com Templates.
* **Sessão de Estado:** Criaremos uma tabela `atendimentos_bot` para gerenciar o estado da conversa (State Machine), permitindo que a IA mantenha contexto das mensagens anteriores.
* **Guardrails da IA:** O System Prompt terá regras estritas para:
    * Não realizar aconselhamento teológico ou promessas de cura.
    * Detectar risco de vida (Suicídio/Crime) e escalar para humano imediatamente.
    * Compilar o **Texto na Íntegra** (para contexto de oração) além de gerar o Resumo/Categoria.

### 2. CRM de Evangelismo (Bifurcação de Fluxo)
O sistema identificará automaticamente a origem do solicitante baseando-se no telefone (`profiles`):
* **Membro Identificado:** O pedido é vinculado ao perfil existente. Entra no fluxo de **Cuidado Pastoral**.
* **Novo Contato (Visitante):**
    * O pedido é criado como "Externo/Anônimo" (se solicitado).
    * O contato é salvo automaticamente numa nova tabela `visitantes` (Lead).
    * Entra no fluxo de **Evangelismo** (Funil: Novo > Em Oração > Contato Realizado > Visitante > Membro).

### 3. Distribuição de Carga (Load Balance de Intercessores)
Substituímos o modelo de "Puxar Pedidos" por um algoritmo de distribuição inteligente "Health-First":
* **Algoritmo:** *Least Connections* (Menor Conexões). Prioriza intercessores com menor carga atual, respeitando o limite (`max_pedidos`).
* **Status de Disponibilidade:** Inclusão de status `PAUSA` e `FERIAS` para o intercessor. O sistema ignora voluntários em pausa, prevenindo burnout.
* **Devolução:** O intercessor terá permissão para "Devolver" um pedido à fila geral se não puder orar por aquele tema específico.

### 4. Compliance Jurídico e Segurança
* **Audit Log Imutável:** Criação da tabela `logs_auditoria_chat` com permissão *Append-Only* (apenas inserção via sistema). Armazena o JSON cru de cada mensagem para fins de prova jurídica.
* **Consentimento (Opt-in):** A primeira mensagem do bot conterá aviso de privacidade e identidade virtual.
* **Privacidade (Proxy):** O intercessor **nunca** recebe o telefone do solicitante externo diretamente. A comunicação de "Orei por você" é feita via sistema (Bot ou Push), protegendo a identidade de ambos.

## Detalhes Técnicos

### Schema de Banco de Dados (Novas Tabelas)

```sql
-- Controle de Sessão do Chatbot
CREATE TABLE atendimentos_bot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telefone VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'INICIADO', -- INICIADO, COLETANDO, CONCLUIDO, ERRO
    historico_conversa JSONB DEFAULT '[]', -- Contexto para a IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Funil de Evangelismo
CREATE TABLE visitantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR,
    telefone VARCHAR UNIQUE NOT NULL,
    origem VARCHAR DEFAULT 'WABA_ORACAO',
    estagio_funil VARCHAR DEFAULT 'NOVO', -- NOVO, EM_ORACAO, CONTATO, VISITOU
    data_ultimo_contato TIMESTAMP
);

-- Auditoria Jurídica (Append-Only)
CREATE TABLE logs_auditoria_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id UUID REFERENCES atendimentos_bot(id),
    ator VARCHAR NOT NULL, -- 'USER' ou 'BOT'
    payload_raw JSONB NOT NULL, -- Mensagem exata recebida/enviada
    timestamp_exato TIMESTAMP DEFAULT NOW()
);
-- RLS: Ninguém pode fazer UPDATE ou DELETE nesta tabela.
