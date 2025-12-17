# Fluxo — Intercessão, Oração e Testemunhos

Diagrama visual (Mermaid) do fluxo do módulo Intercessão, cobrindo os 4 sub-módulos principais: Pedidos de Oração, Intercessores, Testemunhos e Sentimentos.

## 1. Fluxo Geral: Pedidos de Oração

```mermaid
flowchart TD
    Start([Membro/Visitante/Anônimo]) -->|Acessa Dashboard| A[Intercessão - Visão Geral]
    A -->|Clica 'Novo Pedido'| B[Dialog: Novo Pedido]
    B -->|Preenche Dados| C["Pedido criado: status=pendente"]
    
    C -->|Admin vê pendentes| D[Admin - Alocar Pedido]
    D -->|Seleciona Intercessor| E["Pedido: status=alocado<br/>data_alocacao=now()"]
    
    E -->|Intercessor recebe| F[Intercessor - Acompanha Pedido]
    F -->|Registra observações| G["Pedido: status=em_oracao"]
    
    G -->|Intercessor marca como respondido| H["Pedido: status=respondido<br/>data_resposta=now()"]
    
    H -->|Admin pode| I[Arquivar Pedido]
    I -->|Final| J["Pedido: status=arquivado"]
    
    style C fill:#fff3cd
    style E fill:#d1ecf1
    style G fill:#d4edda
    style H fill:#d4edda
    style J fill:#f8d7da
```

## 2. Fluxo: Intercessores (Equipe) — Entrada no Ministério

> **Atualização (2025-12-17)**: Intercessão agora é gerenciada como **Time** padrão.  
> Entrada/saída unificada no módulo de Times. Trigger sincroniza automaticamente com tabela `intercessores`.  
> Ver [ADR-011](../adr/ADR-011-evolucao-ministerio-intercessao.md).

```mermaid
flowchart TD
    Start([Líder de Intercessão]) -->|Acessa Módulo de Equipes| A[Times - Lista de Ministérios]
    A -->|Seleciona 'Intercessão'| B[Gerenciar Time - Dialog]
    B -->|Aba 'Membros'| C[Adicionar Membro ao Time]
    
    C -->|Busca pessoa na lista| D["Pessoa adicionada em membros_time"]
    
    D -->|Trigger detecta Time 'Intercessão'| E["Trigger: sync_membro_intercessor()"]
    E -->|Busca dados do perfil| F["Se user_id existe"]
    F -->|Sim| G["Insere/Reativa em intercessores<br/>ativo=true, max_pedidos=10"]
    F -->|Não| H["Não sincroniza<br/>(apenas membros com login)"]
    
    G -->|Sistema inicia Alocação Automática| I[Balancear Pedidos]
    I -->|Distribui pendentes respeitando max_pedidos| J["Pedidos alocados aos intercessores"]
    
    J -->|Admin pode ajustar na tela de Intercessão| K[Editar/Inativar Intercessor]
    K -->|Inativa| L["Intercessor: ativo=false<br/>não recebe novos pedidos"]
    
    K -->|Ativa| M["Intercessor: ativo=true<br/>volta a receber pedidos"]
    
    style D fill:#fff3cd
    style G fill:#d4edda
    style J fill:#d1ecf1
    style L fill:#f8d7da
    style M fill:#d4edda
```

**Mudança de comportamento:**
- **Antes**: Líder adicionava intercessor via tela específica "Novo Intercessor" (campos manuais).
- **Depois**: Líder adiciona membro ao Time "Intercessão" (módulo de Equipes) → Trigger sincroniza automaticamente.
- **Lógica de negócio**: Mantida na tabela `intercessores` para distribuição de pedidos.

## 3. Fluxo: Testemunhos

```mermaid
flowchart TD
    Start([Membro]) -->|Acessa Testemunho| A[Intercessão - Testemunhos]
    A -->|Clica 'Novo Testemunho'| B[Dialog: Novo Testemunho]
    B -->|Preenche Título, Categoria, Mensagem| C["Testemunho criado: status=aberto"]
    
    C -->|Admin recebe notificação| D[Admin - Aprovação]
    D -->|Revisa conteúdo| E["Opções: Aprovar ou Arquivar"]
    
    E -->|Aprova| F["Testemunho: status=publico<br/>data_publicacao=now()"]
    F -->|Aparece em Dashboard| G[Carrossel de Testemunhos<br/>para todos membros]
    
    E -->|Arquiva| H["Testemunho: status=arquivado"]
    
    style C fill:#fff3cd
    style F fill:#d4edda
    style G fill:#e2e3e5
    style H fill:#f8d7da
```

## 4. Fluxo: Sentimentos & Alertas Críticos

```mermaid
flowchart TD
    Start([Membro]) -->|Recebe Notificação às 9h| A["Notificação: Como você está?"]
    A -->|Clica| B[Dialog: Registrar Sentimento]
    B -->|Seleciona Sentimento| C["Sentimento registrado<br/>em sentimentos_membros"]
    
    C -->|Sistema Analisa| D{"Sentimento Positivo?"}
    
    D -->|Sim: feliz/grato/abençoado| E["Sugestão: Compartilhar Testemunho?<br/>Link para novo testemunho"]
    E -->|Membro clica| F[Novo Testemunho]
    
    D -->|Não: triste/ansioso/angustiado| G["Sugestão: Fazer Pedido de Oração?<br/>Link para novo pedido"]
    G -->|Membro clica| H[Novo Pedido]
    
    C -->|Sistema verifica| I{"3+ dias<br/>sentimentos negativos?"}
    
    I -->|Sim| J["ALERTA CRÍTICO: Membro em Risco"]
    J -->|Admin visualiza| K[Dashboard - Alertas Críticos]
    K -->|Mostra Nome, Contato, Link WhatsApp| L[Admin pode enviar apoio]
    
    I -->|Não| M[Registro normal]
    
    style C fill:#d4edda
    style E fill:#fff3cd
    style G fill:#fff3cd
    style J fill:#f8d7da
    style K fill:#f8d7da
```

## 5. Diagrama de Casos de Uso (Visão Geral)

```mermaid
graph LR
    Membro[Membro] -->|Criar| Pedido["Pedido de Oração"]
    Membro -->|Enviar| Testemunho["Testemunho"]
    Membro -->|Registrar| Sentimento["Sentimento Diário"]
    
    Visitante[Visitante/Anônimo] -->|Criar| Pedido
    
    Intercessor[Intercessor] -->|Acompanha| Pedido
    Intercessor -->|Registra| Observacoes["Observações"]
    Observacoes -->|Marca como| Respondido["Respondido"]
    
    Admin[Admin/Pastor] -->|Gerencia| Equipe["Intercessores"]
    Admin -->|Aloca| Pedido
    Admin -->|Aprova| Testemunho
    Admin -->|Monitora| AlertasCriticos["Alertas Críticos<br/>3+ dias negativos"]
    
    Pedido -->|Ciclo| Pendente["Pendente → Alocado →<br/>Em Oração → Respondido"]
    Testemunho -->|Ciclo| Aberto["Aberto → Público<br/>ou Arquivado"]
    
    style Pedido fill:#d1ecf1
    style Testemunho fill:#fff3cd
    style Sentimento fill:#d4edda
    style AlertasCriticos fill:#f8d7da
    style Equipe fill:#e2e3e5
```

## Legenda de Cores

- **Azul claro** (`#d1ecf1`): Pedidos de oração
- **Amarelo** (`#fff3cd`): Testemunhos / Sugestões
- **Verde claro** (`#d4edda`): Ações positivas / Registros normais
- **Vermelho claro** (`#f8d7da`): Alertas críticos / Arquivamentos
- **Cinza claro** (`#e2e3e5`): Dados/exibições genéricas

---

**Referências**:
- Manual do Usuário (Seção 6): [`../manual-usuario.md#6-intercessão`](../manual-usuario.md#6-intercessão)
- Funcionalidades: [`../funcionalidades.md#4-intercessão-oração-e-testemunhos`](../funcionalidades.md#4-intercessão-oração-e-testemunhos)
- Arquitetura: [`../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)
