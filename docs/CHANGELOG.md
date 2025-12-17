# Changelog

Todas as mudanças notáveis do sistema são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não Lançado]

### Adicionado

#### 🎓 Jornadas Avançadas: Tipos, Quiz e Soft-Lock (Dez/2024)
- **Tipo de Jornada**: Campo `tipo_jornada` classifica jornadas como `auto_instrucional` (Player), `processo_acompanhado` (Kanban) ou `hibrido`
- **Etapas enriquecidas**: Tipos de conteúdo (`texto`, `video`, `quiz`, `tarefa`, `reuniao`), URL de conteúdo, configuração de quiz (JSON), check automático e duração estimada
- **Sistema de Quiz**: Nova tabela `respostas_quiz` para histórico de respostas dos alunos com nota, aprovação e tentativas
- **Soft-Lock**: Campo `check_automatico` permite definir se o sistema avança automaticamente ou requer ação do aluno

**Tabelas alteradas:**
- `jornadas`: Adicionado campo `tipo_jornada` (text com check constraint)
- `etapas_jornada`: Adicionados campos `conteudo_tipo`, `conteudo_url`, `quiz_config`, `check_automatico`, `duracao_estimada_minutos`
- `respostas_quiz`: Nova tabela com RLS para histórico de quizzes

**Módulos afetados:** Jornadas, Ensino, Player de Cursos

---

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
