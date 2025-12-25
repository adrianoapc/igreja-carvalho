# Plano de Avaliação UX e Roadmap de Correções

**Projeto:** Igreja Carvalho
**Objetivo:** Avaliação massiva de UX e normalização de layout/campos para mobile, tablet e desktop.
**Status:** Plano para discussão (sem alterações de código).

---

## 1) Escopo da avaliação

### 1.1 Dispositivos e viewports alvo
- **iPhone SE** (375×667)
- **iPhone 14/15** (390×844)
- **Android pequeno** (360×740)
- **Android grande** (412×915)
- **Tablet retrato** (768×1024)
- **Tablet paisagem** (1024×768)
- **Desktop** (1366×768, 1440×900, 1920×1080)

### 1.2 Módulos/telas críticos (primeira onda)
- Dashboard
- Pessoas (Membros, Visitantes, Detalhes, Família)
- Gabinete Pastoral
- Finanças
- Kids
- Cultos
- Comunicações (Comunicados, Publicações)
- Configurações

---

## 2) Problemas esperados (hipóteses para validar)
> Estes problemas são hipóteses iniciais para guiar a inspeção. A confirmação depende da avaliação prática em dispositivos/viewport.

### 2.1 Layout e responsividade
- Elementos “fora da tela” ou com **overflow horizontal**.
- Cards com alturas inconsistentes em grids.
- Conteúdo excessivamente espaçado em mobile, exigindo muito scroll.
- Textos/botões truncados em telas pequenas.

### 2.2 Navegação e fluxo
- Sidebar e header com comportamentos inconsistentes em mobile.
- Falta de CTA primária em telas com múltiplas opções.
- Navegação confusa em telas com muitas seções.

### 2.3 Padronização de campos e formulários
- Campos com tamanhos e espaçamentos diferentes.
- Ausência de padrão para labels/ajuda/validação.
- Inconsistência entre inputs, selects e textareas.

### 2.4 Acessibilidade e ergonomia
- Alvos de toque pequenos (<44px).
- Contraste insuficiente em textos secundários.
- Falta de foco visível e feedback claro.

---

## 3) Metodologia de avaliação

### 3.1 Matriz de avaliação por tela
Para cada tela, registrar:
- **Rota/Tela**
- **Viewport**
- **Problema identificado**
- **Severidade** (Crítica, Alta, Média, Baixa)
- **Impacto no usuário**
- **Causa provável**
- **Sugestão de correção**

### 3.2 Checklist por categoria
- **Layout:** overflow, alinhamento, grid, densidade.
- **Navegação:** clareza de fluxo, CTAs, retorno à tela anterior.
- **Formulários:** consistência, legibilidade, feedback.
- **Acessibilidade:** contraste, foco, toque.

---

## 4) Roadmap sugerido (fases)

### Fase 1 — Crítica (bloqueios de usabilidade)
**Objetivo:** garantir que nenhuma tela “quebre” em mobile/tablet.
- Corrigir overflow horizontal e elementos fora da tela.
- Ajustar grids e cards que não cabem em viewports pequenos.
- Garantir botões e inputs acessíveis em mobile.

**Critério de aceite:** nenhuma tela com conteúdo cortado ou inacessível em iPhone/Android/tablet.

---

### Fase 2 — Padronização de layout e campos
**Objetivo:** normalizar aparência e comportamento entre telas.
- Padronizar alturas, padding e tipografia de campos.
- Uniformizar grids e cards.
- Normalizar espaçamentos e hierarquia visual em seções.

**Critério de aceite:** inputs e cards seguem o mesmo padrão visual em 100% das telas avaliadas.

---

### Fase 3 — Navegação e fluxo
**Objetivo:** reduzir cliques e tornar a navegação mais intuitiva.
- Definir CTAs principais em telas críticas.
- Reorganizar seções com base em frequência de uso.
- Ajustar comportamento do menu lateral em mobile/tablet.

**Critério de aceite:** fluxos críticos concluídos com menos passos e com clareza de ação.

---

### Fase 4 — Refinos e micro-interações
**Objetivo:** melhorar percepção de qualidade e fluidez.
- Micro-interações (hover/pressed/transition suaves).
- Skeletons e feedback de carregamento.
- Melhorias de feedback visual em ações (sucesso/erro).

**Critério de aceite:** experiência percebida consistente e fluida em todos os dispositivos.

---

## 5) Entregáveis esperados
- **Relatório de avaliação UX** por tela (com severidade e impacto).
- **Lista priorizada de correções** (impacto × esforço).
- **Roadmap final aprovado** com fases e prazo estimado.
- **Checklist contínuo de QA responsivo** para regressão.

---

## 6) Próximos passos (para discussão)
1. Validar o escopo (quais telas entram na primeira onda).
2. Confirmar prioridade das fases.
3. Definir critérios de aceite por fase.
4. Iniciar diagnóstico detalhado com a matriz de avaliação.

---

## 7) Avaliação inicial e necessidades (com base nos pontos já levantados)
> Esta seção consolida necessidades e sugestões já identificadas em avaliações anteriores, principalmente nas telas de Pessoas. Os itens abaixo orientam o plano e serão confirmados durante a auditoria completa.

### 7.1 Problemas globais recorrentes (prioridade alta)
**Necessidades**
- Exibir **fotos/avatares** de usuários em todas as telas de pessoas (membros, visitantes, detalhes, familiares).
- Normalizar **comportamento de navegação em mobile** (muitos tabs/ações comprimidas).
- Melhorar fluxo e reduzir cliques em operações frequentes (buscar pessoa, editar dados, etc).

**Sugestões**
- Adicionar `avatar_url` em queries relevantes + fallback consistente.
- Refatorar tabs para **drawer/accordion** em mobile.
- Inserir **search bar** em telas principais de pessoas.

### 7.2 Pessoas — Página principal (`/pessoas`)
**Problemas observados**
- Grid em mobile gera cards muito altos.
- Falta de CTA primária clara (muitas opções espalhadas).
- Seções adicionais com espaçamento inconsistente.

**Necessidades**
- Reorganizar Quick Actions e reduzir altura dos cards.
- Unificar seções extras ou agrupar ações correlatas.
- Inserir busca visível no topo.

**Sugestões**
- Ajustar grid para 1 coluna compacta em mobile.
- Transformar ações secundárias em “Ações rápidas” em um card único.

### 7.3 Pessoas — Detalhes (`/PessoaDetalhes.tsx`)
**Problemas observados**
- Abas comprimidas em mobile (texto truncado/ícones pequenos).
- Hierarquia visual confusa (dados pessoais vs igreja misturados).
- Edições dispersas em vários pontos da tela.

**Necessidades**
- Reorganizar tabs por frequência de uso e adaptar para mobile.
- Consolidar padrão de edição.
- Tornar informações de família mais acessíveis.

**Sugestões**
- Trocar tabs por accordion no mobile.
- Criar área única de edição por seção.
- Destacar dados principais do perfil no topo.

### 7.4 Pessoas — Familiares (`/components/pessoas/FamiliaresSection.tsx`)
**Problemas observados**
- Botão “Adicionar Familiar” grande e dominante em mobile.
- Inconsistência de espaçamentos entre cards.

**Necessidades**
- Reduzir a proeminência do CTA em mobile.
- Padronizar espaçamentos e tamanhos.

**Sugestões**
- Transformar CTA em botão secundário ou menu contextual.
- Unificar espaçamento vertical e alinhamento de conteúdo.

### 7.5 Pessoas — Membros (`/pessoas/Membros.tsx`)
**Problemas observados**
- Cards muito altos e pouco compactos.
- Badges de funções quebram em múltiplas linhas.
- Botões desorganizados em mobile.

**Necessidades**
- Compactar layout e reduzir altura dos cards.
- Melhorar comportamento de texto longo (ellipsis).
- Definir CTA principal + ação secundária.

**Sugestões**
- Introduzir layout com 1 botão primário + menu de ações.
- Aplicar truncamento em emails longos.

### 7.6 Pessoas — Visitantes (`/pessoas/Visitantes.tsx`)
**Problemas observados**
- Falta de diferenciação visual de status.

**Necessidades**
- Indicar claramente status/etapa do visitante.

**Sugestões**
- Badges de status ou ícones específicos por estágio.

---

**Observação:** Este documento não realiza nenhuma alteração de código. Ele serve como base de alinhamento e planejamento.
