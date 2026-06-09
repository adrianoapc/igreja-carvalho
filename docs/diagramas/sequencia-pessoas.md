# Sequencia do Modulo Pessoas

Fluxo sequencial basico do modulo Pessoas: abertura da tela, carregamento da lista, criacao/edicao, persistencia no banco e recarregamento.

```mermaid
sequenceDiagram
    participant Usuario
    participant Frontend
    participant Supabase
    participant Banco as Banco (Postgres)

    Usuario->>Frontend: Abre tela Pessoas
    Frontend->>Supabase: Buscar lista de pessoas
    Supabase->>Banco: SELECT pessoas
    Banco-->>Supabase: Resultados
    Supabase-->>Frontend: Lista de pessoas
    Frontend-->>Usuario: Exibe lista

    Usuario->>Frontend: Criar/Editar pessoa
    Frontend->>Supabase: upsert pessoa (dados)
    Supabase->>Banco: INSERT/UPDATE pessoas
    Banco-->>Supabase: Confirmacao
    Supabase-->>Frontend: Status da operacao
    Frontend->>Supabase: Recarregar lista
    Supabase->>Banco: SELECT pessoas
    Banco-->>Supabase: Resultados atualizados
    Supabase-->>Frontend: Lista atualizada
    Frontend-->>Usuario: Exibe lista atualizada
```

## Sequência: Wizard Interno de Cadastro (/pessoas/cadastrar)

```mermaid
sequenceDiagram
    participant U as Usuário (staff)
    participant FE as PessoaWizard
    participant SB as Supabase

    U->>FE: Clica "Cadastrar Pessoa"
    FE-->>U: Step 0 — Selecionar tipo
    U->>FE: Escolhe Visitante / Frequentador / Membro
    FE-->>U: Steps de dados (2-4 passos)
    U->>FE: Preenche e avança steps
    FE->>SB: Verificar duplicata (telefone/email)
    SB-->>FE: Resultado
    FE->>SB: INSERT profiles
    SB-->>FE: OK + id
    alt Visitante com deseja_contato
        FE->>SB: INSERT visitante_contatos (agendado +3 dias)
    end
    FE-->>U: Redireciona para /pessoas
```

## Sequência: Check-in com OTP WhatsApp

```mermaid
sequenceDiagram
    participant U as Participante
    participant FE as Checkin.tsx
    participant SO as Edge: send-otp
    participant VO as Edge: verify-otp
    participant CE as Edge: checkin-evento
    participant WA as WhatsApp (Meta API)

    U->>FE: Escaneia QR Code do evento
    U->>FE: Digita telefone
    FE->>SO: { telefone, igreja_id }
    SO->>WA: Envia código OTP (hash SHA-256 no banco)
    WA-->>U: Mensagem WhatsApp com código
    U->>FE: Digita código de 6 dígitos
    FE->>VO: { telefone, codigo }
    VO-->>FE: { success, profile_id }
    FE->>CE: { tipo, evento_id, profile_id }
    CE-->>FE: { success, nome }
    FE-->>U: "Presença Confirmada!" (nome mascarado)
```

## Sequência: Atualização de Contatos (sanitização + fila de chatbot)

```mermaid
sequenceDiagram
    participant U as Usuário (staff)
    participant FE as EditarContatosDialog
    participant SB as Supabase
    participant DB as Banco (Postgres)
    participant Q as Fila chatbot_queue

    U->>FE: Edita contatos da pessoa
    FE->>SB: UPDATE profiles.profile_contatos
    SB->>DB: Sanitizar + persistir profile_contatos
    DB-->>SB: Registro atualizado
    alt novos contatos adicionados
        DB->>Q: Enfileirar payload para chatbot
    end
    SB-->>FE: Sucesso
    FE-->>U: Confirma atualização
```
