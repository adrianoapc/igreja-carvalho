# Relatório de Diagnóstico UX/UI e Plano de Adequação Mobile
**Projeto:** Sistema de Gestão (Igreja Carvalho)
**Data:** 25 de Dezembro de 2025
**Foco:** Responsividade, Usabilidade Mobile (iOS/Android) e Padronização Web.

---

## 1. Resumo Executivo
O sistema apresenta uma arquitetura robusta voltada para Desktop ("Web-First"), utilizando componentes modernos (Shadcn/UI e Tailwind). No entanto, a experiência em dispositivos móveis apresenta fricção severa, com quebras de layout, dificuldade de navegação e problemas de input. O objetivo deste plano é migrar a mentalidade para "Mobile-First" sem sacrificar a experiência Desktop, utilizando design responsivo adaptativo.

---

## 2. Diagnóstico de Problemas Críticos (Pain Points)

### 2.1. Visualização de Dados (O Problema das Tabelas)
* **Sintoma:** Tabelas financeiras e de membros criam rolagem horizontal interna ou quebram o layout em telas < 375px.
* **Causa Técnica:** O componente `Table` padrão não é responsivo por natureza. Tentar espremer muitas colunas em 360px torna a leitura impossível.
* **Impacto:** Usuário não consegue ver o status ou clicar no botão de "Ações" sem arrastar a tela, gerando frustração.

### 2.2. Conflito: Modais (Dialogs) vs. Teclado Virtual
* **Sintoma:** Ao preencher formulários em Modais (ex: Nova Transação), o teclado virtual do celular sobe e cobre o campo de digitação ou o botão de "Salvar".
* **Causa Técnica:** O `Dialog` centralizado verticalmente não recalcula a altura da viewport visível quando o teclado abre (problema clássico de "viewport resizing").
* **Impacto:** Bloqueio de fluxo. O usuário precisa fechar o teclado repetidamente para navegar.

### 2.3. Ergonometria e "Thumb Zone" (Zona do Polegar)
* **Sintoma:** Botões críticos (Salvar, Filtros, Novo) estão localizados no topo direito da tela.
* **Causa Técnica:** Padrão de leitura em "F" (Desktop) aplicado ao Mobile.
* **Impacto:** Dificuldade física de alcance em celulares de tela grande (6.5"+), forçando o uso das duas mãos.

### 2.4. Zoom Indesejado no iOS (Safari)
* **Sintoma:** Ao clicar em um input, a tela dá um leve zoom, quebrando o layout lateral.
* **Causa Técnica:** Inputs configurados com `text-sm` (14px). O iOS força zoom em qualquer input com fonte menor que 16px.
* **Impacto:** Sensação de site "quebrado" e necessidade de zoom-out manual.

### 2.5. Áreas Seguras (Safe Areas)
* **Sintoma:** Conteúdo cortado pelo "Notch" (câmera) ou pela barra de navegação inferior do iPhone.
* **Causa Técnica:** Falta de aplicação das variáveis de ambiente CSS `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`.

---

## 3. Plano de Ação Faseado

### FASE 1: Estrutura e Correções Críticas (Critical Path)
*Foco: Fazer o sistema caber na tela e parar de quebrar.*

1.  **Implementar `ResponsiveDialog`:**
    * Criar componente híbrido.
    * **Desktop:** Renderiza como `Dialog` (Modal Central).
    * **Mobile:** Renderiza como `Drawer` (Bottom Sheet/Gaveta).
    * *Benefício:* Resolve o problema do teclado e melhora a usabilidade com o polegar.
2.  **Fix de Fontes iOS:**
    * Forçar classe `text-base` (16px) em todos os inputs (`Input`, `Select`, `Textarea`) quando em viewports móveis.
3.  **Wrapper de Layout Seguro:**
    * Ajustar o `MainLayout` para incluir padding dinâmico baseado nas Safe Areas do dispositivo.

### FASE 2: Adaptação de Dados (Data Presentation)
*Foco: Tornar a leitura de dados fluida.*

1.  **Padrão "Card List" (Lista de Cartões):**
    * Substituir visualmente as Tabelas por Listas de Cartões no mobile.
    * Utilizar classes utilitárias `hidden md:table` (esconde tabela no mobile) e `block md:hidden` (mostra cards no mobile).
2.  **Filtros em Gaveta:**
    * Mover barras de filtros complexas para dentro de um Drawer dedicado, limpando a área nobre da tela.

### FASE 3: Refinamento e UX Nativa (Polish)
*Foco: Sensação de App Nativo.*

1.  **Navegação Inferior (Bottom Navigation):**
    * Implementar barra fixa inferior para as ações principais (Dashboard, Financeiro, Pessoas), substituindo a dependência do menu "Hambúrguer" para tarefas frequentes.
2.  **Feedback Tátil:**
    * Aumentar áreas de toque para mínimo de 44px (padrão Apple/Google).
    * Adicionar estados de `active` nos botões.

---

## 4. Matriz de Componentes Propostos

| Componente | Desktop (Web) | Mobile (iOS/Android) | Ação Técnica |
| :--- | :--- | :--- | :--- |
| **Edição/Criação** | Modal Central (`Dialog`) | Gaveta Inferior (`Drawer`) | Componente Híbrido |
| **Listagem** | Tabela com Colunas | Lista de Cards Verticais | CSS Grid / Flexbox |
| **Filtros** | Barra Superior | Botão único -> Abre Gaveta | Reorganização de DOM |
| **Menu** | Sidebar Lateral | Sidebar (Hambúrguer) ou Bottom Bar | Layout Condicional |
| **Ação Principal** | Botão Topo/Direita | Botão Flutuante (FAB) ou Fixo Rodapé | `position: sticky` |

---

## 5. Critérios para Comparação (Benchmark)

Ao comparar esta análise com as outras ferramentas, verifique:

1.  **Especificidade Técnica:** A análise identificou *por que* o problema ocorre (ex: "font-size 14px no iOS") ou apenas disse "está ruim"?
2.  **Viabilidade:** A solução proposta exige reescrever o sistema todo ou aproveita a biblioteca atual (Shadcn/UI)? (Nossa proposta aproveita 100% da stack atual).
3.  **Hibridismo:** A solução considera que o sistema deve continuar funcionando bem no Desktop (PC da Secretaria), ou foca apenas no mobile estragando a web?
4.  **Padrões de OS:** A análise citou padrões nativos (Human Interface Guidelines da Apple / Material Design do Google)?