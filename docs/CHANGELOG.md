# Changelog

Todas as mudanças notáveis do sistema são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não Lançado]

### Adicionado

#### 🎓 Jornadas com Pagamento (Dez/2024)
- **Cursos pagos**: Jornadas agora podem ser configuradas como pagas, com valor definido pelo admin
- **Status de pagamento**: Inscrições possuem status de pagamento (`isento`, `pendente`, `pago`)
- **Integração financeira**: Inscrições pagas podem vincular-se a transações financeiras para rastreabilidade
- **Categoria financeira**: Criada categoria "Cursos e Treinamentos" (entrada) para receitas de cursos

**Tabelas alteradas:**
- `jornadas`: Adicionados campos `requer_pagamento` (boolean) e `valor` (numeric)
- `inscricoes_jornada`: Adicionados campos `status_pagamento` (text) e `transacao_id` (FK)
- `categorias_financeiras`: Inserida categoria "Cursos e Treinamentos"

**Módulos afetados:** Jornadas, Finanças

---

## Histórico

> Releases anteriores não foram documentadas neste formato.
