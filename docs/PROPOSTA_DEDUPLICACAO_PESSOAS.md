# Proposta de Ferramenta de Deduplicação de Pessoas

## Objetivo
Desenvolver uma ferramenta para detecção, análise e resolução de registros duplicados na base de pessoas, visando melhorar a qualidade dos dados e evitar inconsistências operacionais.

## Fases da Implementação

### Fase 1: Detecção Básica e Estrutura de Dados
- Implementar lógica de detecção automática de possíveis duplicatas com base em similaridade de nome, data de nascimento, e-mail e telefone (ex: Levenshtein, normalização, heurísticas).
- Criar tabela `pessoas_duplicatas_suspeitas` para armazenar pares de pessoas suspeitas de duplicidade, score de similaridade, campos conflitantes e status de revisão.
- Criar tabela `pessoas_mesclagens_historico` para registrar operações de mesclagem, campos mesclados, responsáveis e data/hora.
- Adicionar campo `is_merged` e `merged_into_id` na tabela `pessoas` para rastrear registros mesclados.

### Fase 2: Interface de Revisão e Mesclagem
- Criar interface administrativa para revisão dos pares suspeitos, permitindo comparar campos lado a lado, aprovar/descartar duplicidade e executar mesclagem.
- Implementar lógica de mesclagem segura, preservando histórico e auditando alterações.
- Permitir busca manual e marcação de duplicatas por operadores.

### Fase 3: Automação e Monitoramento
- Agendar rotina periódica de detecção de duplicatas.
- Notificar operadores sobre novos casos suspeitos.
- Gerar relatórios de qualidade de dados e evolução de duplicidades.

## Considerações Técnicas
- Utilizar algoritmos de similaridade (Levenshtein, Jaro-Winkler, etc.) e normalização de dados.
- Garantir reversibilidade das operações de mesclagem.
- Prever integração futura com APIs externas para validação de dados.

## Benefícios Esperados
- Redução de inconsistências e retrabalho.
- Melhoria na experiência do usuário e confiabilidade dos relatórios.
- Base para futuras integrações e automações.

---

*Documento gerado automaticamente em 11/02/2026 para referência futura.*
