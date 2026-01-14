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

> _Screenshot: Tela de login do sistema_

### 1.2 Primeiro Acesso (Cadastro)

1. Clique em **"Criar conta"** na tela de login
2. Preencha seu **email** e crie uma **senha**
3. Clique em **"Cadastrar"**
4. Você receberá acesso básico automaticamente

![Tela de Cadastro](./screenshots/placeholder-cadastro.png)

> _Screenshot: Formulário de criação de conta_

### 1.3 Autenticação Biométrica (Opcional)

Após o primeiro login, o sistema pode oferecer a opção de habilitar desbloqueio biométrico:

1. Ao aparecer o diálogo, clique em **"Habilitar"**
2. Siga as instruções do seu dispositivo para configurar
3. Nos próximos acessos, use biometria para entrar rapidamente

![Diálogo Biometria](./screenshots/placeholder-biometria.png)

> _Screenshot: Diálogo para habilitar autenticação biométrica_

---

## 2. Dashboard

O Dashboard é a página inicial após o login. O conteúdo varia conforme seu perfil de acesso.

### 2.1 Dashboard do Administrador/Pastor

![Dashboard Admin](./screenshots/placeholder-dashboard-admin.png)

> _Screenshot: Dashboard administrativo_

**Elementos disponíveis:**

| Elemento                  | Descrição                           |
| ------------------------- | ----------------------------------- |
| Gráfico de Fluxo de Caixa | Entradas vs Saídas do mês           |
| KPIs de Projetos          | Tarefas atrasadas e projetos ativos |
| Alertas Pastorais         | Membros que precisam de atenção     |
| Aniversariantes           | Próximos aniversários               |

### 2.2 Dashboard do Membro

![Dashboard Membro](./screenshots/placeholder-dashboard-membro.png)

> _Screenshot: Dashboard do membro_

**Elementos disponíveis:**

| Elemento                 | Descrição                 |
| ------------------------ | ------------------------- |
| Carrossel de Comunicados | Banners e avisos ativos   |
| Carteirinha Digital      | QR Code para check-in     |
| Minhas Tarefas           | Tarefas atribuídas a você |
| Ações Rápidas            | Botões de acesso rápido   |

### 2.3 Notificações

O sino no canto superior direito mostra suas notificações:

1. Clique no **ícone de sino** 🔔
2. Veja notificações não lidas
3. Clique em uma notificação para ser direcionado

![Notificações](./screenshots/placeholder-notificacoes.png)

> _Screenshot: Painel de notificações_

---

## 3. Gestão de Pessoas

### 3.X Pessoas / Membros

- **Onde acessar**: Menu lateral → **Pessoas** → escolha **Todos**, **Membros**, **Visitantes** ou **Frequentadores** (atalhos principais) ou use a página inicial de Pessoas.
- **Ao abrir a tela**: você vê cards/estatísticas (totais por status), atalhos rápidos, e a lista de pessoas com nome, contato, status e avatar (quando cadastrado). Em dispositivos móveis, os cards podem ocupar mais espaço; role para chegar na lista.
- **Buscar/filtrar** (passo a passo):
  1.  Use a barra de busca (nome, telefone ou email)
  2.  Selecione o filtro de **Status** (Visitante/Frequentador/Membro)
  3.  Confira os contadores por status para validar o filtro
  4.  Role para carregar mais pessoas (infinite scroll)
- **Cadastrar nova pessoa** (passo a passo):
  1.  Clique em **+ Novo** (na lista ou no atalho de Membros/Visitantes)
  2.  Preencha **Nome** (obrigatório)
  3.  Informe **Telefone ou Email** (recomendado para contato)
  4.  Defina **Status inicial**: Visitante, Frequentador ou Membro
  5.  Salve para concluir o cadastro; a pessoa aparece na listagem
- **Editar pessoa existente** (passo a passo):
  1.  Abra a pessoa pela lista (clique no nome)
  2.  Use **Editar** para ajustar dados pessoais/contatos/status
  3.  Salve; a lista e o perfil são atualizados
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

> _Screenshot: Menu expandido de Pessoas_

### 3.2 Visão Geral

A página inicial do módulo mostra:

- **Estatísticas**: Total de pessoas, visitantes, frequentadores e membros
- **Busca rápida**: campo para pesquisar por nome, email ou telefone (atalho para `/pessoas/todos?buscar=...`)
- **Acesso rápido**: cards para Visitantes, Membros, Frequentadores e Contatos Agendados
- **Alterações pendentes**: card com contador e botão "Ver histórico" (rota do botão: `/pessoas/alteracoes-pendentes` — a confirmar; rota configurada em `App.tsx` é `/pessoas/pendentes`)
- **Aceitaram Jesus**: lista das conversões mais recentes (ordenadas por `data_conversao`) com atalho para `/pessoas/todos?aceitou_jesus=true`
- **Links externos de cadastro**: atalhos para formulários públicos (quando configurados)
- **Aniversariantes**: calendário de aniversários
- **Atividade recente**: área informativa sem eventos (quando não há registros)

![Pessoas Visão Geral](./screenshots/placeholder-pessoas-geral.png)

> _Screenshot: Visão geral do módulo Pessoas_

### 3.3 Cadastrando um Visitante

1. Acesse **Pessoas > Visitantes**
2. Clique em **"+ Novo Visitante"**
3. Preencha os dados:
   - Nome completo
   - Telefone (WhatsApp)
   - Como conheceu a igreja
   - Tipo: Visitante ou Frequentador

![Cadastro Visitante](./screenshots/placeholder-cadastro-visitante.png)

> _Screenshot: Formulário de cadastro de visitante_

4. Clique em **"Salvar"**

### 3.4 Visualizando um Perfil

1. Na lista de pessoas, clique no **nome** da pessoa
2. A página de detalhes abre com as abas:

| Aba          | Conteúdo                                   |
| ------------ | ------------------------------------------ |
| **Perfil**   | Resumo de todos os dados (somente leitura) |
| **Pessoais** | Dados pessoais editáveis                   |
| **Contatos** | Email, telefone, endereço                  |
| **Igreja**   | Funções e status eclesiástico              |
| **Mais**     | Observações e dados adicionais             |

![Perfil Pessoa](./screenshots/placeholder-perfil-pessoa.png)

> _Screenshot: Página de detalhes da pessoa_

### 3.5 Editando Dados

1. Acesse a aba desejada (ex: **Pessoais**)
2. Clique no botão **"Editar"** (ícone de lápis)
3. Modifique os campos necessários
4. Clique em **"Salvar"**

![Editar Dados](./screenshots/placeholder-editar-dados.png)

> _Screenshot: Diálogo de edição de dados pessoais_

### 3.6 Promovendo Status

Para promover uma pessoa (Visitante → Frequentador → Membro):

1. Acesse o perfil da pessoa
2. Na aba **Igreja**, clique em **"Alterar Status"**
3. Selecione o novo status
4. Confirme a alteração

![Alterar Status](./screenshots/placeholder-alterar-status.png)

> _Screenshot: Diálogo de alteração de status_

### 3.7 Atribuindo Funções

1. Acesse o perfil da pessoa
2. Na aba **Igreja**, seção **"Funções"**
3. Clique em **"+ Atribuir Função"**
4. Selecione a função desejada
5. Defina a data de início
6. Clique em **"Salvar"**

![Atribuir Função](./screenshots/placeholder-atribuir-funcao.png)

> _Screenshot: Diálogo de atribuição de função_

### 3.8 Gerenciando Familiares

Na página de detalhes da pessoa:

1. Role até a seção **"Familiares"**
2. Clique em **"+ Adicionar Familiar"**
3. Selecione um membro existente ou cadastre novo
4. Defina o tipo de parentesco
5. Clique em **"Salvar"**

![Familiares](./screenshots/placeholder-familiares.png)

> _Screenshot: Seção de familiares no perfil_

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

> _Screenshot: Menu expandido de Finanças_

### 4.2 Dashboard Financeiro

A visão geral financeira mostra:

- **Saldo consolidado** de todas as contas
- **Gráficos** de receitas vs despesas
- **Resumo mensal** com totais

![Dashboard Financeiro](./screenshots/placeholder-dashboard-financeiro.png)

> _Screenshot: Dashboard financeiro_

### 4.3 Registrando uma Entrada (Receita)

#### Cenário 1: Oferta Simples (Fato Gerador + Caixa Simultâneos)

1. Acesse **Finanças > Entradas**
2. Clique em **"+ Nova Entrada"**
3. Preencha os campos:

| Campo              | Descrição              | Exemplo                         |
| ------------------ | ---------------------- | ------------------------------- |
| Descrição          | Nome/motivo da entrada | "Oferta Culto Domingo"          |
| Valor              | Valor em reais         | R$ 500,00                       |
| Data               | Data da transação      | 15/12/2024                      |
| Conta              | Conta de destino       | Conta Corrente                  |
| Categoria          | Classificação contábil | Receitas Operacionais > Ofertas |
| Forma de Pagamento | PIX, Dinheiro, etc.    | PIX                             |

![Nova Entrada](./screenshots/placeholder-nova-entrada.png)

> _Screenshot: Formulário de nova entrada_

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

| Campo              | Descrição              | Exemplo                                 |
| ------------------ | ---------------------- | --------------------------------------- |
| Descrição          | Natureza da despesa    | "Equipamento de Som"                    |
| Valor              | Valor total            | R$ 3.000,00                             |
| Data               | Data de competência    | 10/12/2024                              |
| Conta              | Conta de origem        | Conta Corrente                          |
| Categoria          | Classificação contábil | Despesas Administrativas > Equipamentos |
| Fornecedor         | Quem recebe            | Loja de Som LTDA                        |
| Forma de Pagamento | Como será pago         | Parcelado 3x                            |

![Nova Saída](./screenshots/placeholder-nova-saida.png)

> _Screenshot: Formulário de nova saída_

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

> _Screenshot: Diálogo de confirmação de pagamento_

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

> _Screenshot: Seletor de período_

### 4.7 Relatório de Ofertas

1. Acesse **Finanças > Dashboard de Ofertas**
2. Clique em **"+ Novo Relatório"**
3. Preencha os valores por forma de pagamento
4. Clique em **"Salvar"**
5. Um conferente receberá notificação para validar

![Relatório Ofertas](./screenshots/placeholder-relatorio-ofertas.png)

> _Screenshot: Formulário de relatório de ofertas_

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
   - Categoria: _Mesma categoria do fato gerador_
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

### 4.10 Manutenção de Cadastros Financeiros

#### 4.10.1 Bases Ministeriais

Gerencie as grandes áreas de atuação da igreja:

1. Acesse **Finanças > Manutenção > Bases Ministeriais**
2. Clique em **"+ Nova Base"** para criar
3. Preencha:
   - **Título**: Nome da base (ex: "Base de Adoração")
   - **Descrição**: Descrição opcional
4. Use a busca para filtrar bases existentes
5. Edite ou remova conforme necessário

#### 4.10.2 Categorias e Subcategorias

Organize o plano de contas por tipo de movimentação:

1. Acesse **Finanças > Manutenção > Plano de Contas**
2. Escolha a aba **Entradas** ou **Saídas**
3. Para criar categoria:
   - Clique em **"+ Nova Categoria"**
   - Preencha nome e tipo (fixo pela aba atual)
4. Para criar subcategoria:
   - Clique no botão **"+ Sub"** ao lado da categoria pai
   - Preencha o nome
5. Expanda/recolha categorias com o ícone de seta
6. Use a busca para localizar rapidamente

**Exemplos de estrutura:**

- **Entradas**: Dízimos > Dízimo Mensal, Ofertas > Oferta de Missões
- **Saídas**: Pessoal > Salários, Infraestrutura > Aluguel

#### 4.10.3 Centros de Custo

Defina unidades orçamentárias e projetos:

1. Acesse **Finanças > Manutenção > Centros de Custo**
2. Clique em **"+ Novo"**
3. Preencha:
   - **Código**: Identificador opcional (ex: "CC001")
   - **Nome**: Nome do centro (ex: "Projeto Missões África")
4. Use a busca por código ou nome

#### 4.10.4 Formas de Pagamento

Configure os meios aceitos pela igreja:

1. Acesse **Finanças > Manutenção > Formas de Pagamento**
2. Clique em **"+ Nova Forma"**
3. Preencha o nome (ex: "PIX", "Cartão de Crédito")
4. Use os botões para:
   - **Ativar/Desativar**: Habilita ou desabilita temporariamente
   - **Editar**: Altera o nome
   - **Excluir**: Remove permanentemente (só se não houver transações)

#### 4.10.5 Fornecedores e Parceiros

Cadastre prestadores de serviço:

1. Acesse **Finanças > Manutenção > Fornecedores**
2. Clique em **"+ Novo Fornecedor"**
3. Preencha:
   - **Nome**: Nome fantasia ou nome da pessoa
   - **Razão Social**: Razão social (opcional)
   - **CNPJ/CPF**: Documento (opcional)
   - **Telefone**: Contato (opcional)
   - **Email**: Email (opcional)
4. Use a busca para localizar por nome ou documento

#### 4.10.6 Contas Bancárias e Caixas

Gerencie contas onde o dinheiro transita:

1. Acesse **Finanças > Manutenção > Contas**
2. Clique em **"+ Nova Conta"**
3. Selecione o tipo:
   - **Bancária**: Conta em banco
   - **Física**: Caixa físico ou cofre
   - **Virtual**: Carteiras digitais
4. Preencha os dados conforme o tipo
5. O saldo atual é calculado automaticamente
6. **⚠️ Atenção**: Contas com movimentações não podem ser excluídas (apenas desativadas)

> **Dica**: Configure todas as categorias, fornecedores e contas antes de lançar transações para evitar inconsistências.

---

### 4.11 Visualizando o DRE (Demonstrativo de Resultado)

1. Acesse **Finanças > Painéis > DRE**
2. Selecione o **ano** desejado
3. Visualize:
   - Receitas por categoria
   - Despesas por categoria
   - Resultado líquido

![DRE](./screenshots/placeholder-dre.png)

> _Screenshot: Relatório DRE_

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

---

### 4.12 Gerenciar Dados (Importação/Exportação)

A tela **Gerenciar Dados** centraliza todas as operações de importação e exportação de dados financeiros, facilitando o fluxo de trabalho da tesouraria.

#### Acessando Gerenciar Dados

**Opção 1 - Via menu Finanças:**

1. Acesse **Finanças > Gerenciar Dados**

**Opção 2 - Via Entradas ou Saídas:**

1. Na tela de **Entradas** ou **Saídas**, clique no botão **"Importar"** ou **"Exportar"**
2. O sistema abre automaticamente a tab correspondente

![Gerenciar Dados](./screenshots/placeholder-gerenciar-dados.png)

> _Screenshot: Tela Gerenciar Dados com 3 tabs_

---

#### Tab 1: Importar (Transações Financeiras)

Use esta funcionalidade para importar lançamentos em lote a partir de planilhas.

**Passo 1: Upload do Arquivo**

1. Clique na tab **"Importar"**
2. Arraste o arquivo ou clique em **"Selecionar arquivo"**
3. Formatos aceitos: **CSV** ou **XLSX** (até 10MB)
4. Se a planilha tiver múltiplas abas, selecione a aba desejada

![Upload Importação](./screenshots/placeholder-upload-import.png)

> _Screenshot: Upload de arquivo para importação_

**Passo 2: Mapeamento de Colunas**

1. O sistema detecta automaticamente as colunas:
   - **Data**: Colunas com "data" no nome
   - **Descrição**: Colunas com "descri" no nome
   - **Valor**: Colunas com "valor" no nome
   - **Categoria, Fornecedor, Conta, etc.**
2. Ajuste o mapeamento manualmente se necessário
3. Clique em **"Próximo"**

![Mapeamento Colunas](./screenshots/placeholder-mapeamento.png)

> _Screenshot: Mapeamento de colunas_

**Passo 3: Validação**

1. O sistema valida os dados:
   - ✅ **Data válida**: Formato DD/MM/YYYY ou YYYY-MM-DD
   - ✅ **Descrição preenchida**: Não pode estar vazia
   - ✅ **Valor válido**: Maior que zero
2. Linhas com erro são destacadas em vermelho
3. Use os checkboxes para **excluir** linhas problemáticas
4. Clique em **"Validar"** para reprocessar

![Validação](./screenshots/placeholder-validacao-import.png)

> _Screenshot: Preview com validação_

**Passo 4: Confirmação e Importação**

1. Revise o resumo:
   - Total de registros válidos
   - Total de registros excluídos
   - Valor total a importar
2. Clique em **"Importar"**
3. Aguarde o processamento (chunks de 200 registros)
4. Ao finalizar, você verá uma mensagem de sucesso

![Confirmação Import](./screenshots/placeholder-confirmacao-import.png)

> _Screenshot: Confirmação de importação_

**O que acontece:**

- ✅ Transações são criadas em lote
- ✅ Registro de tracking em `import_jobs` (histórico de importações)
- ✅ Saldo das contas é atualizado
- ✅ DRE e Fluxo de Caixa refletem os lançamentos

---

#### Tab 2: Exportar (Transações Financeiras)

Use para gerar relatórios customizados em Excel.

**Passo 1: Aplicar Filtros**

1. Clique na tab **"Exportar"**
2. Configure os filtros:
   - **Tipo**: Entrada ou Saída
   - **Status**: Pago, Pendente ou Ambos
   - **Período**: Data início e data fim
   - **Conta**: Filtre por conta específica (opcional)
   - **Categoria**: Filtre por categoria (opcional)

![Filtros Exportar](./screenshots/placeholder-filtros-export.png)

> _Screenshot: Filtros de exportação_

**Passo 2: Selecionar Colunas**

1. Marque as colunas que deseja exportar:
   - Data, Descrição, Tipo, Valor
   - Categoria, Conta, Fornecedor
   - Status, Forma de Pagamento, Observações
2. O preview mostra os dados filtrados

![Seleção Colunas](./screenshots/placeholder-selecao-colunas.png)

> _Screenshot: Seleção de colunas para export_

**Passo 3: Exportar**

1. Clique em **"Exportar para Excel"**
2. O arquivo é gerado automaticamente
3. Salve em seu computador

**O que acontece:**

- ✅ Dados são formatados automaticamente:
  - Valores monetários: **R$ 1.234,56**
  - Datas: **DD/MM/YYYY**
- ✅ Arquivo Excel (.xlsx) pronto para uso

---

#### Tab 3: Extratos (Importação para Conciliação Bancária)

Use para importar extratos bancários e preparar a conciliação.

**Passo 1: Selecionar Conta**

1. Clique na tab **"Extratos"**
2. Selecione a **conta bancária** destino
3. Esta seleção vincula todas as transações do extrato à conta

![Selecionar Conta](./screenshots/placeholder-selecao-conta.png)

> _Screenshot: Seleção de conta bancária_

**Passo 2: Upload do Extrato**

1. Clique em **"Selecionar arquivo"** ou arraste o arquivo
2. Formatos aceitos:
   - **CSV/XLSX**: Extratos genéricos exportados do banco
   - **OFX**: Formato padrão brasileiro (Open Financial Exchange)
3. Tamanho máximo: **10MB**

![Upload Extrato](./screenshots/placeholder-upload-extrato.png)

> _Screenshot: Upload de extrato bancário_

**Passo 3: Mapeamento (CSV/XLSX) ou Auto-detecção (OFX)**

**Para arquivos CSV/XLSX:**

1. O sistema detecta colunas automaticamente:
   - **Data**: "data", "dt", "date"
   - **Descrição**: "descri", "historico", "memo"
   - **Valor**: "valor", "value", "amount"
   - **Saldo**: "saldo", "balance"
   - **Documento**: "doc", "numero", "ref"
   - **Tipo**: "tipo", "debito", "credito"
2. Ajuste manualmente se necessário
3. Clique em **"Próximo"**

**Para arquivos OFX:**

1. O sistema parseia automaticamente os campos:
   - `DTPOSTED` → Data da transação
   - `TRNAMT` → Valor
   - `MEMO` ou `NAME` → Descrição
   - `FITID` ou `CHECKNUM` → Número do documento
   - `TRNTYPE` → Tipo (crédito/débito)
2. **Não requer ajuste manual** de mapeamento

![Mapeamento Extrato](./screenshots/placeholder-mapeamento-extrato.png)

> _Screenshot: Mapeamento de colunas do extrato_

**Passo 4: Validação**

1. O sistema valida os campos obrigatórios:
   - ✅ **Data válida**: Formato reconhecido
   - ✅ **Descrição preenchida**: Não vazia
   - ✅ **Valor válido**: Diferente de zero
2. Linhas com erro são destacadas
3. Use checkboxes para excluir linhas problemáticas
4. O sistema **infere automaticamente o tipo** (crédito/débito):
   - Por sinal do valor (negativo = débito)
   - Por texto da coluna tipo ("d", "deb", "c", "cred")

![Validação Extrato](./screenshots/placeholder-validacao-extrato.png)

> _Screenshot: Validação do extrato com preview_

**Passo 5: Importação**

1. Clique em **"Importar extrato"**
2. O sistema processa em chunks de 200 registros
3. Ao finalizar, exibe contagem de registros importados

**O que acontece:**

- ✅ Transações são gravadas na tabela `extratos_bancarios`
- ✅ Campo `reconciliado` é marcado como **FALSE** (pendente)
- ✅ Dados ficam disponíveis para **conciliação automática** (próxima feature)
- ✅ Você pode visualizar os extratos importados na tela de Conciliação

**Formato OFX - Detalhes Técnicos:**

O parser OFX extrai os seguintes campos do arquivo:

| Campo OFX   | Campo Sistema    | Descrição               |
| ----------- | ---------------- | ----------------------- |
| `DTPOSTED`  | data_transacao   | Data (YYYYMMDD → DD/MM) |
| `TRNAMT`    | valor            | Valor da transação      |
| `MEMO/NAME` | descricao        | Descrição/Histórico     |
| `FITID`     | numero_documento | ID único da transação   |
| `CHECKNUM`  | numero_documento | Número do cheque/doc    |
| `TRNTYPE`   | tipo             | DEBIT/CREDIT → deb/cred |

**Próximos Passos (Conciliação):**

Após importar extratos, você poderá:

1. Acessar **Finanças > Conciliação Bancária** (a implementar)
2. O sistema sugerirá **matches automáticos** entre:
   - Transações registradas (`transacoes_financeiras`)
   - Transações do extrato (`extratos_bancarios`)
3. Critérios de match:
   - Mesmo valor (± R$ 0,50 tolerância)
   - Data próxima (± 3 dias úteis)
   - Mesma conta bancária
   - Descrição similar (scoring de similaridade)
4. Ações disponíveis:
   - **Aprovar match**: Vincula e marca como reconciliado
   - **Rejeitar**: Mantém separado
   - **Criar transação**: Lançamento estava no extrato mas não no sistema

> **Dica**: Importe extratos mensalmente para manter a conciliação em dia e identificar rapidamente divergências (taxas bancárias, juros, erros de lançamento).

---

### 4.13 Fluxo de Trabalho Recomendado

**Diário:**

1. Lance transações conforme ocorrem (Entradas/Saídas)
2. Anexe comprovantes sempre que possível
3. Confirme pagamentos ao final do dia

**Semanal:**

1. Revise transações pendentes
2. Reconcilie extrato bancário (importação via Gerenciar Dados)
3. Confira saldo das contas

**Mensal:**

1. Gere relatório de ofertas
2. Exporte DRE para análise
3. Archive comprovantes físicos
4. Execute conciliação completa (extrato vs lançamentos)

**Trimestral/Anual:**

1. Revise categorias e plano de contas
2. Analise tendências no dashboard
3. Gere relatórios para prestação de contas

---

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

> _Screenshot: Calendário de cultos_

#### O que aparece na tela (Geral)

- Cards com métricas: **Próximos Cultos**, **Times Ativos**, **Membros Escalados**, **Realizados**, **Mídias Ativas**
- Módulos principais (cards clicáveis): **Eventos**, **Times**, **Dashboard Liturgia**, **Mídias**
- Ações rápidas: **Novo Culto/Evento**, **Gerenciar Times**, **Ver Dashboard Liturgia**, **Gerenciar Mídias**

> Evidência: `src/pages/Cultos.tsx` (redireciona `/cultos` → `/cultos/geral`) e `src/pages/cultos/Geral.tsx` (estatísticas, módulos e ações).
> Calendário de eventos — (a confirmar)

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

> _Screenshot: Formulário de novo culto_

> Observação: criação/edição ocorre pela página de **Eventos** (rota `src/pages/cultos/Eventos.tsx`, detalhes — (a confirmar)). Atalho de criação pode abrir com parâmetro `?novo=true`.

### 5.3 Mesa de Controle do Culto

Ao clicar em um culto, você acessa a **Mesa de Controle** com as abas:

#### Aba Visão Geral

- Informações básicas do culto
- KPIs (duração estimada, voluntários escalados)
- Edição de tema, pregador, status

![Mesa Controle - Geral](./screenshots/placeholder-mesa-controle-geral.png)

> _Screenshot: Aba Visão Geral da Mesa de Controle_

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

> _Screenshot: Aba Liturgia da Mesa de Controle_

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

> _Screenshot: Aba Música da Mesa de Controle_

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

> _Screenshot: Aba Escalas da Mesa de Controle_

### 5.4 Usando Templates

#### Aplicando Template de Liturgia

1. Na aba Liturgia, clique em **"Aplicar Template"**
2. Selecione um template da lista
3. Visualize a prévia
4. Clique em **"Aplicar"**
5. Os itens são adicionados automaticamente

![Aplicar Template](./screenshots/placeholder-aplicar-template.png)

> _Screenshot: Diálogo de seleção de template_

#### Salvando como Template

1. Configure a liturgia desejada
2. Clique em **"Salvar como Template"**
3. Dê um nome e descrição
4. Clique em **"Salvar"**

### 5.5 Projeção (Telão)

Para apresentar na igreja, utilize um dos modos abaixo (ambos em tela cheia):

#### 5.5.1 Modo Comunicados (`/telao`)

- Fonte: comunicados com `ativo = true` e `exibir_telao = true` (ordem por `ordem_telao`/`created_at`)
- Como abrir: acessar a rota `/telao` no navegador do projetor
- Controles de teclado:

| Tecla               | Ação                     |
| ------------------- | ------------------------ |
| **→** ou **Espaço** | Próximo slide            |
| **←**               | Slide anterior           |
| **F**               | Tela cheia               |
| **P**               | Pausar/retomar auto-play |

#### 5.5.2 Modo Liturgia (`/telao-liturgia/:cultoId`)

- Fonte: itens da liturgia (`liturgia_culto`) e recursos vinculados (`liturgia_recursos` → `midias`)
- Como abrir: acessar `/telao-liturgia/<ID_DO_CULTO>` a partir da Mesa de Controle
- Realtime: alterações na liturgia/recursos atualizam a playlist automaticamente
- Controles de teclado:

| Tecla               | Ação                       |
| ------------------- | -------------------------- |
| **→** ou **Espaço** | Próximo recurso            |
| **←**               | Recurso anterior           |
| **F**               | Tela cheia                 |
| **P**               | Pausar/retomar auto-avance |
| **B**               | Tela preta                 |
| **C**               | Tela limpa (neutra)        |

![Telão](./screenshots/placeholder-telao.png)

> _Screenshot: Tela de projeção_

> Observação: no modo liturgia, exibe barra de progresso quando definido `duracao_segundos` no recurso.

#### Links de Diagramas (Cultos)

- Fluxo do módulo: `diagramas/fluxo-cultos.md`
- Sequência do módulo: `diagramas/sequencia-cultos.md`

---

## 5.4 Relógio de Oração (tipo RELOGIO)

### Acessando o Relógio

1. No menu de **Eventos**, identifique um evento do tipo **RELOGIO** (ícone de relógio)
2. Clique no evento para abrir **EventoDetalhes**
3. Você verá as tabs adaptadas: **Turnos** (Timeline), **Escalas**, **Check-in**

### Aba Turnos (Timeline Visual)

A Timeline exibe um grid de **24 horas** com slots de voluntários:

#### Layout da Timeline

- **Coluna esquerda**: Horas (00:00 até 23:00)
- **Coluna central**: Cards com voluntários por horário
- **DatePicker no topo**: Navega entre os dias do Relógio (ex: Relógio de 7 dias = navegação dia a dia)

#### Color Coding dos Slots

| Cor        | Significado                         |
| ---------- | ----------------------------------- |
| 🟢 Verde   | Voluntário confirmou presença       |
| 🟡 Amarelo | Pendente de confirmação             |
| ⚪ Cinza   | Slot vazio (sem voluntário)         |
| 🔵 Azul    | Hora atual (destaque em tempo real) |

#### Ações por Slot

Clique no menu (⋮) de cada slot para:

- **Editar**: Mudar voluntário ou horário do turno
- **Duplicar para Amanhã**: Cria slot idêntico no próximo dia
- **Remover**: Deleta o turno

#### Adicionando Voluntários com Recorrência

1. Clique em um slot vazio
2. Abre sheet **"Adicionar Voluntário"**
3. Preencha:
   - **Voluntário**: Busque por nome (combobox com autocomplete)
   - **Horário**: Defina início e fim (defaults vêm do slot clicado)
   - **Recorrência**: Escolha um tipo:
     - **Nenhuma**: Apenas este slot
     - **Diária**: Repete todos os dias até fim do Relógio
     - **Semanal**: Repete no mesmo dia da semana
     - **Personalizada**: Selecione dias específicos (Seg/Ter/Qua/etc.)
4. Visualize o preview: **"X turnos serão criados em: [datas]"**
5. ⚠️ Se houver conflitos (voluntário já escalado nesses dias), aviso aparece
6. Clique **"Adicionar"** para inserir todas as escalas

**Exemplo**: João Silva, 14h-16h, Recorrência Diária → cria 7 turnos (um por dia) automaticamente.

### Player de Oração (`/oracao/player/:escalaId`)

#### Acessando o Player

**Opção 1 - Via Timeline:**

- Na Timeline, clique em um card de voluntário → abre Player daquele turno

**Opção 2 - Via Centro de Operações:**

- No Dashboard/Centro de Operações, veja widget **"Relógio Ativo Agora"**
- Clique **"Entrar no Turno"** → abre Player do turno em andamento

#### Interface do Player

Full-screen e imersivo, com:

**Header** (top)

- Barra de progresso segmentada (1 linha = 1 slide)
- Botão fechar (X)
- Nome do evento + título do slide
- Timer do turno em andamento (MM:SS, piscando em vermelho)

**Conteúdo Central** (2/3 da tela)

- Exibe slide atual (tipo-dependente, ver tabela abaixo)
- Animações slide-in/fade-in para transições

**Footer** (bottom)

- Botões **◀** (anterior) e **▶** (próximo)
- Indicador **"X / Y"** (slides)

#### Tipos de Slides e Renderização

| Tipo                | Ícone | Visual                        | Conteúdo                             |
| ------------------- | ----- | ----------------------------- | ------------------------------------ |
| `VERSICULO`         | 📖    | Texto em itálico centralizado | Versículo bíblico                    |
| `VIDEO`             | ▶️    | Container 16:9                | YouTube embed ou fallback            |
| `AVISO`             | 📢    | Título grande + parágrafo     | Anúncio/instrução                    |
| `TIMER`             | ⏱️    | Timer em fonte grande         | Contagem regressiva (ex: 30:00)      |
| `PEDIDOS`           | 🙏    | Lista com cards               | Pedidos de oração com botão "Orei"   |
| `CUSTOM_TESTEMUNHO` | 💬    | Card com Quote icon           | Testemunho em citação estilizada     |
| `CUSTOM_SENTIMENTO` | ⚠️    | Card com AlertCircle          | Alerta espiritual (padrão emocional) |
| `CUSTOM_VISITANTES` | 👥    | Grid com avatars              | Cards de visitantes com badges       |

#### Interagindo com Pedidos

No slide de **PEDIDOS**, cada item mostra:

- Nome da pessoa que pediu (ou "Anônimo")
- Descrição do pedido
- Tipo de pedido (se registrado)

**Marcando "Orei":**

1. Clique no botão ❤️ (Heart) no canto direito do pedido
2. Ícone muda para ✅ (ThumbsUp) + gradiente verde
3. Status é salvo no banco (`pedidos_oracao.status = 'em_oracao'`)
4. Você pode continuar marcando outros pedidos

**Histórico de Orações:**
Ao abrir o Player, o sistema carrega automaticamente quais pedidos você já marcou como orados (persiste entre aberturas).

#### Navegação de Slides

- **Clique ◀/▶**: Avança ou retrocede
- **Última slide**: Clique ▶ abre confirma de encerramento ("Turno finalizado! Deus abençoe.")
- **Barra de progresso**: Cada segmento = 1 slide; clique em segmento para ir direto (a confirmar)

#### Player com Conteúdo Inteligente

Quando um Relógio é criado com **tipo*conteudo = BLOCO*\*** (TESTEMUNHO, SENTIMENTO, VISITANTE, PEDIDOS), o Player automaticamente:

1. Chama a Edge Function `playlist-oracao` com `evento_id`
2. Edge Function agrega:
   - **Testemunhos**: Últimos 3 públicos
   - **Alerta Espiritual**: Análise de sentimentos (se 3+ negativos = crítico)
   - **Visitantes**: Últimos 7 dias
   - **Pedidos Broadcast**: Prioritários (status = em_oracao)
   - **Pedidos Pessoais**: Individuais
3. Retorna slides prontos que são injetados no roteiro
4. Você vê conteúdo **vivo e atualizado** do que a igreja está sentindo/orando

### Escalas com Recorrência

#### O que é Recorrência?

Recorrência permite atribuir o **mesmo voluntário a múltiplos turnos automaticamente** em vez de adicionar manualmente cada um. Útil para:

- ✅ Relógios 24h com 7 dias (não quer adicionar 7 vezes o mesmo nome)
- ✅ Escalas semanais (ex: "João sempre faz segunda")
- ✅ Padrões fixos (ex: "Mariana seg/qua/sex")

#### 4 Tipos de Recorrência

1. **Nenhuma** (padrão)

   - Apenas 1 slot (data + horário selecionado)
   - Sem repetição

2. **Diária**

   - Repete **todos os dias** até o fim do evento
   - RELOGIO de 7 dias = 7 turnos
   - CULTO com duração de 3 dias = 3 turnos

3. **Semanal**

   - Repete **mesmo dia da semana**
   - Intervalo de 7 dias
   - Ex: Se escolhe terça → repete todas as terças

4. **Personalizada (Customizada)**
   - Selecione **checkboxes específicos** (Seg/Ter/Qua/etc.)
   - Exemplo: segunda + quarta + sexta apenas
   - Gera turnos conforme padrão escolhido

#### Como Usar (Passo-a-Passo)

**Cenário**: RELOGIO "Vigília 24h" com 7 dias. Quer escalar João Silva (14h-16h) todos os dias.

1. **Na Timeline**, clique em um **slot vazio** no dia 1, horário 14h
2. Sheet **"Adicionar Voluntário"** abre
3. **Busque "João Silva"** no combobox (autocomplete funciona)
4. **Defina horário**: 14h até 16h (ou ajuste conforme necessário)
5. **Selecione "Diária"** na seção Recorrência
6. **Preview aparece**:
   ```
   ✅ 7 turnos serão criados:
   • 30 de Dez (terça)
   • 31 de Dez (quarta)
   • 1º de Jan (quinta)
   ... (até o fim do Relógio)
   ```
7. Se não houver **conflitos** (João já escalado nesses dias), clique **"Adicionar"**
8. Sistema cria todos os 7 turnos em um comando só
9. Toast confirma: **"7 turnos criados para João Silva"**

#### Detecção de Conflitos

Se João **já tem escalas** em alguns dos dias:

```
⚠️ Conflitos detectados:
• 31 de Dez (já está escalado 16h-18h)
• 1º de Jan (já está escalado 12h-14h)

Deseja continuar? (inserirá apenas datas sem conflito)
```

**Opções:**

- **Cancelar**: Não insere nada
- **Continuar**: Insere apenas nos dias sem conflito (5 de 7)

#### Editando Recorrências

Se precisar mudar João depois:

1. **Na Timeline**, clique no card dele
2. Abre **EscalaSlotDialog** (simples, 1 turno)
3. Edite voluntário/horário
4. Salve
5. ⚠️ Nota: Edição é **individual** (apenas 1 turno); para padrões recorrentes, considere remover e re-adicionar com novo padrão

#### Removendo Turnos

- **Remover 1 turno**: Menu (⋮) → Remover
- **Remover série inteira**: (a confirmar) Pode ser necessário remover um por um ou via feature futura

---

## 6. Intercessão

**Acesso**: Menu lateral → **Intercessão** → expande submenu com opções.

### 6.1 Visão Geral (Dashboard)

A página inicial `/intercessao` exibe:

- **Módulos Principais** (4 cards):
  - **Diário de Oração**: estatísticas de pedidos pendentes e em oração, link para `/intercessao/diario`
  - **Sala de Guerra**: estatística de intercessores ativos, link para `/intercessao/sala-de-guerra`
  - **Gestão de Equipes**: estatística de testemunhos pendentes, link para `/intercessao/equipes`
  - **Sentimentos**: monitoramento emocional, link para `/intercessao/sentimentos`
- **Ações Rápidas**:
  - **"Novo Pedido de Oração"**: abre formulário para criar pedido (link com `?novo=true` ou navega para `/intercessao/pedidos?novo=true`) (a confirmar — rota não configurada em `App.tsx`)
  - **"Alocar Pedidos Pendentes"**: dispara alocação automática balanceada entre intercessores

### 6.2 Pedidos de Oração (Diário de Oração e Sala de Guerra)

#### Visualizando e Filtrando

1. Acesse **Intercessão → Diário de Oração** (`/intercessao/diario`) ou **Intercessão → Sala de Guerra** (`/intercessao/sala-de-guerra`)
2. **Listagem** exibe:
   - Título/descrição do pedido
   - Tipo (saúde, família, financeiro, trabalho, etc.)
   - Status (pendente, alocado, em oração, respondido, arquivado)
   - Intercessor alocado (quando aplicável)
   - Data de criação
3. **Filtros/Abas** por status (todos, pendente, alocado, em oração, respondido, arquivado)
4. **Busca** por palavras-chave
5. **Ação**: Clique em um pedido para **Ver Detalhes** (modal com observações, historico de alocação, comentários)
6. **Exportar**: Botão para baixar listagem em Excel

#### Criando Novo Pedido (Membro/Visitante)

1. Na tela de Pedidos, clique em **"+ Fazer Novo Pedido de Oração"** (destaque com ícone)
2. Preencha:
   - **Pedido** (texto obrigatório): descrição detalhada da necessidade
   - **Tipo** (dropdown): saúde, família, financeiro, trabalho, espiritual, outro
   - **Anônimo** (checkbox): marca para ocultar nome/contato
   - **Contato** (se não anônimo): telefone/email para retorno
3. Clique em **"Enviar Pedido"**
   - Pedido criado com `status = pendente`
   - Notificação enviada aos intercessores (a confirmar)

#### Admin: Alocando e Gerenciando

1. Em **Admin/Pastor**, visualize **"Todos os Pedidos"** (tab ou view dedicated)
2. Para um pedido com `status = pendente`:
   - Botão/ação **"Alocar Intercessor"** (dropdown com intercessores ordenados por carga)
   - Selecione intercessor e confirme (status muda para `alocado`, data_alocacao preenchida)
3. Para pedido com `status = alocado` ou `em_oracao`:
   - Intercessor pode atualizar observações em campo de texto
   - Admin pode reclassificar status (ex: `em_oracao` → `respondido`)
4. **Ações contextuais**:
   - Visualizar histórico de alterações
   - Anexar/visualizar observações
   - Marcar como respondido (com data_resposta)
   - Arquivar pedido

#### Intercessor: Acompanhando Pedidos

1. Acesse `/intercessao/sala-de-guerra` com role `intercessor`
2. Visualize apenas pedidos alocados a você (RLS aplicado)
3. Para cada pedido:
   - Veja descrição completa, tipo e contato do solicitante
   - Campo de **"Observações do Intercessor"** para registrar: oração realizada, progresso, respostas observadas
   - Botão para marcar como **"Em Oração"** (muda `status = em_oracao`)
   - Botão para marcar como **"Respondido"** (muda `status = respondido`, preenche `data_resposta`)

### 6.3 Gestão de Equipes (`/intercessao/equipes`)

#### Listando Intercessores

1. Acesse **Intercessão → Gestão de Equipes**
2. **Listagem** exibe:
   - Nome
   - Email / Telefone
   - Status (ativo/inativo)
   - Pedidos ativos (count)
   - Limite máximo de pedidos
   - Últimas datas de atualização
3. **Ações**:
   - Clique para editar ou visualizar detalhes
   - Inativar (toggle status `ativo = false`)
   - Excluir (se sem pedidos alocados)

#### Cadastrando Intercessor

1. Clique em **"+ Novo Intercessor"** (ou atalho em `/intercessao`)
2. Preencha diálogo:
   - **Nome** (obrigatório)
   - **Email** (recomendado)
   - **Telefone** (recomendado)
   - **Máximo de Pedidos** (padrão 10): limite simultâneo para balanceamento
   - **Ativo** (checkbox): habilita para alocação
3. Clique em **"Salvar"**
   - Intercessor criado em tabela `intercessores`
   - Pode começar a receber pedidos imediatamente

#### Editando / Inativando

1. Clique no intercessor na listagem
2. Modifique dados conforme necessário
3. Ao inativar (`ativo = false`), novos pedidos não são alocados; existentes continuam alocados (a confirmar política)
4. Clique em **"Salvar"**

### 6.4 Testemunhos (Diário de Oração e Sala de Guerra)

#### Visualizando e Filtrando

1. Acesse **Intercessão → Diário de Oração** (pessoal) ou **Intercessão → Sala de Guerra** (ministério)
2. **Abas por status**:
   - **Aberto**: testemunhos em submissão, aguardando aprovação
   - **Público**: testemunhos aprovados para publicação
   - **Arquivado**: histórico
3. **Filtros**:
   - Por categoria (espiritual, casamento, família, saúde, trabalho, financeiro, ministerial, outro)
   - Busca por palavra-chave/título
4. **Cada testemunho** exibe:
   - Título, categoria, autor (ou "Anônimo")
   - Snippet de texto
   - Data de criação
5. **Ações**:
   - Ver detalhes (modal/drawer com texto completo)
   - Clique em testemunho → opções de **Aprovar para Publicação** ou **Arquivar**
   - Exportar listagem em Excel

#### Membro: Enviar Testemunho

1. Em Dashboard ou no **Diário de Oração**, clique em **"+ Novo Testemunho"**
2. Preencha:
   - **Título** (obrigatório)
   - **Categoria** (dropdown)
   - **Mensagem** (texto obrigatório): relato detalhado da bênção/milagre
   - **Anônimo** (checkbox)
   - **Contato** (se não anônimo)
3. Clique em **"Enviar Testemunho"**
   - Criado com `status = aberto` (aguardando aprovação)
   - Notificação enviada para admin/secretaria (a confirmar)

#### Admin: Aprovando Testemunhos

1. Na aba **"Aberto"** da **Sala de Guerra**, visualize testemunhos em submissão
2. Para cada testemunho, clique para abrir detalhes:
   - Revise conteúdo, categoria, autor
   - Botões:
     - **"Aprovar para Publicação"**: status muda para `publico`, `publicar = true`, `data_publicacao = now()`; testemunho exibido no carrossel de dashboard/app para todos os membros
     - **"Arquivar"**: status muda para `arquivado`; não aparece em listagens ativas
3. **Visualize histórico** de aprovações (quem aprovou, quando)

### 6.5 Sentimentos (`/intercessao/sentimentos`)

#### Monitorando Sentimentos de Membros

1. Acesse **Intercessão → Sentimentos**
2. **Seção "Hoje e Próximos Dias"**:
   - Gráfico de sentimentos registrados no dia (quantos felizes, tristes, ansiosos, etc.)
   - Pode filtrar por período (hoje, últimos 7 dias, últimos 30 dias)
3. **Alertas Críticos**:
   - Exibidos em cards destacados: membros com 3+ dias consecutivos de sentimentos negativos
   - Informações de contato e link para WhatsApp
   - Admin pode enviar mensagem de apoio direto do sistema (a confirmar)
4. **Timeline de Sentimentos por Membro**:
   - Clique em um membro para ver histórico completo
   - Visualize padrões (ex: picos de ansiedade, melhora após testemunho)

#### Membro: Registrando Sentimentos

1. **Notificação diária** (às 9h): "Como você está?" → clique para registrar
2. Ou acesse `/intercessao/sentimentos` diretamente (tela com registro)
3. Selecione sentimento (radio buttons ou dropdown):
   - **Feliz**: sentimento positivo
   - **Triste**: angústia
   - **Ansioso**: preocupação
   - **Grato**: gratidão
   - **Abençoado**: alegria espiritual
   - **Angustiado**: crises
4. **Campo opcional**: "Quer compartilhar?" (texto curto)
5. Clique em **"Registrar"**
   - Sistema analisa sentimento e oferece **"Redirecionamento Inteligente"**:
     - **Se positivo (feliz/grato/abençoado)**: sugestão "Compartilhar Testemunho?" → link para `/intercessao/testemunhos?novo=true` (a confirmar — rota não configurada em `App.tsx`)
     - **Se negativo (triste/ansioso/angustiado)**: sugestão "Fazer Pedido de Oração?" → link para `/intercessao/pedidos?novo=true` (a confirmar — rota não configurada em `App.tsx`)
6. Sentimento registrado em `sentimentos_membros` com timestamp

#### Direcionar Apoio (Admin)

1. Se membro registra 3+ dias negativos seguidos, alerta crítico aparece no Dashboard
2. Admin recebe notificação (a confirmar) com dados do membro
3. Pode:
   - Enviar mensagem WhatsApp de apoio
   - Navegar para perfil do membro (seção Vida Igreja → Intercessão/Sentimentos)
   - Registrar observações pastorais (em campo de notas do perfil)

**Links Úteis**:

- Fluxo Intercessão (Mermaid): [`../diagramas/fluxo-intercessao.md`](../diagramas/fluxo-intercessao.md)
- Sequência Intercessão (Mermaid): [`../diagramas/sequencia-intercessao.md`](../diagramas/sequencia-intercessao.md)
- Produto — Intercessão: [`../produto/README_PRODUTO.MD#intercessão-oração-e-testemunhos-visão-de-produto`](../produto/README_PRODUTO.MD#intercessão-oração-e-testemunhos-visão-de-produto)
- Funcionalidades — Intercessão: [`../funcionalidades.md#4-intercessão-oração-e-testemunhos`](../funcionalidades.md#4-intercessão-oração-e-testemunhos)
- Arquitetura — Intercessão: [`../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](../01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)
- ER — Intercessão: [`../database-er-diagram.md#intercessão-oração-e-testemunhos--entidades-e-relações`](../database-er-diagram.md#intercessão-oração-e-testemunhos--entidades-e-relações)

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

> _Screenshot: Formulário de nova jornada_

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

> _Screenshot: Configuração de etapas_

#### Kanban de Participantes

1. Visualize as etapas como colunas
2. Cada participante é um card
3. Arraste para mover entre etapas
4. Veja progresso e responsável

![Kanban Jornada](./screenshots/placeholder-kanban-jornada.png)

> _Screenshot: Board Kanban da jornada_

#### Inscrevendo Participante

1. Clique em **"+ Adicionar Pessoa"**
2. Selecione a pessoa
3. Defina o responsável/discipulador
4. Clique em **"Salvar"**
   Guard-rails (Cultos):

- Não mover/renomear/apagar arquivos em /docs
- Apenas COMPLEMENTAR docs existentes
- Não inventar telas/fluxos: primeiro listar evidências no repo (paths e comportamentos)
- Se faltar evidência, marcar (a confirmar)
- Diagramas Mermaid em docs/diagramas/
- Saída pronta para commit

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

> _Screenshot: Drawer de nova aula_

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

> _Screenshot: Formulário de sala_

#### Fazendo Check-in de Criança

1. Acesse **Ensino > Ministério Infantil**
2. Selecione a aula do dia
3. Clique em **"+ Check-in"**
4. Selecione a criança
5. Sistema gera etiquetas de segurança

![Check-in Kids](./screenshots/placeholder-checkin-kids.png)

> _Screenshot: Tela de check-in_

#### Imprimindo Etiquetas

Após o check-in:

1. Clique em **"Imprimir Etiquetas"**
2. Sistema gera:
   - **Etiqueta da Criança**: Nome, sala, código de segurança
   - **Etiqueta do Responsável**: Nome da criança, código

![Etiquetas](./screenshots/placeholder-etiquetas.png)

> _Screenshot: Preview das etiquetas_

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

> _Screenshot: Formulário de novo projeto_

### 8.2 Kanban de Tarefas

Ao acessar um projeto:

1. Visualize três colunas:
   - **Não Iniciado**
   - **Em Execução**
   - **Finalizado**
2. Arraste tarefas entre colunas
3. A barra de progresso atualiza automaticamente

![Kanban Tarefas](./screenshots/placeholder-kanban-tarefas.png)

> _Screenshot: Board de tarefas_

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

> _Screenshot: Formulário de tarefa_

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

> _Screenshot: Hub de publicação_

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

> _Screenshot: Passo 1 - Conteúdo_

#### Passo 2: Canais de Publicação

Defina onde o comunicado será exibido (múltipla escolha):

- ☐ **App/Dashboard**: aparece no carrossel do dashboard dos membros
- ☐ **Telão/Projetor**: entra na playlist do ProPresenter ou sistema de projeção
  - Pode definir **ordem de exibição** no telão (campo `ordem_telao`)
  - Pode enviar **arte alternativa** para telão (16:9 vs 9:16 no campo `url_arquivo_telao`)
- ☐ **Site Público**: exibido no carrossel do site da igreja

**Observação:** Um comunicado pode ser publicado em múltiplos canais simultaneamente.

![Comunicado Passo 2](./screenshots/placeholder-comunicado-passo2.png)

> _Screenshot: Passo 2 - Canais_

#### Passo 3: Agendamento e Categorização

- **Data de início**: quando o comunicado começa a ser exibido
- **Data de fim** (opcional): quando expira automaticamente
- **Nível de urgência** (a confirmar): para priorização visual
- **Categoria de mídia** (opcional): `geral`, `eventos`, `liturgia` (campo `categoria_midia`)
- **Tags** (opcional): para organização (ex.: `Abertura`, `Louvor`, `Avisos Gerais`)
- **Vincular a culto** (opcional): associa o comunicado a um culto específico (FK `culto_id`)

![Comunicado Passo 3](./screenshots/placeholder-comunicado-passo3.png)

> _Screenshot: Passo 3 - Agendamento_

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

> _Screenshot: Upload de mídia_

---

## 10. Notificações

O módulo de **Notificações** entrega alertas automáticos do sistema diretamente para você, baseado em eventos relevantes da sua área de atuação (role). Diferente da **Comunicação** (que é criação manual de avisos), as notificações são **disparadas automaticamente** pelo sistema sempre que algo importante acontece.

### 10.1 Acessando Notificações

1. No canto superior direito da barra de navegação, clique no **ícone de sino 🔔**
2. Um popover abre com a lista de notificações recentes
3. Notificações **não lidas** aparecem com uma bolinha azul à esquerda e fundo branco
4. Notificações já lidas ficam acinzentadas

![Sino de Notificações](./screenshots/placeholder-sino-notificacoes.png)

> _Screenshot: Popover de notificações_

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

> _Screenshot: Ações em notificações_

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

> _Screenshot: Tela de configuração de notificações (admin)_

### 10.6 Eventos Disponíveis

Principais eventos que podem disparar notificações automáticas:

| Evento                           | Categoria   | Quando dispara                         |
| -------------------------------- | ----------- | -------------------------------------- |
| `financeiro_conta_vencer`        | Financeiro  | Nova conta a pagar cadastrada          |
| `financeiro_reembolso_aprovacao` | Financeiro  | Reembolso aguardando aprovação         |
| `kids_checkin`                   | Kids        | Criança fez check-in no ministério     |
| `kids_ocorrencia`                | Kids        | Registrada ocorrência/choro de criança |
| `novo_visitante`                 | Pessoas     | Novo visitante cadastrado no sistema   |
| `pedido_oracao`                  | Intercessão | Novo pedido de oração recebido         |

> 📌 **Nota**: A lista de eventos é expansível. Novos eventos podem ser adicionados conforme necessidades operacionais da igreja.

### 10.7 Diferença: Notificações vs. Comunicação

| Aspecto          | Notificações                        | Comunicação                       |
| ---------------- | ----------------------------------- | --------------------------------- |
| **Origem**       | Automática (evento do sistema)      | Manual (criação humana)           |
| **Conteúdo**     | Template fixo (ex: "Nova conta X")  | Livre (banners, avisos, editoria) |
| **Destinatário** | Definido por role/cargo             | Público geral (app/telão/site)    |
| **Objetivo**     | Alerta operacional / ação requerida | Informação institucional          |
| **Edição**       | Não editável (gerado pelo sistema)  | Totalmente editável               |

> **Regra de ouro**: Se é uma **reação a um evento do sistema**, é Notificação. Se é **conteúdo criado manualmente para comunicar algo**, é Comunicação.

---

## 11. Minha Área

### 10.1 Perfil

1. Clique no seu **avatar** no menu
2. Selecione **"Perfil"**

![Menu Perfil](./screenshots/placeholder-menu-perfil.png)

> _Screenshot: Menu do usuário_

#### Alterando Foto

1. Clique na foto de perfil
2. Tire uma foto ou selecione da galeria
3. Ajuste o enquadramento
4. Clique em **"Confirmar"**

![Upload Foto](./screenshots/placeholder-upload-foto.png)

> _Screenshot: Diálogo de foto de perfil_

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

> _Screenshot: Lista de escalas_

### 10.3 Minha Família

1. Acesse **Minha Família** no menu
2. Visualize dependentes cadastrados
3. Clique em **"+ Adicionar Dependente"** para cadastrar filhos

![Minha Família](./screenshots/placeholder-minha-familia.png)

> _Screenshot: Página Minha Família_

### 10.4 Meus Cursos

1. Acesse **Meus Cursos** no menu
2. Visualize jornadas em que está inscrito
3. Clique em um curso para continuar estudando

![Meus Cursos](./screenshots/placeholder-meus-cursos.png)

> _Screenshot: Lista de cursos_

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

> _Screenshot: Diálogo de sentimento_

---

## 11. Administração

### 11.1 Painel Administrativo

1. Acesse **Admin** no menu (apenas administradores)
2. Visualize:
   - Edge Functions configuradas
   - Status de execução
   - Logs de erros

![Painel Admin](./screenshots/placeholder-painel-admin.png)

> _Screenshot: Painel administrativo_

### 11.2 Gerenciando Funções de Igreja

1. Acesse **Admin > Funções**
2. Visualize funções cadastradas
3. Clique em **"+ Nova Função"** para adicionar
4. Edite ou desative funções existentes

### 11.3 Configurações da Igreja

1. Acesse **Configurações** no menu lateral
2. Seções disponíveis:

**Modo de Manutenção:**

- Ativar/desativar modo manutenção (bloqueia acesso ao sistema)
- Permitir acesso público durante manutenção
- Personalizar mensagem de manutenção

**Informações Básicas:**

- Nome da igreja
- Subtítulo
- Logo (upload com preview)

**Webhooks de Integração:**

- Card com link para página dedicada `/admin/webhooks`
- Gerenciamento seguro de URLs de webhook (valores mascarados)

**Notificações & Plantão Pastoral:**

- Telefone do plantão pastoral (para alertas críticos)
- Provedor WhatsApp: Make.com, Meta Official API, ou Evolution API
- Campos de credenciais variam conforme provedor selecionado

**IA & Chatbot:**

- Card "Chatbots & Inteligência Artificial" confirma visualmente se o `OPENAI_API_KEY` está presente
- Botão **Gerenciar Chatbots & IAs** redireciona para a tela administrativa `/admin/chatbots`
- Dica exibida lembra que os prompts/modelos são ajustados nessa tela dedicada

![Configurações Igreja](./screenshots/placeholder-config-igreja.png)

> _Screenshot: Configurações da igreja_

### 11.3.1 Webhooks de Integração

Página dedicada em `/admin/webhooks` para gerenciar webhooks de forma segura:

1. Acesse via card "Webhooks de Integração" nas Configurações
2. Webhooks disponíveis:
   - **MAKE_WEBHOOK_URL**: Webhook principal do Make.com
   - **MAKE_WEBHOOK_LITURGIA**: Webhook para notificações de liturgia
3. Valores são mascarados por segurança (exibe `••••••••••`)
4. Clique em "Atualizar" para inserir novo valor via formulário seguro

### 11.3.2 Chatbots & IAs

1. Acesse **Configurações → Chatbots & Inteligência Artificial** e clique em **Gerenciar Chatbots & IAs**
2. Tela lista cada chatbot com status (Ativo/Inativo), edge function vinculada e modelos escolhidos (texto, áudio, visão)
3. Use o botão **Novo Chatbot** para cadastrar, informando nome, descrição opcional e edge function (ex.: `chatbot-triagem`)
4. Edite prompts (roles) por canal diretamente no modal e ative/desative bots via toggle
5. Exclusões pedem confirmação em diálogo para evitar remoções acidentais

### 11.4 Gestão de Permissões (Admin)

#### Visão Geral

Acesse **Admin > Permissões** para gerenciar a matriz de permissões por cargo. A interface exibe uma tabela com permissões agrupadas por módulo em accordion expansível.

![Matriz de Permissões](./screenshots/placeholder-admin-permissions.png)

> _Screenshot: Matriz de permissões com controles tri-state_

#### Controles Tri-State por Módulo

No cabeçalho de cada módulo (ex: Financeiro, Comunicados, Kids), você verá indicadores por cargo:

- **✅ Verde (CheckCircle)**: Todas as permissões do módulo estão ativas para aquele cargo
- **➖ Amarelo (traço horizontal)**: Algumas permissões ativas, outras não (estado parcial)
- **⭕ Cinza (XCircle)**: Nenhuma permissão ativa

**Como usar:**

1. Clique no indicador para alternar entre ativar/desativar todas as permissões do módulo
2. Se estado for "nenhuma" ou "parcial" → Ativa todas
3. Se estado for "todas ativas" → Desativa todas
4. Cargos sistema (admin) não podem ser editados

#### Clonagem de Permissões

Economize tempo copiando permissões de um cargo existente:

1. Localize o cabeçalho da coluna do cargo destino (ex: "Líder Júnior")
2. Clique no botão **Copy** (ícone de copiar)
3. Dropdown exibe cargos disponíveis como origem
4. Selecione o cargo fonte (ex: "Líder")
5. Sistema calcula diferenças e sincroniza automaticamente:
   - Adiciona permissões ausentes
   - Remove permissões extras
6. Toast confirma operação: "Permissões de 'Líder' copiadas para 'Líder Júnior'. 12 alterações pendentes."

**Dica:** Use esta funcionalidade ao criar cargos similares (ex: Líder → Líder Júnior, Secretário → Secretário Assistente).

#### Dialog de Confirmação Visual

Antes de salvar, revise todas as alterações:

1. Faça alterações na matriz (tri-state, clonagem, toggles individuais)
2. Clique em **Salvar Alterações (X)** no canto superior
3. Modal exibe resumo agrupado por cargo:
   - **Adicionar (verde)**: ✅ Financeiro View, ✅ Comunicados Manage
   - **Remover (vermelho)**: ❌ Kids Manage, ❌ Ensino Editar
4. Revise a lista (scrollável se houver muitas alterações)
5. Escolha:
   - **Cancelar**: Fecha modal, mantém alterações pendentes
   - **Confirmar Salvar**: Persiste no banco de dados

![Confirmação de Permissões](./screenshots/placeholder-permissions-confirm.png)

> _Screenshot: Dialog de confirmação com diff visual_

#### Dicas de Uso

- **Estado efetivo**: A interface considera alterações não salvas ao calcular tri-state e clonagem
- **Batch operations**: Controles em massa evitam cliques repetitivos
- **Auditoria**: Todas as alterações são registradas com timestamp e autor
- **Undo**: Após salvar, botão "Desfazer" aparece no toast por 10 segundos

#### Desfazendo Alterações de Permissões (Rollback)

Se você cometeu um erro ao alterar permissões, pode desfazer facilmente:

1. **Abra a aba "Histórico"** na tela de Permissões
2. **Localize o grupo de alterações** que deseja reverter (data/hora é exibida)
3. **Clique no botão Undo2** (ícone de seta para trás) à direita do grupo
4. **Confirme** no dialog que aparece
5. **Pronto!** As alterações foram desfeitas e a matriz é recarregada

O histórico mostra quem fez cada mudança, quando, e que permissões foram alteradas. Todas as operações ficam registradas para auditoria, mesmo as reversões.

**Nota:** Você só pode desfazer suas próprias alterações (ou as de outros admins, se tiver permissão de auditoria).

---

### 11.5 Links Externos e QR Codes

Na página de Pessoas:

1. Encontre o card **"Links Externos"**
2. Copie links para:
   - Cadastro de visitante
   - Atualização de membro
3. Baixe QR Codes para impressão

![Links Externos](./screenshots/placeholder-links-externos.png)

> _Screenshot: Card de links externos_

---

## Apêndice A: Atalhos de Teclado

### Telão (Projeção)

| Tecla           | Ação                     |
| --------------- | ------------------------ |
| `→` ou `Espaço` | Próximo slide            |
| `←`             | Slide anterior           |
| `F`             | Alternar tela cheia      |
| `P`             | Pausar/retomar auto-play |
| `B`             | Tela preta               |
| `C`             | Limpar tela              |
| `Esc`           | Sair da tela cheia       |

---

## Apêndice B: Glossário

| Termo                | Definição                                          |
| -------------------- | -------------------------------------------------- |
| **Visitante**        | Pessoa que visitou a igreja pela primeira vez      |
| **Frequentador**     | Pessoa que frequenta regularmente mas não é membro |
| **Membro**           | Pessoa oficialmente membro da igreja               |
| **Intercessor**      | Membro dedicado a orar pelos pedidos recebidos     |
| **Jornada**          | Trilha de aprendizado/curso com múltiplas etapas   |
| **Escala**           | Atribuição de voluntário para servir em um culto   |
| **Mesa de Controle** | Interface de gestão completa de um culto           |
| **DRE**              | Demonstrativo de Resultado do Exercício            |

---

## Apêndice C: Experiência Mobile

### Dialogs Responsivos

O sistema adapta automaticamente a interface para dispositivos móveis:

- **Desktop (≥768px)**: Dialogs aparecem como modais centralizados
- **Mobile (<768px)**: Dialogs se transformam em drawers (bottom sheet) que deslizam de baixo para cima

**Vantagens no mobile:**

- Melhor uso do espaço vertical limitado
- Interação nativa (deslizar para fechar)
- Conteúdo mais acessível sem scroll excessivo

### Safe Areas (iPhone)

A interface respeita as áreas seguras do dispositivo:

- **Notch/Dynamic Island**: Conteúdo não fica oculto pela área do sensor
- **Home indicator**: Botões e controles ficam acima da barra de gesto
- **Margens laterais**: Respeitadas em dispositivos com bordas arredondadas

### Otimizações iOS

- **Zoom automático desabilitado**: Campos de texto não disparam zoom ao focar (fonte 16px)
- **Scroll suave**: Listas e cards otimizados para toque
- **Touch targets**: Botões e links com área mínima de 44x44px

### Navegação Mobile

- **Select em vez de Tabs**: Em telas como Visitantes e Aniversariantes, abas são substituídas por dropdown para economizar espaço
- **Collapsible sections**: Seções podem ser colapsadas para facilitar navegação vertical
- **Cards compactos**: Layout adaptado para exibir informações essenciais sem excesso de whitespace

---

## Apêndice D: Suporte

Em caso de dúvidas ou problemas:

1. Verifique este manual
2. Entre em contato com o administrador do sistema
3. Reporte bugs ou sugestões

---

> **Nota**: Este manual contém placeholders para screenshots. Substitua os arquivos em `docs/screenshots/` pelas imagens reais do sistema.

---

_Documento gerado em Dezembro de 2024_
