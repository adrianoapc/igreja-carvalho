## O que mudou?
- 

## Módulos afetados
- [ ] Financeiro
- [ ] Pessoas/Membros
- [ ] Kids
- [ ] Comunicação
- [ ] Notificações
- [ ] Ensino
- [ ] Auth/Segurança
- [ ] Banco/Supabase
- [ ] Outro: ________

## Docs (obrigatório)
- [ ] Atualizei `docs/funcionalidades.md` (se aplicável)
- [ ] Atualizei `docs/manual-usuario.md` (se aplicável)
- [ ] Atualizei diagramas em `docs/diagramas/` (se aplicável)
- [ ] Atualizei/Criei ADR em `docs/adr/` (se houve decisão)
- [ ] Atualizei `docs/README.MD` (se adicionei novos arquivos)

## Review (obrigatório) — ver `docs/guardrails-processo.md`
- [ ] Rodei `/code-review` local e resolvi os achados (ou justifiquei os que ficaram)
- [ ] Se toquei RLS, auth, secrets ou dado cross-tenant: rodei `/security-review`
- [ ] Se a PR tocou migration: `supabase db reset` local aplicou tudo limpo (o harness de CI confirma de novo, mas testar local primeiro é mais rápido)
- [ ] Se criei/alterei gráfico ou dashboard: usei `src/lib/chartPalette.ts` (ou a skill `dataviz` para paleta sequencial/divergente), não hex hardcoded
- [ ] Conferi que `@codex review`/Cursor Bugbot realmente rodou (não só "usage limit reached") antes de mergear

## Prompt sugerido para Copilot (cole no Copilot Chat)
> “Atualize a documentação do(s) módulo(s) afetado(s), sem mover/renomear arquivos, apenas complementando os docs existentes em /docs. Gere/atualize Mermaid em docs/diagramas e crie ADR apenas se houver decisão.”
