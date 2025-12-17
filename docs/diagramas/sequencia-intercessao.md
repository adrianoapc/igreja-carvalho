# Sequência — Intercessão, Oração e Testemunhos

Diagrama de sequência (Mermaid) mostrando a troca de mensagens entre Frontend, Supabase e banco de dados para as operações principais do módulo.

## 1. Sequência: Criar Pedido de Oração (Membro)

```mermaid
sequenceDiagram
    actor Membro as Membro (Frontend)
    participant Dialog as Dialog: NovoPedidoDialog
    participant TQ as TanStack Query
    participant Supa as Supabase Client
    participant DB as Postgres: pedidos_oracao
    
    Membro->>Dialog: Preenche formulário (pedido, tipo, anônimo)
    Membro->>Dialog: Clica "Enviar"
    
    Dialog->>TQ: Mutation: INSERT into pedidos_oracao
    TQ->>Supa: POST /rest/v1/pedidos_oracao (POST)
    Supa->>DB: INSERT pedido com status='pendente'
    
    DB-->>Supa: Retorna pedido com id, data_criacao
    Supa-->>TQ: { id, pedido, tipo, status, pessoa_id, ... }
    TQ-->>Dialog: Sucesso ✓
    
    Dialog->>Dialog: Exibe feedback: "Pedido enviado com sucesso"
    Dialog-->>Membro: Fecha dialog + refetch listagem
    
    Note over Membro,DB: RLS valida: membro_id = auth.uid() ou pessoa_id = auth.uid()
```

## 2. Sequência: Admin Aloca Pedido a Intercessor

```mermaid
sequenceDiagram
    actor Admin as Admin (Frontend)
    participant Dialog as Dialog: PedidoDetailsDialog
    participant TQ as TanStack Query
    participant Supa as Supabase Client
    participant DB as Postgres
    
    Admin->>Dialog: Abre detalhes de pedido pendente
    
    Dialog->>TQ: Query: SELECT * FROM pedidos_oracao WHERE id = ?
    TQ->>Supa: GET /rest/v1/pedidos_oracao?id=eq.{id}
    Supa->>DB: SELECT com RLS (admin vê todos)
    DB-->>Supa: Retorna pedido completo
    Supa-->>TQ: Dados do pedido
    TQ-->>Dialog: Renderiza detalhes + dropdown de intercessores
    
    Dialog->>TQ: Query: SELECT * FROM intercessores WHERE ativo=true
    TQ->>Supa: GET /rest/v1/intercessores?ativo=eq.true
    Supa-->>TQ: Lista de intercessores com carga atual
    TQ-->>Dialog: Popula dropdown ordenado por carga
    
    Admin->>Dialog: Seleciona intercessor + clica "Alocar"
    
    Dialog->>TQ: Mutation: UPDATE pedidos_oracao SET intercessor_id=?, status='alocado', data_alocacao=now()
    TQ->>Supa: PATCH /rest/v1/pedidos_oracao
    Supa->>DB: UPDATE status, intercessor_id, data_alocacao
    DB-->>Supa: Retorna pedido atualizado
    Supa-->>TQ: { status: 'alocado', intercessor_id, data_alocacao, ... }
    TQ-->>Dialog: Sucesso ✓
    
    Dialog->>Dialog: Feedback: "Pedido alocado"
    Dialog-->>Admin: Fecha + refetch listagem
    
    Note over Admin,DB: RLS valida: admin vê/edita tudo
```

## 3. Sequência: Intercessor Atualiza Observações e Status

```mermaid
sequenceDiagram
    actor Intercessor as Intercessor (Frontend)
    participant List as Listagem: /intercessao/pedidos
    participant Dialog as Dialog: PedidoDetailsDialog
    participant TQ as TanStack Query
    participant Supa as Supabase Client
    participant DB as Postgres
    
    Intercessor->>List: Acessa /intercessao/pedidos
    
    List->>TQ: Query: SELECT * FROM pedidos_oracao WHERE intercessor_id = auth.uid()
    TQ->>Supa: GET /rest/v1/pedidos_oracao?intercessor_id=eq.{auth.uid()}
    Supa->>DB: SELECT com RLS (Intercessor vê alocados a si)
    DB-->>Supa: Retorna pedidos alocados
    Supa-->>TQ: Lista de pedidos
    TQ-->>List: Renderiza tabela
    
    Intercessor->>List: Clica em pedido para detalhar
    List->>Dialog: Abre PedidoDetailsDialog
    
    Dialog->>Dialog: Exibe dados + campo "Observações do Intercessor"
    Intercessor->>Dialog: Escreve observação + clica "Marcar como Em Oração"
    
    Dialog->>TQ: Mutation: UPDATE pedidos_oracao SET status='em_oracao', observacoes_intercessor=?
    TQ->>Supa: PATCH /rest/v1/pedidos_oracao
    Supa->>DB: UPDATE status, observacoes_intercessor
    DB-->>Supa: Retorna pedido com status='em_oracao'
    Supa-->>TQ: Sucesso
    TQ-->>Dialog: Refetch pedido
    
    Dialog->>Dialog: Atualiza exibição: "Status: Em Oração"
    Dialog-->>Intercessor: Botão agora é "Marcar como Respondido"
    
    Note over Intercessor,DB: RLS valida: UPDATE permitido apenas se intercessor_id = auth.uid()
```

## 4. Sequência: Registrar Sentimento + Redirecionamento Inteligente

```mermaid
sequenceDiagram
    actor Membro as Membro (Frontend)
    participant Notif as Notificação Push (9h)
    participant Dialog as Dialog: RegistrarSentimentoDialog
    participant TQ as TanStack Query
    participant Supa as Supabase Client
    participant DB as Postgres
    
    Notif-->>Membro: Notificação às 9h: "Como você está?"
    Membro->>Notif: Clica na notificação
    Notif->>Dialog: Abre dialog de registro
    
    Dialog->>Dialog: Exibe opções (radio buttons/emojis)
    Membro->>Dialog: Seleciona "Feliz" + clica "Registrar"
    
    Dialog->>TQ: Mutation: INSERT into sentimentos_membros
    TQ->>Supa: POST /rest/v1/sentimentos_membros { pessoa_id, sentimento='feliz', ... }
    Supa->>DB: INSERT sentimento
    DB-->>Supa: Retorna sentimento com id, data_registro
    Supa-->>TQ: { id, pessoa_id, sentimento, ... }
    TQ-->>Dialog: Sucesso ✓
    
    Dialog->>Dialog: Analisa sentimento (if positivo)
    Dialog->>Dialog: Exibe sugestão: "Compartilhar Testemunho?"
    Dialog->>Dialog: Renderiza botão com link para `/intercessao/testemunhos?novo=true`
    
    Membro->>Dialog: Clica em "Sim, compartilhar"
    Dialog->>Dialog: Navega para novo testemunho
    Dialog-->>Membro: Novo diálogo: NovoTestemunhoDialog (pré-populado se possível)
    
    Note over Membro,DB: RLS valida: pessoa_id = auth.uid() para INSERT
    Note over Membro,DB: Redirecionamento inteligente: lógica frontend
    Note over Membro,DB: Sistema NÃO bloqueia, apenas sugere ação
```

## 5. Sequência: Admin Aprova Testemunho para Publicação

```mermaid
sequenceDiagram
    actor Admin as Admin (Frontend)
    participant List as Listagem: /intercessao/testemunhos
    participant Dialog as Dialog: TestemunhoDetailsDialog
    participant TQ as TanStack Query
    participant Supa as Supabase Client
    participant DB as Postgres
    
    Admin->>List: Acessa /intercessao/testemunhos (aba "Aberto")
    
    List->>TQ: Query: SELECT * FROM testemunhos WHERE status='aberto'
    TQ->>Supa: GET /rest/v1/testemunhos?status=eq.aberto
    Supa->>DB: SELECT com RLS (Admin vê tudo)
    DB-->>Supa: Retorna testemunhos em submissão
    Supa-->>TQ: Lista
    TQ-->>List: Renderiza cards de testemunhos
    
    Admin->>List: Clica em testemunho
    List->>Dialog: Abre TestemunhoDetailsDialog
    Dialog->>Dialog: Exibe: título, categoria, corpo, autor (ou "Anônimo")
    
    Admin->>Dialog: Lê conteúdo + clica "Aprovar para Publicação"
    
    Dialog->>TQ: Mutation: UPDATE testemunhos SET status='publico', publicar=true, data_publicacao=now()
    TQ->>Supa: PATCH /rest/v1/testemunhos
    Supa->>DB: UPDATE status, publicar, data_publicacao
    DB-->>Supa: Retorna testemunho atualizado
    Supa-->>TQ: Sucesso
    TQ-->>Dialog: Refetch
    
    Dialog->>Dialog: Feedback: "Testemunho publicado com sucesso"
    Dialog-->>Admin: Fecha dialog
    
    List->>TQ: Query refetch: SELECT * FROM testemunhos WHERE status='publico'
    TQ->>Supa: GET /rest/v1/testemunhos?status=eq.publico
    Supa-->>TQ: Retorna (para exibição em dashboard carrossel)
    
    Note over Admin,DB: RLS valida: admin vê/edita tudo
    Note over Admin,DB: Testemunho com status='publico' aparece em Dashboard para TODOS membros
```

## 6. Sequência: Sistema Detecta Alerta Crítico (3+ Dias Negativos)

```mermaid
sequenceDiagram
    participant Backend as Backend (Edge Function?)<br/>(a confirmar)
    participant DB as Postgres
    participant Cache as Cache/Dashboard
    actor Admin as Admin (Frontend)
    
    Note over Backend,Admin: A cada novo registro de sentimento negativo
    
    Backend->>DB: Query: SELECT COUNT(*) FROM sentimentos_membros<br/>WHERE pessoa_id = ? AND sentimento IN ('triste','ansioso','angustiado')<br/>ORDER BY data_registro DESC LIMIT 3
    
    DB-->>Backend: Retorna últimas 3 registros
    
    Backend->>Backend: Analisa: Se 3 consecutivos negativos?
    
    alt Sim: 3+ consecutivos negativos
        Backend->>DB: INSERT INTO alertas_criticos (pessoa_id, tipo, criado_em)
        OR UPDATE exibição de alerta em cache/tabela
        
        Backend->>Cache: Sinaliza: Membro X em risco
        Cache-->>Admin: Dashboard recarrega/Realtime push
        
        Admin->>Cache: Visualiza "Alertas Críticos" card
        Admin->>Admin: Vê: Nome, Contato, Link WhatsApp
        Admin->>Admin: Clica em membro ou WhatsApp para enviar mensagem
    else Não: menos de 3 ou misturado com positivos
        Backend->>Backend: Sem alerta
    end
    
    Note over Backend,Admin: RLS: Alertas privados por pessoa/admin
    Note over Backend,Admin: Redirecionamento: Link direto para perfil + histórico Sentimentos
    Note over Backend,Admin: Notificação: Automática (a confirmar implementação)
```

## 7. Sequência: Realtime (a confirmar se implementado)

```mermaid
sequenceDiagram
    actor User1 as Intercessor 1 (Frontend)
    actor User2 as Admin (Frontend)
    participant Sub as Supabase Realtime
    participant DB as Postgres
    
    Note over User1,DB: Se Realtime implementado em pedidos_oracao
    
    User1->>Sub: SUBSCRIBE pedidos_oracao (channel)
    User2->>Sub: SUBSCRIBE pedidos_oracao (channel)
    
    User2->>DB: UPDATE pedidos_oracao: status='respondido' (pedido de User1)
    DB-->>Sub: BROADCAST change event
    
    Sub-->>User1: Realtime update: Pedido status mudou
    Sub-->>User2: Realtime update: Pedido status mudou
    
    User1->>User1: Atualiza lista sem refetch manual
    User2->>User2: Atualiza lista sem refetch manual
    
    Note over User1,DB: Se não implementado: Polling via TanStack Query cada X segundos
```

## 8. Resumo das Operações RLS

| Tabela | Membro | Intercessor | Admin |
|--------|--------|-------------|-------|
| `pedidos_oracao` | SELECT próprios (membro_id = auth.uid()), INSERT próprio | SELECT alocados (intercessor_id = auth.uid()), UPDATE próprios | SELECT/INSERT/UPDATE/DELETE todos |
| `testemunhos` | SELECT/INSERT próprios, SELECT públicos (status='publico') | SELECT próprios + públicos | SELECT/INSERT/UPDATE/DELETE todos |
| `sentimentos_membros` | SELECT/INSERT próprios | N/A (não acessa) | SELECT/UPDATE todos |
| `intercessores` | SELECT ativos apenas (ativo=true) | SELECT próprio perfil | SELECT/INSERT/UPDATE/DELETE todos |

---

**Referências**:
- Manual do Usuário (Seção 6): [`../manual-usuario.md#6-intercessão`](../manual-usuario.md#6-intercessão)
- Funcionalidades: [`../funcionalidades.md#4-intercessão-oração-e-testemunhos`](../funcionalidades.md#4-intercessão-oração-e-testemunhos)
- Fluxo: [`fluxo-intercessao.md`](fluxo-intercessao.md)
- Arquitetura: [`../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)
