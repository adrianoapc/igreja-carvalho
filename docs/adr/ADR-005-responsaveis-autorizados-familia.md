# ADR-005 - Responsáveis/Autorizados na Família (Kids)

## Status
Aceito

## Contexto
Há a necessidade de permitir que responsáveis principais (pai/mãe) autorizem outras pessoas (ex.: avó/tio) a visualizar e realizar check-in das crianças no módulo Kids. O documento [`../AUTHORIZED_GUARDIANS.md`](../AUTHORIZED_GUARDIANS.md) descreve o fluxo funcional e o uso da tabela `familias` para registrar vínculos entre perfil do responsável e perfil da criança, com o tipo de parentesco.

## Decisão
- Utilizar a tabela `familias` como **fonte de verdade** para vínculos de autorização entre perfis (responsáveis e crianças).
- Registrar a autorização criando linhas com `pessoa_id` (responsável/autoridade) e `familiar_id` (criança autorizada), armazenando `tipo_parentesco`.
- Tornar a leitura **bidirecional** para que o autorizado veja as crianças e o responsável principal veja os autorizados (apoiado por inversão de papel quando necessário), conforme prática já adotada no módulo Pessoas.
- Aplicar RLS para garantir que apenas o responsável legal gerencie autorizações e que autorizados vejam apenas as crianças vinculadas.

## Consequências
- Autorização de terceiros para ações no Kids passa a ser simples e auditável via `familias`.
- A experiência na FamilyWallet mostra automaticamente crianças vinculadas aos autorizados, com papéis invertidos para exibição correta.
- Centraliza o controle de autorização na mesma relação usada para familiares, reduzindo duplicidade de modelos.

## Referências
- [AUTHORIZED_GUARDIANS.md](../AUTHORIZED_GUARDIANS.md)
- [BIDIRECTIONAL_RELATIONSHIPS.md](../BIDIRECTIONAL_RELATIONSHIPS.md)
- [Fluxo Pessoas](../diagramas/fluxo-pessoas.md)
