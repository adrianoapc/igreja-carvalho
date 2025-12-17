# Manual do Usuário - Sistema de Gestão de Igreja

> **Versão:** 1.0  
> **Última atualização:** Dezembro 2024

---

## Sumário

1. [Primeiros Passos](#1-primeiros-passos)
2. [Dashboard](#2-dashboard)
3. [Gestão de Pessoas](#3-gestão-de-pessoas)
4. [Módulo Financeiro](#4-módulo-financeiro)
5. [Cultos e Liturgia](#5-cultos-e-liturgia)
6. [Intercessão](#6-intercessão)
7. [Jornadas e Ensino](#7-jornadas-e-ensino)
8. [Projetos e Tarefas](#8-projetos-e-tarefas)
9. [Comunicação](#9-comunicação)
10. [Minha Área](#10-minha-área)
11. [Administração](#11-administração)

---

## 1. Primeiros Passos

### 1.1 Acessando o Sistema

1. Acesse o endereço do sistema no navegador
2. Na tela de login, insira seu **email** e **senha**
3. Clique em **"Entrar"**

![Tela de Login](./screenshots/placeholder-login.png)
> *Screenshot: Tela de login do sistema*

### 1.2 Primeiro Acesso (Cadastro)

1. Clique em **"Criar conta"** na tela de login
2. Preencha seu **email** e crie uma **senha**
3. Clique em **"Cadastrar"**
4. Você receberá acesso básico automaticamente

![Tela de Cadastro](./screenshots/placeholder-cadastro.png)
> *Screenshot: Formulário de criação de conta*

### 1.3 Autenticação Biométrica (Opcional)

Após o primeiro login, o sistema pode oferecer a opção de habilitar desbloqueio biométrico:

1. Ao aparecer o diálogo, clique em **"Habilitar"**
2. Siga as instruções do seu dispositivo para configurar
3. Nos próximos acessos, use biometria para entrar rapidamente

![Diálogo Biometria](./screenshots/placeholder-biometria.png)
> *Screenshot: Diálogo para habilitar autenticação biométrica*

---

## 2. Dashboard

O Dashboard é a página inicial após o login. O conteúdo varia conforme seu perfil de acesso.

### 2.1 Dashboard do Administrador/Pastor

![Dashboard Admin](./screenshots/placeholder-dashboard-admin.png)
> *Screenshot: Dashboard administrativo*

**Elementos disponíveis:**

| Elemento | Descrição |
|----------|-----------|
| Gráfico de Fluxo de Caixa | Entradas vs Saídas do mês |
| KPIs de Projetos | Tarefas atrasadas e projetos ativos |
| Alertas Pastorais | Membros que precisam de atenção |
| Aniversariantes | Próximos aniversários |

### 2.2 Dashboard do Membro

![Dashboard Membro](./screenshots/placeholder-dashboard-membro.png)
> *Screenshot: Dashboard do membro*

**Elementos disponíveis:**

| Elemento | Descrição |
|----------|-----------|
| Carrossel de Comunicados | Banners e avisos ativos |
| Carteirinha Digital | QR Code para check-in |
| Minhas Tarefas | Tarefas atribuídas a você |
| Ações Rápidas | Botões de acesso rápido |

### 2.3 Notificações

O sino no canto superior direito mostra suas notificações:

1. Clique no **ícone de sino** 🔔
2. Veja notificações não lidas
3. Clique em uma notificação para ser direcionado

![Notificações](./screenshots/placeholder-notificacoes.png)
> *Screenshot: Painel de notificações*

---

## 3. Gestão de Pessoas

### 3.X Pessoas / Membros
- **Onde acessar**: Menu lateral → **Pessoas** → escolha **Todos**, **Membros**, **Visitantes** ou **Frequentadores** (atalhos principais) ou use a página inicial de Pessoas.
- **Ao abrir a tela**: você vê cards/estatísticas (totais por status), atalhos rápidos, e a lista de pessoas com nome, contato, status e avatar (quando cadastrado). Em dispositivos móveis, os cards podem ocupar mais espaço; role para chegar na lista.
- **Buscar/filtrar** (passo a passo):
   1. Use a barra de busca (nome, telefone ou email)
   2. Selecione o filtro de **Status** (Visitante/Frequentador/Membro)
   3. Confira os contadores por status para validar o filtro
   4. Role para carregar mais pessoas (infinite scroll)
- **Cadastrar nova pessoa** (passo a passo):
   1. Clique em **+ Novo** (na lista ou no atalho de Membros/Visitantes)
   2. Preencha **Nome** (obrigatório)
   3. Informe **Telefone ou Email** (recomendado para contato)
   4. Defina **Status inicial**: Visitante, Frequentador ou Membro
   5. Salve para concluir o cadastro; a pessoa aparece na listagem
- **Editar pessoa existente** (passo a passo):
   1. Abra a pessoa pela lista (clique no nome)
   2. Use **Editar** para ajustar dados pessoais/contatos/status
   3. Salve; a lista e o perfil são atualizados
- **Campos obrigatórios e validações**: Nome é obrigatório; status deve ser um dos valores válidos (Visitante/Frequentador/Membro); contatos ajudam na busca e no follow-up. Em mobile, priorize inserir contato para facilitar ações posteriores.
- **Vincular funções/roles ministeriais**: No perfil, acesse a área de status/igreja e atribua funções (quando disponível) conforme a liderança definir.

**Exemplos práticos**
- Cadastro de novo membro: Pessoas → Membros → **+ Novo** → Nome obrigatório, telefone/email recomendado, status **membro** → Salvar → aparece na lista com badge.
- Atualização de dados: Pessoas → Todos → abra a pessoa → **Editar** → ajuste endereço/telefone/status → Salvar → a listagem reflete as alterações.

**Links úteis**: [Fluxo Pessoas](diagramas/fluxo-pessoas.md) · [Sequência Pessoas](diagramas/sequencia-pessoas.md)
**Referências complementares**: [BIDIRECTIONAL_RELATIONSHIPS.md](BIDIRECTIONAL_RELATIONSHIPS.md) (lista familiares nos dois sentidos), [AUTHORIZED_GUARDIANS.md](AUTHORIZED_GUARDIANS.md) (responsáveis autorizados para crianças) e [KIDS_INCLUSION.md](KIDS_INCLUSION.md) (campo de necessidades especiais no Kids).

### 3.1 Acessando o Módulo

1. No menu lateral, clique em **"Pessoas"**
2. O módulo se expande mostrando as opções

![Menu Pessoas](./screenshots/placeholder-menu-pessoas.png)
> *Screenshot: Menu expandido de Pessoas*

### 3.2 Visão Geral

A página inicial do módulo mostra:

- **Estatísticas**: Total de membros, visitantes, frequentadores
- **Aniversariantes**: Calendário de aniversários
- **Ações rápidas**: Botões para cadastros

![Pessoas Visão Geral](./screenshots/placeholder-pessoas-geral.png)
> *Screenshot: Visão geral do módulo Pessoas*

### 3.3 Cadastrando um Visitante

1. Acesse **Pessoas > Visitantes**
2. Clique em **"+ Novo Visitante"**
3. Preencha os dados:
   - Nome completo
   - Telefone (WhatsApp)
   - Como conheceu a igreja
   - Tipo: Visitante ou Frequentador

![Cadastro Visitante](./screenshots/placeholder-cadastro-visitante.png)
> *Screenshot: Formulário de cadastro de visitante*

4. Clique em **"Salvar"**

### 3.4 Visualizando um Perfil

1. Na lista de pessoas, clique no **nome** da pessoa
2. A página de detalhes abre com as abas:

| Aba | Conteúdo |
|-----|----------|
| **Perfil** | Resumo de todos os dados (somente leitura) |
| **Pessoais** | Dados pessoais editáveis |
| **Contatos** | Email, telefone, endereço |
| **Igreja** | Funções e status eclesiástico |
| **Mais** | Observações e dados adicionais |

![Perfil Pessoa](./screenshots/placeholder-perfil-pessoa.png)
> *Screenshot: Página de detalhes da pessoa*

### 3.5 Editando Dados

1. Acesse a aba desejada (ex: **Pessoais**)
2. Clique no botão **"Editar"** (ícone de lápis)
3. Modifique os campos necessários
4. Clique em **"Salvar"**

![Editar Dados](./screenshots/placeholder-editar-dados.png)
> *Screenshot: Diálogo de edição de dados pessoais*

### 3.6 Promovendo Status

Para promover uma pessoa (Visitante → Frequentador → Membro):

1. Acesse o perfil da pessoa
2. Na aba **Igreja**, clique em **"Alterar Status"**
3. Selecione o novo status
4. Confirme a alteração

![Alterar Status](./screenshots/placeholder-alterar-status.png)
> *Screenshot: Diálogo de alteração de status*

### 3.7 Atribuindo Funções

1. Acesse o perfil da pessoa
2. Na aba **Igreja**, seção **"Funções"**
3. Clique em **"+ Atribuir Função"**
4. Selecione a função desejada
5. Defina a data de início
6. Clique em **"Salvar"**

![Atribuir Função](./screenshots/placeholder-atribuir-funcao.png)
> *Screenshot: Diálogo de atribuição de função*

### 3.8 Gerenciando Familiares

Na página de detalhes da pessoa:

1. Role até a seção **"Familiares"**
2. Clique em **"+ Adicionar Familiar"**
3. Selecione um membro existente ou cadastre novo
4. Defina o tipo de parentesco
5. Clique em **"Salvar"**

![Familiares](./screenshots/placeholder-familiares.png)
> *Screenshot: Seção de familiares no perfil*

---

## 4. Módulo Financeiro

### Visão Geral do Módulo

O módulo financeiro separa claramente três conceitos fundamentais para garantir relatórios contábeis precisos:

- **Fato Gerador (Competência)**: Registra quando e por que o valor foi originado, independente do momento do pagamento
- **Fluxo de Caixa**: Registra quando e como o dinheiro efetivamente entrou ou saiu
- **DRE (Demonstrativo de Resultado)**: Relatório contábil que mostra o resultado por competência

> **Importante**: Esta separação está documentada no [ADR-001](adr/ADR-001-separacao-fato-gerador-caixa-dre.md) e é fundamental para a integridade contábil do sistema.

Para visualizar os fluxos completos:
- [Fluxo Financeiro Geral](diagramas/fluxo-financeiro.md)
- [Sequência de Eventos](diagramas/sequencia-financeira.md)
- [Composição do DRE](diagramas/dre.md)

---

### 4.1 Acessando o Módulo

1. No menu lateral, clique em **"Finanças"**
2. O módulo se expande mostrando as opções

![Menu Finanças](./screenshots/placeholder-menu-financas.png)
> *Screenshot: Menu expandido de Finanças*

### 4.2 Dashboard Financeiro

A visão geral financeira mostra:

- **Saldo consolidado** de todas as contas
- **Gráficos** de receitas vs despesas
- **Resumo mensal** com totais

![Dashboard Financeiro](./screenshots/placeholder-dashboard-financeiro.png)
> *Screenshot: Dashboard financeiro*

### 4.3 Registrando uma Entrada (Receita)

#### Cenário 1: Oferta Simples (Fato Gerador + Caixa Simultâneos)

1. Acesse **Finanças > Entradas**
2. Clique em **"+ Nova Entrada"**
3. Preencha os campos:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Descrição | Nome/motivo da entrada | "Oferta Culto Domingo" |
| Valor | Valor em reais | R$ 500,00 |
| Data | Data da transação | 15/12/2024 |
| Conta | Conta de destino | Conta Corrente |
| Categoria | Classificação contábil | Receitas Operacionais > Ofertas |
| Forma de Pagamento | PIX, Dinheiro, etc. | PIX |

![Nova Entrada](./screenshots/placeholder-nova-entrada.png)
> *Screenshot: Formulário de nova entrada*

4. Clique em **"Salvar"**

**O que acontece:**
- ✅ **Fato Gerador** criado: "Oferta Culto Domingo" em Receitas Operacionais
- ✅ **Caixa** atualizado: +R$ 500 na Conta Corrente
- ✅ **DRE** impactado: +R$ 500 em Receitas do mês

---

### 4.4 Registrando uma Saída (Despesa)

#### Cenário 2: Despesa com Parcelamento (Fato Gerador Único + Múltiplas Transações de Caixa)

1. Acesse **Finanças > Saídas**
2. Clique em **"+ Nova Saída"**
3. Preencha os campos:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Descrição | Natureza da despesa | "Equipamento de Som" |
| Valor | Valor total | R$ 3.000,00 |
| Data | Data de competência | 10/12/2024 |
| Conta | Conta de origem | Conta Corrente |
| Categoria | Classificação contábil | Despesas Administrativas > Equipamentos |
| Fornecedor | Quem recebe | Loja de Som LTDA |
| Forma de Pagamento | Como será pago | Parcelado 3x |

![Nova Saída](./screenshots/placeholder-nova-saida.png)
> *Screenshot: Formulário de nova saída*

4. **Opcional**: Anexe nota fiscal (imagem ou PDF)
5. Clique em **"Salvar"**

**O que acontece:**
- ✅ **Fato Gerador** criado: "Equipamento de Som" R$ 3.000 em Despesas Administrativas
- ✅ **3 Transações de Caixa** agendadas: R$ 1.000 cada mês
- ✅ **DRE de dezembro**: -R$ 3.000 (impacto total no mês da competência)
- ✅ **Fluxo de Caixa**: -R$ 1.000 por mês (impacto mensal conforme pagamento)

> **Nota**: O DRE reflete o valor total no mês da decisão de compra, independente do parcelamento. O caixa mostra apenas o que saiu efetivamente em cada mês.

#### Processamento Automático de Nota Fiscal

Se você anexar uma nota fiscal:

1. O sistema usa IA (Gemini) para extrair os dados
2. Os campos são preenchidos automaticamente
3. Revise e ajuste se necessário
4. O fornecedor é criado automaticamente se não existir

### 4.5 Confirmando Pagamento

Para transações com status "Pendente":

1. Na lista, clique no menu **"⋮"** da transação
2. Selecione **"Confirmar Pagamento"**
3. Preencha:
   - Data do pagamento
   - Juros (se houver)
   - Multas (se houver)
   - Descontos (se houver)
4. Clique em **"Confirmar"**

![Confirmar Pagamento](./screenshots/placeholder-confirmar-pagamento.png)
> *Screenshot: Diálogo de confirmação de pagamento*

**O que acontece:**
- ✅ Status da transação muda para "Pago"
- ✅ Saldo da conta é atualizado
- ✅ Juros/multas/descontos **não alteram o DRE** (são ajustes de caixa)
- ✅ Se houver conciliação bancária, o lançamento pode ser marcado como conciliado

### 4.6 Filtrando Transações

Use o seletor de período no topo:

1. Clique no **MonthPicker**
2. Escolha:
   - **Mensal**: Mês específico ou presets
   - **Customizado**: Período personalizado
3. A lista é filtrada automaticamente

![Filtro Período](./screenshots/placeholder-filtro-periodo.png)
> *Screenshot: Seletor de período*

### 4.7 Relatório de Ofertas

1. Acesse **Finanças > Dashboard de Ofertas**
2. Clique em **"+ Novo Relatório"**
3. Preencha os valores por forma de pagamento
4. Clique em **"Salvar"**
5. Um conferente receberá notificação para validar

![Relatório Ofertas](./screenshots/placeholder-relatorio-ofertas.png)
> *Screenshot: Formulário de relatório de ofertas*

### 4.8 Gerenciando Reembolsos

#### Cenário 3: Líder Comprou Material e Precisa Ser Reembolsado

1. **Registre o Fato Gerador (Despesa Real)**
   - Acesse **Finanças > Saídas**
   - Descrição: "Material de Evangelismo"
   - Categoria: Despesas Ministeriais > Evangelismo
   - Fornecedor: Papelaria XYZ
   - Valor: R$ 200
   - Observações: "Comprado por João Silva - Aguardando reembolso"

2. **Registre a Transação de Caixa (Reembolso ao Líder)**
   - Acesse **Finanças > Saídas**
   - Descrição: "Reembolso João Silva - Material Evangelismo"
   - Categoria: *Mesma categoria do fato gerador*
   - Valor: R$ 200
   - Conta: Caixa ou Transferência
   - Marque como "Reembolso" (se disponível)

**Resultado:**
- ✅ **DRE**: Registra despesa de R$ 200 em "Evangelismo" (natureza correta)
- ✅ **Caixa**: Registra saída de R$ 200 para João Silva
- ✅ **Rastreabilidade**: Vinculação entre o fato gerador e o reembolso

> **Importante**: Reembolsos **não alteram o DRE** porque já foram registrados no fato gerador original. O reembolso é apenas uma movimentação de caixa.

### 4.9 Estornando Lançamentos

#### Estorno de Fato Gerador

Use quando o lançamento foi feito por engano ou precisa ser cancelado:

1. Na lista de transações, clique no menu **"⋮"**
2. Selecione **"Estornar Fato Gerador"**
3. Informe a justificativa
4. Confirme

**Impacto:**
- ❌ **DRE**: O lançamento é removido (ou marcado como estornado)
- ❌ **Caixa**: Se já houve pagamento, o estorno não reverte automaticamente (faça estorno de caixa separadamente)

#### Estorno de Caixa

Use quando o pagamento foi feito por engano mas o fato gerador é válido:

1. Na lista de transações, clique no menu **"⋮"**
2. Selecione **"Estornar Pagamento"**
3. Informe a justificativa
4. Confirme

**Impacto:**
- ✅ **DRE**: Permanece inalterado
- ❌ **Caixa**: Saldo é revertido

> **Dica**: Estornos são auditados e registrados em log. Use com cautela e sempre informe uma justificativa clara.

### 4.10 Visualizando o DRE (Demonstrativo de Resultado)

1. Acesse **Finanças > Painéis > DRE**
2. Selecione o **ano** desejado
3. Visualize:
   - Receitas por categoria
   - Despesas por categoria
   - Resultado líquido

![DRE](./screenshots/placeholder-dre.png)
> *Screenshot: Relatório DRE*

**Interpretação:**
- **Receitas**: Todos os fatos geradores de entrada por competência
- **Despesas**: Todos os fatos geradores de saída por competência
- **Resultado**: Receita - Despesa (independente se foi pago ou não)

Para entender a composição do DRE em detalhes, consulte: [Diagrama DRE](diagramas/dre.md)

### 4.11 Reconciliação Bancária

1. Acesse **Finanças > Reconciliação**
2. Selecione a conta bancária
3. Importe o extrato bancário (Excel)
4. O sistema compara lançamentos previstos vs extrato
5. Marque transações conciliadas
6. Identifique divergências (juros, taxas, lançamentos não previstos)

**O que acontece:**
- ✅ Transações conciliadas recebem status "Conciliado"
- ⚠️ Divergências são destacadas para ajuste manual
- ✅ Saldo final é validado contra o extrato

### 4.12 Exportando Dados

Em qualquer lista financeira:

1. Clique no botão **"Exportar"** (ícone de download)
2. Um arquivo Excel será baixado com todos os dados filtrados

**Formatos disponíveis:**
- Transações completas (com categoria, fornecedor, forma de pagamento)
- DRE anual
- Projeções financeiras

---


### Referências Técnicas

Para entender melhor a arquitetura financeira e decisões técnicas:

- **Decisão Arquitetural**: [ADR-001 - Separação Fato Gerador vs Caixa vs DRE](adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
- **Fluxo Visual Completo**: [Diagrama de Fluxo Financeiro](diagramas/fluxo-financeiro.md)
- **Sequência Temporal**: [Diagrama de Sequência](diagramas/sequencia-financeira.md)
- **Composição do DRE**: [Diagrama DRE](diagramas/dre.md)
- **Funcionalidades Detalhadas**: [Documentação de Funcionalidades](funcionalidades.md#2-módulo-financeiro)

---

## 5. Cultos e Liturgia

### 5.1 Acessando o Módulo

1. No menu lateral, clique em **"Cultos"**
2. Visualize o calendário de eventos

![Calendário Cultos](./screenshots/placeholder-calendario-cultos.png)
> *Screenshot: Calendário de cultos*

### 5.2 Criando um Novo Culto

1. Clique em **"+ Novo Culto"**
2. Preencha:
   - Título
   - Tipo (Dominical, Especial, etc.)
   - Data e horário
   - Local
   - Tema (opcional)
   - Pregador (opcional)
3. Clique em **"Salvar"**

![Novo Culto](./screenshots/placeholder-novo-culto.png)
> *Screenshot: Formulário de novo culto*

### 5.3 Mesa de Controle do Culto

Ao clicar em um culto, você acessa a **Mesa de Controle** com as abas:

#### Aba Visão Geral

- Informações básicas do culto
- KPIs (duração estimada, voluntários escalados)
- Edição de tema, pregador, status

![Mesa Controle - Geral](./screenshots/placeholder-mesa-controle-geral.png)
> *Screenshot: Aba Visão Geral da Mesa de Controle*

#### Aba Liturgia

Interface dividida em duas colunas:

**Coluna Esquerda - Timeline:**
- Lista ordenável de itens da liturgia
- Arraste para reordenar
- Clique para selecionar

**Coluna Direita - Editor:**
- Detalhes do item selecionado
- Recursos de mídia vinculados

![Mesa Controle - Liturgia](./screenshots/placeholder-mesa-controle-liturgia.png)
> *Screenshot: Aba Liturgia da Mesa de Controle*

##### Adicionando Item à Liturgia

1. Clique em **"+ Adicionar Item"**
2. Preencha:
   - Título
   - Tipo (Abertura, Louvor, Pregação, etc.)
   - Duração estimada
   - Responsável
3. Clique em **"Salvar"**

##### Vinculando Mídia ao Item

Para itens de avisos/anúncios:

1. Selecione o item na timeline
2. No painel direito, seção **"Recursos"**
3. Clique em **"+ Adicionar Mídia"**
4. Selecione da biblioteca ou faça upload
5. Defina a duração de exibição (em segundos)

#### Aba Música

- Lista de músicas do culto
- Campos: Título, Artista, Tom, BPM
- Atribuição de Ministro e Solista

![Mesa Controle - Música](./screenshots/placeholder-mesa-controle-musica.png)
> *Screenshot: Aba Música da Mesa de Controle*

##### Adicionando Música

1. Clique em **"+ Adicionar Música"**
2. Preencha os detalhes
3. Opcional: Adicione links do YouTube/Spotify
4. Clique em **"Salvar"**

#### Aba Escalas

Visualização e gestão dos voluntários escalados:

1. Veja times necessários
2. Para cada posição, selecione um membro
3. Voluntários receberão notificação para confirmar

![Mesa Controle - Escalas](./screenshots/placeholder-mesa-controle-escalas.png)
> *Screenshot: Aba Escalas da Mesa de Controle*

### 5.4 Usando Templates

#### Aplicando Template de Liturgia

1. Na aba Liturgia, clique em **"Aplicar Template"**
2. Selecione um template da lista
3. Visualize a prévia
4. Clique em **"Aplicar"**
5. Os itens são adicionados automaticamente

![Aplicar Template](./screenshots/placeholder-aplicar-template.png)
> *Screenshot: Diálogo de seleção de template*

#### Salvando como Template

1. Configure a liturgia desejada
2. Clique em **"Salvar como Template"**
3. Dê um nome e descrição
4. Clique em **"Salvar"**

### 5.5 Projeção (Telão)

Para apresentar na igreja:

1. Na Mesa de Controle, clique em **"Modo Apresentação"**
2. Uma nova aba abre em tela cheia
3. Use os controles de teclado:

| Tecla | Ação |
|-------|------|
| **→** ou **Espaço** | Próximo slide |
| **←** | Slide anterior |
| **F** | Tela cheia |
| **P** | Pausar/retomar auto-play |
| **B** | Tela preta |
| **C** | Limpar tela |

![Telão](./screenshots/placeholder-telao.png)
> *Screenshot: Tela de projeção*

> **Nota**: O telão atualiza em tempo real. Alterações feitas na Mesa de Controle são refletidas instantaneamente.

---

## 6. Intercessão

### 6.1 Acessando o Módulo

1. No menu lateral, clique em **"Intercessão"**
2. O módulo se expande

![Menu Intercessão](./screenshots/placeholder-menu-intercessao.png)
> *Screenshot: Menu de Intercessão*

### 6.2 Visão Geral

Dashboard com:

- Pedidos pendentes de alocação
- Intercessores ativos
- Testemunhos aguardando aprovação
- Estatísticas gerais

![Intercessão Geral](./screenshots/placeholder-intercessao-geral.png)
> *Screenshot: Dashboard de Intercessão*

### 6.3 Pedidos de Oração

#### Visualizando Pedidos

1. Acesse **Intercessão > Pedidos de Oração**
2. Use os filtros:
   - Por status (Pendente, Alocado, etc.)
   - Por tipo (Saúde, Família, etc.)

![Lista Pedidos](./screenshots/placeholder-lista-pedidos.png)
> *Screenshot: Lista de pedidos de oração*

#### Alocando para Intercessor

1. Clique no pedido para abrir detalhes
2. Clique em **"Alocar Intercessor"**
3. Selecione um intercessor disponível
4. Clique em **"Confirmar"**

![Alocar Intercessor](./screenshots/placeholder-alocar-intercessor.png)
> *Screenshot: Diálogo de alocação*

### 6.4 Intercessores

#### Cadastrando Intercessor

1. Acesse **Intercessão > Intercessores**
2. Clique em **"+ Novo Intercessor"**
3. Preencha:
   - Nome
   - Email
   - Telefone
   - Máximo de pedidos simultâneos
4. Clique em **"Salvar"**

![Novo Intercessor](./screenshots/placeholder-novo-intercessor.png)
> *Screenshot: Formulário de intercessor*

### 6.5 Testemunhos

#### Aprovando Testemunho

1. Acesse **Intercessão > Testemunhos**
2. Clique em um testemunho com status "Aberto"
3. Revise o conteúdo
4. Clique em **"Aprovar para Publicação"** ou **"Arquivar"**

![Aprovar Testemunho](./screenshots/placeholder-aprovar-testemunho.png)
> *Screenshot: Detalhes do testemunho*

### 6.6 Sentimentos

#### Monitorando Sentimentos

1. Acesse **Intercessão > Sentimentos**
2. Visualize:
   - Gráfico de sentimentos por período
   - **Alertas Críticos**: Membros com 3+ dias negativos

![Sentimentos](./screenshots/placeholder-sentimentos.png)
> *Screenshot: Dashboard de sentimentos*

#### Alertas Críticos

Quando um membro registra sentimentos negativos por 3 dias consecutivos:

1. Um alerta é exibido no dashboard
2. Mostra informações de contato
3. Botão para enviar mensagem WhatsApp

![Alerta Crítico](./screenshots/placeholder-alerta-critico.png)
> *Screenshot: Card de alerta crítico*

---

## 7. Jornadas e Ensino

### 7.1 Jornadas (Cursos)

#### Criando uma Jornada

1. Acesse **Jornadas** no menu
2. Clique em **"+ Nova Jornada"**
3. Preencha:
   - Título
   - Descrição
   - Cor do tema
   - **Requer pagamento** (opcional): Marque se o curso é pago
   - **Valor** (se pago): Defina o valor do curso
4. Clique em **"Salvar"**

#### Cursos Pagos

Para jornadas que requerem pagamento:

1. Ao criar/editar a jornada, marque **"Requer pagamento"**
2. Informe o **valor** do curso
3. Ao inscrever participantes, o status de pagamento inicia como **"Pendente"**
4. Quando o pagamento for confirmado, atualize para **"Pago"**
5. Participantes isentos podem ter status alterado para **"Isento"**

> **Nota**: Pagamentos confirmados podem ser vinculados a transações financeiras (categoria "Cursos e Treinamentos") para rastreabilidade contábil.

![Nova Jornada](./screenshots/placeholder-nova-jornada.png)
> *Screenshot: Formulário de nova jornada*

#### Configurando Etapas

1. Acesse a jornada criada
2. Clique em **"+ Nova Etapa"**
3. Para cada etapa, defina:
   - Título
   - **Tipo de conteúdo**: Texto, Vídeo, Quiz, Tarefa ou Reunião
   - **URL do conteúdo** (para vídeo): Link do YouTube, Vimeo ou embed
   - **Duração estimada** (minutos): Tempo previsto para conclusão
   - **Check automático**: Se marcado, sistema avança sozinho ao completar
   - Ordem na sequência
4. Clique em **"Salvar"**

##### Configurando Quiz (Tipo Quiz)

1. Ao selecionar tipo **"Quiz"**, configure:
   - **Nota mínima**: Pontuação necessária para aprovação (ex: 7)
   - **Perguntas**: Lista de questões com alternativas
2. O aluno pode tentar múltiplas vezes
3. Sistema registra nota, aprovação e número de tentativas

![Etapas Jornada](./screenshots/placeholder-etapas-jornada.png)
> *Screenshot: Configuração de etapas*

#### Kanban de Participantes

1. Visualize as etapas como colunas
2. Cada participante é um card
3. Arraste para mover entre etapas
4. Veja progresso e responsável

![Kanban Jornada](./screenshots/placeholder-kanban-jornada.png)
> *Screenshot: Board Kanban da jornada*

#### Inscrevendo Participante

1. Clique em **"+ Adicionar Pessoa"**
2. Selecione a pessoa
3. Defina o responsável/discipulador
4. Clique em **"Salvar"**

#### Usando o Player do Curso (Aluno)

1. Acesse **Meus Cursos** e abra o curso desejado
2. Navegue pelas etapas (vídeo/texto/quiz/tarefa/reunião)
3. Etapas com **check automático** liberam automaticamente quando concluídas; etapas manuais pedem **"Marcar como Concluído"**
4. Quando **todas as etapas** estiverem concluídas, o player mostra uma tela de celebração e um botão **"Baixar Certificado"** (também disponível na sidebar)
5. Clique em **"Baixar Certificado"** para gerar o PDF (pode ser necessário permitir pop-ups)

> Observação: Cursos pagos permanecem bloqueados enquanto o pagamento estiver **pendente**; o certificado só aparece após 100% das etapas concluídas.

### 7.2 Ensino (Gestão de Aulas)

#### Agendando uma Aula

1. Acesse **Ensino** no menu
2. Clique em **"+ Nova Aula"**
3. Preencha:
   - Jornada vinculada
   - Tema
   - Data e horário
   - Modalidade (Presencial/Online/Híbrido)
   - Sala (se presencial)
4. Clique em **"Salvar"**

![Nova Aula](./screenshots/placeholder-nova-aula.png)
> *Screenshot: Drawer de nova aula*

#### Registrando Presenças (Check-in Manual)

1. Acesse **Ensino** e escolha a aula do dia.
2. Clique em **"Check-in Manual"**.
3. Filtre/busque a criança ou aluno.
4. Confirme o registro; presenças duplicadas são avisadas.
5. Opcional: imprima etiqueta de segurança quando disponível.

### 7.3 Ministério Infantil (Kids)

#### Configurando Salas

1. Acesse **Ensino > Configurações**
2. Clique em **"+ Nova Sala"**
3. Preencha:
   - Nome (ex: "Sala 1 - Berçário")
   - Capacidade máxima
   - Idade mínima e máxima
4. Clique em **"Salvar"**

![Nova Sala](./screenshots/placeholder-nova-sala.png)
> *Screenshot: Formulário de sala*

#### Fazendo Check-in de Criança

1. Acesse **Ensino > Ministério Infantil**
2. Selecione a aula do dia
3. Clique em **"+ Check-in"**
4. Selecione a criança
5. Sistema gera etiquetas de segurança

![Check-in Kids](./screenshots/placeholder-checkin-kids.png)
> *Screenshot: Tela de check-in*

#### Imprimindo Etiquetas

Após o check-in:

1. Clique em **"Imprimir Etiquetas"**
2. Sistema gera:
   - **Etiqueta da Criança**: Nome, sala, código de segurança
   - **Etiqueta do Responsável**: Nome da criança, código

![Etiquetas](./screenshots/placeholder-etiquetas.png)
> *Screenshot: Preview das etiquetas*

#### Fazendo Check-out

1. Na lista de presentes, localize a criança
2. Clique em **"Check-out"**
3. Confirme o responsável que está retirando
4. Verifique o código de segurança

**Links relacionados**
- Funcionalidades — Jornadas e Ensino: `funcionalidades.md#5-jornadas-e-ensino`
- Produto — Jornadas e Ensino: `produto/README_PRODUTO.MD#jornadas-e-ensino-visão-de-produto`
- Diagramas: `diagramas/fluxo-ensino.md`, `diagramas/sequencia-ensino.md`, `diagramas/fluxo-cursos-pagos.md`

---

## 8. Projetos e Tarefas

### 8.1 Criando um Projeto

1. Acesse **Projetos** no menu
2. Clique em **"+ Novo Projeto"**
3. Preencha:
   - Título
   - Descrição
   - Líder responsável
   - Data de início e fim prevista
4. Clique em **"Salvar"**

![Novo Projeto](./screenshots/placeholder-novo-projeto.png)
> *Screenshot: Formulário de novo projeto*

### 8.2 Kanban de Tarefas

Ao acessar um projeto:

1. Visualize três colunas:
   - **Não Iniciado**
   - **Em Execução**
   - **Finalizado**
2. Arraste tarefas entre colunas
3. A barra de progresso atualiza automaticamente

![Kanban Tarefas](./screenshots/placeholder-kanban-tarefas.png)
> *Screenshot: Board de tarefas*

### 8.3 Criando Tarefas

1. Clique em **"+ Nova Tarefa"**
2. Preencha:
   - Título
   - Descrição
   - Responsável
   - Prioridade (Baixa/Média/Alta)
   - Data de vencimento
3. Clique em **"Salvar"**

![Nova Tarefa](./screenshots/placeholder-nova-tarefa.png)
> *Screenshot: Formulário de tarefa*

### 8.4 Tarefas Atrasadas

Tarefas vencidas aparecem destacadas em **vermelho**. O dashboard também mostra um contador de tarefas atrasadas.

---

## 9. Comunicação

O módulo de Comunicação permite que liderança e secretaria criem e publiquem comunicados institucionais (avisos, banners, alertas) manualmente, controlando onde e quando serão exibidos (app, telão/projetor, site).

**Observação:** Este módulo é para criação editorial de conteúdo. Notificações automáticas de sistema são gerenciadas em outro módulo.

### 9.1 Acessando o Módulo

- **Onde acessar**: Menu lateral → **Comunicação** ou **Publicação** (ou navegue para `/comunicados`).
- **Ao abrir a tela**: você vê a lista de comunicados existentes com título, status (ativo/inativo), canais de exibição (app, telão, site) e datas de início/fim.
- **Permissões**: apenas administradores e liderança podem criar/editar comunicados (RLS `comunicados_gestao_admin`).

![Hub Publicação](./screenshots/placeholder-hub-publicacao.png)
> *Screenshot: Hub de publicação*

### 9.2 Criando um Comunicado (passo a passo)

1. Acesse **Comunicação** → **Comunicados**
2. Clique em **"+ Novo Comunicado"**
3. Preencha os dados no wizard de 3 passos:

#### Passo 1: Conteúdo

- **Título** (obrigatório): nome do comunicado
- **Tipo**: escolha **Banner** (visual com imagem) ou **Alerta** (mensagem de urgência)
- **Descrição/Mensagem**: texto do comunicado (para alertas, é obrigatório)
- **Imagem**: faça upload ou selecione uma mídia da biblioteca
  - Formatos aceitos: imagem (JPG, PNG) ou vídeo (a confirmar)
  - Armazenamento: storage bucket público `comunicados`
- **Link de ação** (opcional): URL para direcionar quando o usuário clicar

![Comunicado Passo 1](./screenshots/placeholder-comunicado-passo1.png)
> *Screenshot: Passo 1 - Conteúdo*

#### Passo 2: Canais de Publicação

Defina onde o comunicado será exibido (múltipla escolha):
- ☐ **App/Dashboard**: aparece no carrossel do dashboard dos membros
- ☐ **Telão/Projetor**: entra na playlist do ProPresenter ou sistema de projeção
  - Pode definir **ordem de exibição** no telão (campo `ordem_telao`)
  - Pode enviar **arte alternativa** para telão (16:9 vs 9:16 no campo `url_arquivo_telao`)
- ☐ **Site Público**: exibido no carrossel do site da igreja

**Observação:** Um comunicado pode ser publicado em múltiplos canais simultaneamente.

![Comunicado Passo 2](./screenshots/placeholder-comunicado-passo2.png)
> *Screenshot: Passo 2 - Canais*

#### Passo 3: Agendamento e Categorização

- **Data de início**: quando o comunicado começa a ser exibido
- **Data de fim** (opcional): quando expira automaticamente
- **Nível de urgência** (a confirmar): para priorização visual
- **Categoria de mídia** (opcional): `geral`, `eventos`, `liturgia` (campo `categoria_midia`)
- **Tags** (opcional): para organização (ex.: `Abertura`, `Louvor`, `Avisos Gerais`)
- **Vincular a culto** (opcional): associa o comunicado a um culto específico (FK `culto_id`)

![Comunicado Passo 3](./screenshots/placeholder-comunicado-passo3.png)
> *Screenshot: Passo 3 - Agendamento*

4. Clique em **"Publicar"** para ativar o comunicado

### 9.3 Editando e Gerenciando Comunicados

- **Visualizar lista**: Na tela principal de Comunicados, você vê todos os comunicados cadastrados com contadores por status.
- **Editar**: Clique no comunicado desejado para abrir o diálogo de edição (mesmo wizard de 3 passos).
- **Ativar/Desativar**: Use o toggle de status `ativo` para pausar ou retomar a exibição sem excluir o comunicado.
- **Excluir**: Clique em **Excluir** (ícone de lixeira); a imagem vinculada será removida do storage `comunicados` se não estiver em uso por outros registros.

### 9.4 Histórico e Status

- **Status disponíveis**: `ativo` (sendo exibido) ou `inativo` (pausado/expirado).
- **Contadores**: A tela exibe quantos comunicados estão cadastrados e quantos estão ativos no momento.
- **Filtros** (a confirmar): buscar por título, filtrar por canal de exibição, ordenar por data de criação/atualização.

### 9.5 Definindo Público-Alvo

**Observação:** A segmentação de público no módulo Comunicação é feita por **canal de exibição** (app, telão, site), não por perfis de usuário individuais.

- **App/Dashboard**: todos os membros logados veem os comunicados ativos no carrossel do dashboard.
- **Telão**: exibido durante cultos/eventos para toda a congregação presente.
- **Site Público**: visível para visitantes e público geral no site da igreja.

Não há segmentação por roles (admin, membro, visitante) ou grupos específicos dentro do módulo. Para comunicação direcionada (ex.: apenas líderes), use outros canais (a confirmar) ou ajuste as permissões de acesso às páginas.

### 9.6 Visualização nos Canais

#### No App/Dashboard
- Membros veem os comunicados ativos no **carrossel de banners** (`BannerCarousel.tsx`) na tela principal.
- Query: `SELECT * FROM comunicados WHERE ativo = true AND exibir_app = true AND (data_inicio <= NOW() AND (data_fim IS NULL OR data_fim >= NOW()))`.

#### No Telão/Projetor
- Comunicados com `exibir_telao = true` são consumidos pela página `/telao` (`Telao.tsx`).
- Exibição em carrossel automático com controles de navegação e pausa.
- Ordem definida pelo campo `ordem_telao`.

#### No Site Público
- Comunicados com `exibir_site = true` são exibidos no carrossel do site (integração a confirmar).

**Links úteis**: (diagrama de fluxo de comunicação a criar)

**Referências complementares**: [Visão de produto — Comunicação](produto/README_PRODUTO.MD)

### 9.3 Biblioteca de Mídias

1. Acesse **Mídias** no menu
2. Visualize todas as imagens e vídeos
3. Use filtros por tags

#### Adicionando Mídia

1. Clique em **"+ Nova Mídia"**
2. Faça upload do arquivo
3. Preencha título e descrição
4. Adicione tags para categorização
5. Clique em **"Salvar"**

![Nova Mídia](./screenshots/placeholder-nova-midia.png)
> *Screenshot: Upload de mídia*

---

## 10. Notificações

O módulo de **Notificações** entrega alertas automáticos do sistema diretamente para você, baseado em eventos relevantes da sua área de atuação (role). Diferente da **Comunicação** (que é criação manual de avisos), as notificações são **disparadas automaticamente** pelo sistema sempre que algo importante acontece.

### 10.1 Acessando Notificações

1. No canto superior direito da barra de navegação, clique no **ícone de sino 🔔**
2. Um popover abre com a lista de notificações recentes
3. Notificações **não lidas** aparecem com uma bolinha azul à esquerda e fundo branco
4. Notificações já lidas ficam acinzentadas

![Sino de Notificações](./screenshots/placeholder-sino-notificacoes.png)
> *Screenshot: Popover de notificações*

### 10.2 Tipos de Notificações

As notificações são categorizadas automaticamente:

- **💰 Financeiro**: nova conta a pagar, reembolso aguardando aprovação
- **👶 Kids**: check-in realizado, ocorrência/choro de criança
- **🙏 Intercessão**: novo pedido de oração cadastrado
- **👋 Recepção**: novo visitante registrado no sistema
- **⚠️ Alerta**: situações críticas ou de urgência
- **📅 Agenda**: lembretes de escalas ou cultos

Cada tipo tem **ícone e cor próprios** para rápida identificação visual.

### 10.3 Interagindo com Notificações

#### Ver detalhes:
- Clique sobre a notificação para **ser redirecionado** à tela correspondente (ex: clicar em "Nova Conta a Pagar" leva ao Financeiro)

#### Marcar como lida:
- Ao clicar, a notificação é **automaticamente marcada como lida**
- Você também pode clicar em **"Limpar"** (botão no topo) para marcar **todas como lidas de uma vez**

#### Excluir:
- Passe o mouse sobre uma notificação e clique no **ícone de lixeira** que aparece à direita

![Ações de Notificação](./screenshots/placeholder-acoes-notificacao.png)
> *Screenshot: Ações em notificações*

### 10.4 Canais de Entrega

Você pode receber notificações por até **3 canais diferentes**, dependendo da configuração do seu cargo:

1. **In-App (Sininho)**: sempre ativo, aparece na barra superior do sistema
2. **Push Notification**: alerta no navegador mesmo com aba fechada (requer permissão)
3. **WhatsApp**: mensagem via Meta API ou Make (a confirmar por evento)

> 🔐 **Permissão Push**: na primeira vez, o navegador solicitará permissão para enviar notificações. Aceite para receber alertas em tempo real.

### 10.5 Configurações de Notificações (Admin)

Se você é **Administrador**, pode gerenciar quais eventos disparam notificações e para quem:

1. Acesse **Admin > Notificações**
2. Você verá **cards de eventos** agrupados por categoria (Financeiro, Kids, Pessoas, Intercessão)
3. Para cada evento, há uma **tabela de destinatários** (roles) e **switches de canais**:
   - 🔔 **In-App**: sininho no sistema
   - 📱 **Push**: notificação no navegador/celular
   - 💬 **WhatsApp**: via integração externa

#### Adicionar destinatário:
1. Clique em **"+ Add"** no card do evento
2. Selecione o **role** (cargo) no dropdown
3. O destinatário é criado com canais padrão ativos

#### Ativar/Desativar canal:
- Use os **switches** (toggle) para ativar/desativar canais por destinatário
- Exemplo: "Tesoureiro recebe apenas in-app e push, sem WhatsApp"

#### Remover destinatário:
- Passe o mouse sobre a linha e clique no **ícone de lixeira**

![Admin Notificações](./screenshots/placeholder-admin-notificacoes.png)
> *Screenshot: Tela de configuração de notificações (admin)*

### 10.6 Eventos Disponíveis

Principais eventos que podem disparar notificações automáticas:

| Evento                          | Categoria    | Quando dispara                                    |
|---------------------------------|--------------|--------------------------------------------------|
| `financeiro_conta_vencer`       | Financeiro   | Nova conta a pagar cadastrada                     |
| `financeiro_reembolso_aprovacao`| Financeiro   | Reembolso aguardando aprovação                    |
| `kids_checkin`                  | Kids         | Criança fez check-in no ministério                |
| `kids_ocorrencia`               | Kids         | Registrada ocorrência/choro de criança            |
| `novo_visitante`                | Pessoas      | Novo visitante cadastrado no sistema              |
| `pedido_oracao`                 | Intercessão  | Novo pedido de oração recebido                    |

> 📌 **Nota**: A lista de eventos é expansível. Novos eventos podem ser adicionados conforme necessidades operacionais da igreja.

### 10.7 Diferença: Notificações vs. Comunicação

| Aspecto                | Notificações                          | Comunicação                        |
|------------------------|---------------------------------------|------------------------------------|
| **Origem**             | Automática (evento do sistema)        | Manual (criação humana)            |
| **Conteúdo**           | Template fixo (ex: "Nova conta X")    | Livre (banners, avisos, editoria)  |
| **Destinatário**       | Definido por role/cargo               | Público geral (app/telão/site)     |
| **Objetivo**           | Alerta operacional / ação requerida   | Informação institucional           |
| **Edição**             | Não editável (gerado pelo sistema)    | Totalmente editável                |

> **Regra de ouro**: Se é uma **reação a um evento do sistema**, é Notificação. Se é **conteúdo criado manualmente para comunicar algo**, é Comunicação.

---

## 11. Minha Área

### 10.1 Perfil

1. Clique no seu **avatar** no menu
2. Selecione **"Perfil"**

![Menu Perfil](./screenshots/placeholder-menu-perfil.png)
> *Screenshot: Menu do usuário*

#### Alterando Foto

1. Clique na foto de perfil
2. Tire uma foto ou selecione da galeria
3. Ajuste o enquadramento
4. Clique em **"Confirmar"**

![Upload Foto](./screenshots/placeholder-upload-foto.png)
> *Screenshot: Diálogo de foto de perfil*

#### Alterando Senha

1. Na aba **"Conta"**
2. Clique em **"Alterar Senha"**
3. Digite a nova senha
4. Confirme e clique em **"Salvar"**

### 10.2 Minhas Escalas

1. Acesse **Minhas Escalas** no menu
2. Visualize escalas atribuídas a você
3. Para cada escala:
   - Clique em **"Confirmar"** para aceitar
   - Clique em **"Recusar"** e informe o motivo

![Minhas Escalas](./screenshots/placeholder-minhas-escalas.png)
> *Screenshot: Lista de escalas*

### 10.3 Minha Família

1. Acesse **Minha Família** no menu
2. Visualize dependentes cadastrados
3. Clique em **"+ Adicionar Dependente"** para cadastrar filhos

![Minha Família](./screenshots/placeholder-minha-familia.png)
> *Screenshot: Página Minha Família*

### 10.4 Meus Cursos

1. Acesse **Meus Cursos** no menu
2. Visualize jornadas em que está inscrito
3. Clique em um curso para continuar estudando

![Meus Cursos](./screenshots/placeholder-meus-cursos.png)
> *Screenshot: Lista de cursos*

#### Inscrição em Cursos Pagos (Aluno)

Algumas jornadas/cursos podem exigir pagamento para liberar o conteúdo. O sistema diferencia cursos gratuitos e pagos para garantir uma experiência clara e segura.

**Como inscrever-se**
1. Acesse **Minha Área > Meus Cursos**.
2. Use as abas no topo:
   - **Meus cursos**: cursos já inscritos (com progresso e status).
   - **Disponíveis**: cursos abertos para inscrição.
3. Na aba **Disponíveis**, escolha o curso:
   - Se estiver marcado como **Pago**, o cartão exibe o **valor (R$)**.
4. Clique em **Inscrever-se**:
   - Cursos **gratuitos**: a inscrição é imediata e o acesso é liberado.
   - Cursos **pagos**: uma transação financeira de **entrada** é criada com **status pendente** e sua inscrição fica com **status_pagamento: pendente**.

**O que você verá após a inscrição paga**
- No painel **Meus cursos**, o curso aparece com o badge **“Aguardando Pagamento”**.
- Ao tentar abrir o **Player**, o acesso fica **bloqueado** até a confirmação de pagamento.
- Após a confirmação (baixa no módulo financeiro), o status muda para **pago** e o conteúdo é liberado.

**Dicas e avisos**
- Caso veja um aviso de **configuração financeira ausente**, procure a secretaria/tesouraria para ajustar a conta de recebimento (a confirmar conforme política interna).
- Formas de pagamento como **PIX/Cartão** não aparecem no app do aluno neste fluxo (a confirmar integração); a baixa é registrada administrativamente no módulo financeiro.

**Fluxo visual (Mermaid)**
- Consulte o diagrama: [Fluxo de Cursos Pagos](diagramas/fluxo-cursos-pagos.md)

### 10.5 Registrando Sentimento

1. No dashboard, clique em **"Como você está?"**
2. Selecione seu sentimento atual
3. Adicione uma mensagem (opcional)
4. Clique em **"Registrar"**

![Registrar Sentimento](./screenshots/placeholder-registrar-sentimento.png)
> *Screenshot: Diálogo de sentimento*

---

## 11. Administração

### 11.1 Painel Administrativo

1. Acesse **Admin** no menu (apenas administradores)
2. Visualize:
   - Edge Functions configuradas
   - Status de execução
   - Logs de erros

![Painel Admin](./screenshots/placeholder-painel-admin.png)
> *Screenshot: Painel administrativo*

### 11.2 Gerenciando Funções de Igreja

1. Acesse **Admin > Funções**
2. Visualize funções cadastradas
3. Clique em **"+ Nova Função"** para adicionar
4. Edite ou desative funções existentes

### 11.3 Configurações da Igreja

1. Acesse **Configurações** no menu
2. Edite:
   - Nome da igreja
   - Subtítulo
   - Logo
   - Webhook de integrações

![Configurações Igreja](./screenshots/placeholder-config-igreja.png)
> *Screenshot: Configurações da igreja*

### 11.4 Links Externos e QR Codes

Na página de Pessoas:

1. Encontre o card **"Links Externos"**
2. Copie links para:
   - Cadastro de visitante
   - Atualização de membro
3. Baixe QR Codes para impressão

![Links Externos](./screenshots/placeholder-links-externos.png)
> *Screenshot: Card de links externos*

---

## Apêndice A: Atalhos de Teclado

### Telão (Projeção)

| Tecla | Ação |
|-------|------|
| `→` ou `Espaço` | Próximo slide |
| `←` | Slide anterior |
| `F` | Alternar tela cheia |
| `P` | Pausar/retomar auto-play |
| `B` | Tela preta |
| `C` | Limpar tela |
| `Esc` | Sair da tela cheia |

---

## Apêndice B: Glossário

| Termo | Definição |
|-------|-----------|
| **Visitante** | Pessoa que visitou a igreja pela primeira vez |
| **Frequentador** | Pessoa que frequenta regularmente mas não é membro |
| **Membro** | Pessoa oficialmente membro da igreja |
| **Intercessor** | Membro dedicado a orar pelos pedidos recebidos |
| **Jornada** | Trilha de aprendizado/curso com múltiplas etapas |
| **Escala** | Atribuição de voluntário para servir em um culto |
| **Mesa de Controle** | Interface de gestão completa de um culto |
| **DRE** | Demonstrativo de Resultado do Exercício |

---

## Apêndice C: Suporte

Em caso de dúvidas ou problemas:

1. Verifique este manual
2. Entre em contato com o administrador do sistema
3. Reporte bugs ou sugestões

---

> **Nota**: Este manual contém placeholders para screenshots. Substitua os arquivos em `docs/screenshots/` pelas imagens reais do sistema.

---

*Documento gerado em Dezembro de 2024*
