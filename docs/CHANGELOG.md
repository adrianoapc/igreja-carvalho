# Changelog

Todas as mudanças notáveis do sistema são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não Lançado]

### Corrigido

#### 🔒 Correções de Segurança (17 de Dez/2025)
- **Path Traversal em uploads**: Adicionada validação de caminho em `Publicacao.tsx` e `MidiasGeral.tsx` para prevenir ataques de path traversal em uploads de arquivos
- **Funções RPC sem autorização**: Adicionadas verificações de `auth.uid()` em 3 funções SECURITY DEFINER:
  - `get_user_familia_id`: Agora verifica se usuário consulta próprio familia_id (ou é admin)
  - `alocar_pedido_balanceado`: Agora requer role admin, pastor ou intercessor ativo
  - `buscar_pessoa_por_contato`: Agora requer autenticação (defense in depth)

**Causa**: Funções RPC com SECURITY DEFINER bypassavam RLS sem validar permissões do chamador

**Impacto**: Nenhum para usuário final; hardening interno de segurança

**Módulos afetados**: Segurança (global), Intercessão, Família, Publicação, Mídias

---

### Adicionado

#### 🎓 Editor de Conteúdo de Etapas com Quiz (17 de Dez/2025)
- **EtapaContentDialog expandido**: Novo editor admin para configurar conteúdo de etapas com 4 tipos suportados
  - **Texto/Leitura**: Armazena conteúdo em `conteudo_texto`
  - **Vídeo Aula**: URL em `conteudo_url` com preview YouTube/Vimeo em tempo real; checkbox para bloqueio até conclusão (`check_automatico`)
  - **Quiz/Prova**: Interface para criar N perguntas com 4 alternativas; marca resposta correta; configurável nota mínima de aprovação (0-100); salvo em `quiz_config` (JSON)
  - **Reunião/Tarefa**: Tipo informativo para etapas presenciais ou tarefas; requer confirmação manual do líder no Kanban
- **Validações**: Cada tipo tem campos obrigatórios verificados antes de salvar; feedback de erro específico ao usuário
- **Preview dinâmico**: Videos com embed funcional que atualiza em tempo real conforme URL é digitada

**Impacto no usuário:**
- Admins ganham interface robusta para criar quizzes educacionais com múltiplas tentativas
- Vídeos com bloqueio automático garantem que alunos assistam conteúdo completo
- Suporte a 4 tipos de conteúdo cobre a maioria dos cenários educacionais

**Riscos/Observações:**
- `quiz_config` é armazenado como JSON; estrutura deve ser mantida para compatibilidade futura
- Preview de vídeo funciona para YouTube/Vimeo; outras plataformas mostram placeholder
- Sem validação de URL no front-end (deixado para backend)

**Tabelas/Campos afetados:**
- `etapas_jornada.tipo_conteudo`, `conteudo_url`, `conteudo_texto`, `quiz_config`, `check_automatico` (já existentes, agora em uso completo)

---

#### 🎓 Diferenciar Tipos de Jornadas com Badges Visuais (17 de Dez/2025)
- **Tipo de Jornada (UI)**: RadioGroup com 3 tipos (Curso/EAD, Processo/Pipeline, Híbrido) em `NovaJornadaDialog` e `EditarJornadaDialog`
  - **Curso/EAD** (`auto_instrucional`): Foco em conteúdo educacional; portal visível e pagamento opcional
  - **Processo/Pipeline** (`processo_acompanhado`): Jornada interna de acompanhamento (pastoral, onboarding); **portal e pagamento desabilitados automaticamente**; etapas chamadas "Colunas do Kanban"
  - **Híbrido**: Combina educação + acompanhamento
- **Listagem visual**: Badges com cores (azul/Curso, verde/Processo, roxo/Híbrido) e ícones na página `Jornadas` para identificação rápida do tipo
- **Condicional na UI**: Portal e pagamento ficam ocultos quando tipo é "Processo"; alerta informativo explica limitação
- **Etapas label dinâmico**: "Capítulos" para cursos, "Colunas do Kanban" para processos

**Impacto no usuário:**
- Admins diferenciam jornadas de forma clara ao criar/editar
- Alunos e líderes identificam rapidamente tipo da jornada na listagem
- Simplifica criação de jornadas internas sem acumular campo de pagamento

**Riscos/Observações:**
- Tipo é imutável após criação (decisão de design para evitar cascata de mudanças); se precisar mudar, é necessário excluir e recriar
- Campo `tipo_jornada` é NOT NULL com default `auto_instrucional` (retrocompatível com jornadas existentes)

**Tabelas/Campos afetados:**
- `jornadas.tipo_jornada` (TEXT NOT NULL DEFAULT 'auto_instrucional') - **já presente no banco via migração anterior**
- UI: `NovaJornadaDialog.tsx`, `EditarJornadaDialog.tsx`, `Jornadas.tsx`

---

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
