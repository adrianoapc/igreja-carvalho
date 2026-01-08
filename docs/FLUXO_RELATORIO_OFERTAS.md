# Fluxo Detalhado: Relatório de Oferta

## 1️⃣ Quem Lança (USUÁRIO A)

```
┌──────────────────────────────────────┐
│ USUARIO A (ex: João - Assistente)   │
│                                      │
│ ✅ Acesso: "Relatório de Oferta"   │
│ Permissão: Pode lançar ofertas      │
└────────────────┬─────────────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │  TELA: RelatorioOferta  │
    │                        │
    │  Preenche:             │
    │  • Data do Culto       │
    │  • Valores por forma   │
    │  • Seleciona           │
    │    Conferente (User B) │
    │  • Clica SALVAR        │
    └────────┬───────────────┘
             │
             ▼
    HANDLESUBMIT() executa:

    1. Validações:
       ✓ Igreja identificada?
       ✓ Conferente selecionado?
       ✓ Há valores preenchidos?

    2. Busca "conferente" na lista pessoas

    3. Cria NOTIFICAÇÃO:
       INSERT INTO notifications {
         user_id: conferente.user_id  ← Vai pra inbox dele
         title: "Novo Relatório de Oferta..."
         message: "João criou relatório do culto de 08/01..."
         type: "conferencia_oferta"
         metadata: {
           data_evento: "2026-01-08"
           lancado_por: "João"
           lancado_por_id: "uuid-joao"
           conferente_id: "uuid-user-b"
           valores: { forma_id_1: "100.00", forma_id_2: "250.50" }
           total: 350.50
           taxa_cartao_credito: "3.5"
           taxa_cartao_debito: "2.0"
         }
       }

    4. Toast de sucesso ✅
    5. Limpa form

    ⏸️ AQUI PARA! Nenhum lançamento criado ainda.
```

---

## 2️⃣ Quem Confere (USUÁRIO B)

```
┌──────────────────────────────────────┐
│ USUARIO B (ex: Maria - Tesoureira)  │
│                                      │
│ ✅ Acesso: "Relatório de Oferta"   │
│ Permissão: Pode conferir            │
└────────────────┬─────────────────────┘
                 │
         Vê notificação
         na tela de ofertas
         (seção inferior)
                 │
                 ▼
    ┌────────────────────────────────┐
    │ Notificação Pendente Exibida:  │
    │                                │
    │ "Novo Relatório de Oferta..."  │
    │ João criou relat. de 08/01     │
    │ Total: R$ 350,50               │
    │                                │
    │ [Rejeitar] [Conferir ▶]       │
    └────────────┬────────────────────┘
                 │
         Clica em "Conferir"
                 │
                 ▼
    CONFERIRDIALOG se abre:
    (Componente: ConferirOfertaDialog)

    Exibe:
    • Data: 08/01/2026
    • Valores por forma:
      - Dinheiro: R$ 100,00
      - Débito: R$ 250,50
    • Total: R$ 350,50
    • Taxa crédito: 3.5%
    • Taxa débito: 2.0%

    Botões:
    [Rejeitar] [Confirmar]
                 │
                 ▼ (se confirmar)
    HANDLECONFIRAROFERTA() executa:

    1. Busca contas por NOME:
       • contaOfertas = contains("oferta")
       • contaSantander = contains("santander")
       ❌ PROBLEMA: Se conta não tiver
          essas palavras = erro

    2. Para CADA valor de forma:

       • Busca form no array
       • Checa nome forma:
         - isDinheiro = includes("dinheiro")
         - isPix = includes("pix")
         - isCartaoCredito = includes("crédito"|"credito")
         - isCartaoDebito = includes("débito"|"debito")

       • Define CONTA:
         if (isDinheiro) → contaOfertas
         else → contaSantander

       • Define STATUS e DATA_PAGAMENTO:
         if (isDinheiro || isPix) → status="pago", data_pgto=hoje
         else → status="pendente", data_pgto=null

       • Calcula TAXA:
         if (isCartaoCredito) → taxa = valor * 3.5%
         if (isCartaoDebito) → taxa = valor * 2.0%

       • Cria transação:
         {
           tipo: "entrada"
           descricao: "Oferta - Culto 08/01/2026"
           valor: 100.00 (ou 250.50)
           data_vencimento: "2026-01-08"
           data_competencia: "2026-01-08"
           data_pagamento: "2026-01-08" (se dinheiro/pix)
           conta_id: contaOfertas.id (se dinheiro)
                     contaSantander.id (se não)
           categoria_id: categoria_oferta.id
           forma_pagamento: forma.id
           status: "pago" (se dinheiro/pix) / "pendente"
           taxas_administrativas: valor * taxa (se cartão)
           observacoes: "Lançado por: João\nConferido por: Maria\n..."
           lancado_por: maria_user_id
           igreja_id: igreja_id
           filial_id: filial_id
         }

    3. INSERT MÚLTIPLOS em transacoes_financeiras
       (uma linha por forma com valor > 0)

    4. Atualiza notification:
       UPDATE notifications SET read=true WHERE id=...

    5. Toast sucesso ✅ "2 lançamentos criados"
    6. Invalida query de "notifications"

    ⏸️ DADOS PERSISTEM NO BANCO
```

---

## 3️⃣ Se Rejeitar

```
USUARIO B clica [Rejeitar]:

HANDLEREJEITAROFERTA() executa:

  UPDATE notifications SET
    read = true
  WHERE id = notif_id

  Toast: "Conferência rejeitada"

❌ PROBLEMA:
   • Não salva RAZÃO da rejeição
   • Não salva QUEM rejeitou
   • USUARIO A não sabe por quê foi rejeitado
   • Dados são perdidos (não fica histórico)
   • Não é auditável
```

---

## 4️⃣ Estado Final

```
SE CONFIRMADO:
┌─────────────────────────────────┐
│ transacoes_financeiras          │
├─────────────────────────────────┤
│ ID | Descricao      | Valor    │
├─────────────────────────────────┤
│ 1  | Oferta culto   | 100.00   │
│    | (Dinheiro)     |          │
│    | Conta: Caixa   |          │
│    | Status: pago   |          │
├─────────────────────────────────┤
│ 2  | Oferta culto   | 250.50   │
│    | (Débito)       |          │
│    | Conta: Santander|          │
│    | Status: pend.  |          │
│    | Taxa: 5,01     |          │
└─────────────────────────────────┘

SE REJEITADO:
┌──────────────────────────────────┐
│ notifications                    │
├──────────────────────────────────┤
│ read: true                       │
│ (resto dos dados intactos)       │
│                                  │
│ ❌ Nenhuma informação de por quê │
│ ❌ Nenhum registro de rejeição   │
│ ❌ USUARIO A fica no escuro      │
└──────────────────────────────────┘
```

---

## 🚨 Resumo dos Problemas

| Item                       | Problema                | Impacto                       |
| -------------------------- | ----------------------- | ----------------------------- |
| **Mapeamento Forma→Conta** | Hardcoded por nome      | Se renomear conta = quebra    |
| **Taxas**                  | Hardcoded 3.5% e 2.0%   | Não reflete sistema dinâmico  |
| **Validação**              | Nenhuma em valores      | Pode lançar R$ 9999999        |
| **Rejeição**               | Sem razão/auditoria     | Perda de informação           |
| **Roles**                  | Apenas admin/tesoureiro | Sem flexibilidade             |
| **UI Formas**              | Grid 2 colunas fixo     | Fica ruim com 10+ formas      |
| **Preview**                | Sem pré-visualização    | User B não vê o que vai criar |

---

## ✨ Next Steps

Para desengessamento, em ordem de impacto:

1. **CRÍTICO**: Criar tabela `forma_pagamento_contas` (dinâmico)
2. **CRÍTICO**: Adicionar `taxa_administrativa` em `formas_pagamento`
3. **ALTO**: Adicionar validação e limites de valores
4. **ALTO**: Adicionar razão de rejeição e auditoria
5. **MÉDIO**: Melhorar UI (grid dinâmico, preview)
6. **BAIXO**: Permitir customizar roles de conferente
