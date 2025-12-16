# ADR-004 - Relacionamentos bidirecionais em familias

## Status
Aceito

## Contexto
O modulo Pessoas exibe vinculos familiares a partir da tabela `familias`. O problema identificado: o familiar so aparecia para quem criou o vinculo (pessoa_id), deixando invisiveis relacoes onde o usuario era o `familiar_id`. Ha documentacao detalhada em `../BIDIRECTIONAL_RELATIONSHIPS.md` com queries e logica de exibicao.

## Decisao
- Tornar a busca de familiares **bidirecional**, retornando linhas onde o usuario e `pessoa_id` **ou** `familiar_id`.
- Ajustar exibicao invertendo o papel de parentesco quando a linha vem do lado reverso (`familiar_id = meu_id`), usando mapeamento controlado (ex.: pai/mãe -> filho/filha, filho/filha -> responsavel, conjuge preserva rotulo).
- Manter `profiles` como fonte unica de dados pessoais e `familias` apenas como relacao.
- Referencias implementadas: query `or(pessoa_id.eq.<id>,familiar_id.eq.<id>)` e funcao `getDisplayRole()` que aplica a inversao conforme sexo/role, conforme `BIDIRECTIONAL_RELATIONSHIPS.md`.

## Consequencias
- Usuarios veem todos os familiares relacionados, independentemente de quem criou o vinculo.
- Exibicao de parentesco fica consistente para ambos os lados (responsavel vs filho/filha; conjuge preservado).
- Maior custo de leitura por incluir ambos os lados, mas resultado cacheavel no frontend.
- Simplifica UX da FamilyWallet e das telas de Pessoas ao evitar cadastros duplicados.

## Diagramas e referencias
- [Fluxo Pessoas](../diagramas/fluxo-pessoas.md)
- [BIDIRECTIONAL_RELATIONSHIPS.md](../BIDIRECTIONAL_RELATIONSHIPS.md)
