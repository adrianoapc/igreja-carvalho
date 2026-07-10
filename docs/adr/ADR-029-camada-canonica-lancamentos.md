# ADR-029 — Camada Canônica de Lançamentos no Banco (RPCs `fin_*`)

**Status:** Aceito  
**Data:** 2026-07-10  
**Decisores:** Produto, Tecnologia  
**Contexto:** Sistema Financeiro / Transações / Bot / Ofertas / Integrações  

---

## 📌 Contexto

O domínio financeiro tem hoje **quatro canais de escrita paralelos**, cada um
com sua própria cópia das regras de negócio (mapeamento completo em
`docs/arquitetura-financeiro.md`):

1. `TransacaoDialog.tsx` (1788 l.) — insert/update direto do frontend
2. `chatbot-financeiro/index.ts` (2538 l.) — insert direto com service role
3. `RelatorioOferta.tsx` (2627 l.) — 3 pontos de insert direto
4. Importações/integrações (Getnet, Santander, PIX, planilhas)

Consequências: regras ADR-027 duplicadas com drift provável; lançamento
parcelado cria só a parcela 1 (não há quem materialize as futuras);
autorização do bot validada longe das demais regras; nenhuma transação
atômica em operações multi-tabela.

---

## ❗ Problema

Como garantir que toda escrita financeira passe por UMA implementação das
regras (validação de tenant, ADR-027, defaults, parcelas, auditoria),
reutilizável por frontend, bot, edge functions e futuros canais?

---

## ✅ Decisão

**O CORE de escrita do financeiro vive no banco, como RPCs Postgres com
prefixo `fin_`**, versionadas em migrations e chamadas via `supabase.rpc()`.

### Alternativas rejeitadas

- **Lib TypeScript compartilhada**: não resolve transacionalidade nem impede
  escrita direta por um terceiro canal.
- **Edge function "API financeira"**: hop extra de latência e cold start;
  pode existir no futuro como fachada por cima das mesmas RPCs.

### RPCs canônicas

| RPC | Substitui |
|---|---|
| `fin_criar_lancamento` | inserts de TransacaoDialog, chatbot, QuickCreate |
| `fin_atualizar_lancamento` | updates de TransacaoDialog |
| `fin_alterar_status_lancamento` | mutações do TransacaoActionsMenu |
| `fin_excluir_lancamento` | deletes diretos |
| `fin_criar_transferencia` | par de transações manual (front e bot) |
| `fin_lancar_sessao` | 3 inserts do RelatorioOferta |
| `fin_pagar_reembolso` | pagarReembolsoMutation |
| `fin_ajustar_saldo` | UPDATE direto do AjusteSaldoDialog |
| `fin_ingerir_extratos` | inserts de extrato por fonte |

### Convenções obrigatórias

1. **Prefixo `fin_`** para toda RPC do domínio financeiro.
2. **Parâmetros**: escalares para o essencial + `p_extras jsonb` para
   opcionais. Contrato aditivo — nunca remover parâmetro, só adicionar com
   default.
3. **Retorno**: `jsonb {ok, id(s), warnings[]}`.
4. **Resolução de tenant e ator** (inegociável, pois `SECURITY DEFINER`
   bypassa RLS):
   - Chamada com JWT de usuário: tenant derivado de
     `get_current_user_igreja_id()`/`get_current_user_filial_id()`;
     permissão via `has_role` + `has_filial_access`; parâmetros explícitos
     de tenant são validados contra o JWT.
   - Chamada com service role (bot/edges): exige
     `p_contexto jsonb {igreja_id, filial_id, ator_profile_id, canal}`;
     a RPC valida que o ator pertence ao tenant; para canal `bot`, valida
     `profiles.autorizado_bot_financeiro` + flag específica
     (`autorizado_lancar_despesas`/`_depositos`/`_reembolsos`).
5. **Auditoria**: toda RPC registra quem/quando/canal. Escritas em lote
   seguem o padrão `reclass_jobs`/`reclass_job_items` (job + snapshot
   antes/depois + undo).
6. **Regra de ouro**: nenhum canal faz INSERT/UPDATE/DELETE direto em
   `transacoes_financeiras`, `transferencias_contas`, `extratos_bancarios`
   e tabelas de conciliação. Ao final do roadmap (F7), os privilégios de
   escrita direta do role `authenticated` nessas tabelas serão revogados.

### Consumo

- **Frontend**: wrappers tipados em `src/features/financeiro/core/api/`
  (único lugar do domínio que chama supabase).
- **Edges/Bot**: shim Deno `supabase/functions/_shared/financeiro-core.ts`.

---

## 🔁 Consequências

- Uma mudança de regra (ex.: ADR-027) é um `CREATE OR REPLACE FUNCTION` —
  todos os canais herdam no mesmo deploy.
- PLpgSQL exige disciplina: funções pequenas, testes de paridade
  (mesmos inputs ⇒ mesmas linhas) antes de cada troca de canal.
- Snapshot do schema de produção como baseline antes da F1 (histórico de
  migrations Lovable tem lacunas).
- Leituras continuam via PostgREST/RLS; agregações pesadas seguem o modelo
  `get_dre_anual` (ver roadmap F2.5).

## 🔗 Relacionados

ADR-027 (valor bruto vs líquido — regras absorvidas pelas RPCs),
ADR-025 (baixa automática), ADR-030 (conciliação transacional),
`docs/arquitetura-financeiro.md` (mapeamento e roadmap F0-F7).
