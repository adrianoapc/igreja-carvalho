# Módulo Voluntariado

> Doc detalhado em [VOLUNTARIADO.md](VOLUNTARIADO.md) (fundido de DASHBOARD_VOLUNTARIADO + INTEGRACAO_VOLUNTARIO).

## Rotas

| Rota | Componente |
|---|---|
| `/voluntariado` | `src/pages/Voluntariado.tsx` |
| `/voluntariado/candidatos` | `src/pages/voluntario/Candidatos.tsx` |
| `/voluntariado/historico` | `src/pages/voluntariado/Historico.tsx` |
| `/voluntariado/testes` | `src/pages/voluntariado/TestesCrud.tsx` |
| `/voluntariado/integracao` | `src/pages/voluntariado/IntegracaoDashboard.tsx` |
| `/voluntariado/meu-teste/:testeId` | `src/pages/voluntariado/MeuTeste.tsx` |
| `/voluntariado/minha-jornada` | `src/pages/voluntariado/MinhaJornada.tsx` |

## TODO

- [ ] Criar `docs/diagramas/fluxo-voluntariado.md` a partir de `src/pages/voluntariado/` e `supabase/functions/` (triagem-bot, disparar-alerta)
- [ ] Pipeline de integração: APROVADO → ENTREVISTA → TRILHA → MENTORIA → TESTE → ATIVO (ver [VOLUNTARIADO.md](VOLUNTARIADO.md))
