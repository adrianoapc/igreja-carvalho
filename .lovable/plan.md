

# Plano: Correção do Feedback ALREADY_USED e Validação de Documento

## Situação Atual

### Problema 1: Feedback ALREADY_USED
A edge function `checkin-inscricao` já foi atualizada para retornar HTTP 200 em casos de "ALREADY_USED". O componente `CheckinScanner.tsx` já trata este código e exibe a tela amarela. Basta testar novamente após o deploy.

### Problema 2: Validação de Documento pelo Operador
Adicionar opção configurável no evento para exigir que o operador valide a identidade do participante ao fazer check-in.

---

## Fluxo com Validação de Documento

```text
+------------------------------------------------------------------+
|  1. Operador escaneia QR Code                                    |
+------------------------------------------------------------------+
|  2. Sistema valida inscricao (Edge Function)                     |
+------------------------------------------------------------------+
|  3. SE evento exige documento:                                   |
|     +----------------------------------------------------+       |
|     |  Etapa de Confirmacao                              |       |
|     |                                                    |       |
|     |  Nome: Maria Silva                                 |       |
|     |  Email: maria@email.com                            |       |
|     |  Telefone: (17) 99999-9999                         |       |
|     |                                                    |       |
|     |  Verifique documento com foto                      |       |
|     |                                                    |       |
|     |  [Recusar]  [Confirmar]                            |       |
|     +----------------------------------------------------+       |
|                                                                  |
|  4. SE nao exige ou confirmado -> Check-in realizado (tela verde)|
|  5. SE recusado -> Voltar ao scanner                             |
+------------------------------------------------------------------+
```

---

## Alterações Necessárias

### 1. Migração de Banco de Dados

Adicionar campo na tabela `eventos`:

```sql
ALTER TABLE public.eventos
ADD COLUMN exigir_documento_checkin boolean DEFAULT false;
```

### 2. Formulário de Evento (EventoDialog.tsx)

Adicionar toggle na seção de Inscrições com label "Exigir documento no check-in".

### 3. Edge Function (checkin-inscricao)

Incluir flag `exigir_documento` na resposta de sucesso.

### 4. Componente CheckinScanner.tsx

Modificar fluxo para dois estágios quando exigir documento:
- `scanning` → `confirming` → `feedback`

### 5. Novo Componente: CheckinConfirmDialog.tsx

Tela de validação mostrando dados do participante para conferência com documento físico.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Banco de Dados** | Adicionar coluna `exigir_documento_checkin` |
| `src/components/eventos/EventoDialog.tsx` | Adicionar toggle no form |
| `supabase/functions/checkin-inscricao/index.ts` | Retornar flag `exigir_documento` |
| `src/components/eventos/CheckinScanner.tsx` | Fluxo em dois estágios |
| **NOVO** `src/components/eventos/CheckinConfirmDialog.tsx` | Tela de validação |

---

## Casos de Uso

| Cenário | Comportamento |
|---------|---------------|
| Evento sem exigência | Check-in direto → tela verde |
| Evento com exigência | Scan → confirmação → tela verde |
| Documento inválido | Operador recusa → volta ao scanner |
| QR já utilizado | Tela amarela "Já utilizado" |
| Pagamento pendente | Tela laranja |

---

## Ordem de Implementação

1. Executar migração de banco para adicionar coluna
2. Atualizar `EventoDialog.tsx` com o novo toggle
3. Atualizar edge function para retornar `exigir_documento`
4. Criar `CheckinConfirmDialog.tsx`
5. Modificar `CheckinScanner.tsx` para fluxo em dois estágios

