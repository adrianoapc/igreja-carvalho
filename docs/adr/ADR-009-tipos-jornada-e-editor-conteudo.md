# ADR-009: Tipos de Jornada e Editor de Conteúdo de Etapas

**Status:** Aceito  
**Data:** 17 de dezembro de 2025  
**Contexto:** Necessidade de diferenciar jornadas educacionais de processos internos de acompanhamento, e fornecer editor robusto para conteúdo de etapas

---

## Problema

1. **Jornadas heterogêneas**: Sistema original tratava jornadas como blocos monolíticos sem distinguir:
   - Cursos/EAD (foco em conteúdo educacional)
   - Processos internos de acompanhamento (pastoral, onboarding - foco em pessoas)
   
2. **Conteúdo de etapas limitado**: Apenas suportava vídeo e texto; sem suporte a quizzes, tarefas ou reuniões

3. **UI não intuitiva**: Admin criava jornadas "processo" com campos de pagamento e portal irrelevantes

---

## Decisão

### 1. Três Tipos de Jornada

Implementar enum `tipo_jornada` com valores:
- **`auto_instrucional`** (padrão): Cursos/EAD; foco em conteúdo; portal visível; pagamento opcional
- **`processo_acompanhado`**: Jornadas internas; portal **bloqueado**; pagamento **bloqueado**; etapas chamadas "Colunas do Kanban"
- **`hibrido`**: Combina educação + acompanhamento; flexível em portal e pagamento

### 2. Editor de Conteúdo com 4 Tipos

Expandir `EtapaContentDialog` com suporte a:
- **Texto/Leitura** → Armazena em `conteudo_texto`
- **Vídeo Aula** → URL em `conteudo_url`; preview YouTube/Vimeo; checkbox para `check_automatico` (bloqueia avanço)
- **Quiz/Prova** → JSON em `quiz_config` { notaMinima, perguntas[] }; interface para N perguntas, 4 alternativas, marca resposta correta
- **Reunião/Tarefa** → Tipo informativo; requer confirmação manual do líder

### 3. Imutabilidade do Tipo

Uma vez criada, a jornada **não pode mudar de tipo**. Motivos:
- Evita cascata de mudanças em inscrições e histórico
- Força decisão clara no design da jornada
- Se precisar mudar, admin exclui e recria

---

## Alternativas Consideradas

### ❌ Um só tipo com flags opcionais
- **Problema**: Campos sobrepostos; UI confusa com muitos switches
- **Descartado por**: Complexidade e acoplamento

### ❌ Subclasses de jornada
- **Problema**: Aumentaria complexidade do banco de dados e ORM
- **Descartado por**: Overhead sem benefício claro

### ✅ Tipos simples com UI condicional
- **Adotado**: Simples, previsível, facilita UI responsiva

---

## Consequências

### ✅ Vantagens
1. **Clareza semântica**: Distinção nítida entre educação e acompanhamento
2. **UI limpa**: Campos relevantes aparecem conforme tipo
3. **Escalabilidade**: Fácil adicionar novos tipos no futuro (workshop, mesa redonda, etc.)
4. **Experiência do admin**: Menos cliques e campos desnecessários
5. **Suporte a quizzes**: Interface intuitiva para criar múltiplas perguntas com alternativas

### ❌ Desvantagens
1. **Sem migração**: Jornadas antigas ficarão com tipo `auto_instrucional` (retrôcompatível, não é problema)
2. **Quiz JSON**: Estrutura não normalizada; evita complexidade ORM mas reduz queryability
3. **Imutabilidade**: Admin não pode transformar "Processo" em "Curso" sem recriar

---

## Impactos Técnicos

### Banco de Dados
- Campo `tipo_jornada` (TEXT NOT NULL DEFAULT 'auto_instrucional')
- Campo `quiz_config` (JSONB) em `etapas_jornada`
- Nenhuma mudança de RLS (herança de jornada)

### Frontend
- Novo componente `EtapaContentDialog` com 4 seções condicionais
- RadioGroup em `NovaJornadaDialog` e `EditarJornadaDialog`
- Badges visuais em `Jornadas.tsx` (cor + ícone por tipo)

### API/Backend
- Validação de tipo ao criar/atualizar jornada
- Persistência de `quiz_config` como JSON
- Nenhuma lógica adicional necessária (condicionalidade é UI)

---

## Conformidade

- ✅ Alinhado com separação de preocupações (educação vs. acompanhamento)
- ✅ Mantém RLS intacta (jornada é entidade raiz)
- ✅ Retro-compatível (tipo tem default)
- ✅ Facilita testes (tipos são discretos)

---

## Decisões Relacionadas

- **ADR-008**: Eventos de domínio → não afetado (tipos de jornada não geram eventos)
- **ADR-003**: RLS → mantém-se (tipo_jornada não quebra row-level security)
