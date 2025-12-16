# Documentação de Funcionalidades - Sistema de Gestão de Igreja

## Visão Geral

Sistema completo de gestão eclesiástica desenvolvido para igrejas, oferecendo controle de membros, finanças, cultos, ensino, comunicação e muito mais.

---

## 1. Gestão de Pessoas

### 1.1 Cadastro Unificado
- **Visitantes**: Registro de pessoas que visitam a igreja pela primeira vez
- **Frequentadores**: Pessoas que frequentam regularmente mas não são membros
- **Membros**: Membros oficiais da igreja com acesso completo ao sistema

### 1.2 Progressão de Status
- Sistema de progressão: Visitante → Frequentador → Membro
- Histórico de mudanças registrado automaticamente no campo de observações
- Data de cadastro como membro registrada automaticamente

### 1.3 Perfil Completo
- **Dados Pessoais**: Nome, data de nascimento, estado civil, necessidades especiais
- **Contatos**: Email, telefone, endereço, CEP
- **Dados Eclesiásticos**: Funções na igreja, status, data de batismo, data de casamento
- **Informações Adicionais**: Escolaridade, profissão, motivo de entrada, observações

### 1.4 Relacionamentos Familiares
- Cadastro de familiares vinculados
- Tipos de parentesco (cônjuge, filho, pai, mãe, etc.)
- Gestão de família unificada via `familia_id`

### 1.5 Funções na Igreja
- Cadastro de funções (Pastor, Diácono, Presbítero, etc.)
- Atribuição de múltiplas funções por membro
- Histórico de funções com data de início e fim

### 1.6 Aniversariantes
- Dashboard de aniversários (nascimento, casamento, batismo)
- Filtros por tipo e período
- Calendário visual

---

## 2. Módulo Financeiro

### Objetivo do Módulo
Prover controle financeiro completo e transparente para igrejas, separando claramente os conceitos de **Fato Gerador**, **Fluxo de Caixa** e **DRE** para garantir relatórios contábeis precisos e rastreabilidade fiscal. O sistema permite gestão de receitas, despesas, reembolsos e relatórios gerenciais sem perder a integridade contábil.

### Conceitos Fundamentais

#### Fato Gerador (Competência)
- Representa **quando e por que** um valor foi originado (ex.: compra de material, evento, doação)
- Registrado independentemente do momento do pagamento/recebimento
- Vinculado a **categoria contábil**, **fornecedor**, **centro de custo** e **base ministerial**
- Pode ser decomposto em múltiplos itens (ex.: uma nota fiscal com vários produtos)
- Fonte de verdade para o DRE e análises gerenciais

#### Fluxo de Caixa (Regime de Caixa)
- Representa **quando e como** o dinheiro saiu ou entrou fisicamente
- Registra forma de pagamento, parcelamento, juros, multas, descontos
- Pode haver um fato gerador e múltiplos pagamentos (ex.: compra parcelada em 3x)
- Base para conciliação bancária e gestão de liquidez

#### DRE (Demonstrativo de Resultado do Exercício)
- Relatório contábil por competência que mostra resultado (receita - despesa) do período
- Calculado a partir dos **fatos geradores** (categorias), não do caixa
- Independente da forma de pagamento (parcelamento não altera a natureza do gasto)
- Agrupa receitas e despesas por seção DRE (Receitas Operacionais, Despesas Administrativas, etc.)

> **Importante**: Esta separação conceitual está documentada no [ADR-001](adr/ADR-001-separacao-fato-gerador-caixa-dre.md) e é a base de toda a arquitetura financeira do sistema.

---

### 2.1 Estrutura Contábil
- **Contas**: Bancárias, virtuais e físicas (caixa)
- **Bases Ministeriais**: Unidades de negócio/ministério para segmentação de custos
- **Centros de Custo**: Classificação de despesas por departamento/projeto
- **Categorias Financeiras**: Com seção DRE (Receitas/Despesas) e natureza contábil
- **Subcategorias**: Detalhamento de categorias para maior granularidade
- **Fornecedores**: Cadastro completo com CNPJ/CPF e dados bancários

### 2.2 Transações
- **Entradas**: Dízimos, ofertas, doações, outras receitas
- **Saídas**: Pagamentos, despesas operacionais, reembolsos
- **Status**: Pendente ou Pago/Recebido
- **Confirmação de Pagamento**: Registro de juros, multas, descontos, taxas
- **Vinculação**: Cada transação pode referenciar um ou mais fatos geradores

### 2.3 Relatório de Ofertas
- Workflow de duplo controle (lançador + conferente)
- Detalhamento por forma de pagamento
- Auditoria com aprovação independente
- Rastreabilidade completa de quem lançou, conferiu e aprovou

### 2.4 Dashboards e Relatórios
- **Dashboard Geral**: Visão consolidada de receitas e despesas
- **Dashboard de Ofertas**: Análise específica de ofertas por período
- **Projeção Financeira**: 12 meses histórico + 6 meses projetado
- **DRE**: Demonstrativo de Resultado do Exercício anual por competência
- **Insights**: Análises e tendências baseadas em histórico

### 2.5 Funcionalidades Avançadas
- **Importação Excel**: Importação em massa de transações com validação
- **Processamento de Notas Fiscais**: IA (Gemini) extrai dados de NF automaticamente
- **Reconciliação Bancária**: Comparação automática entre lançamentos e extrato bancário
- **Sistema de Aprendizado**: Auto-sugestão de categoria/fornecedor baseada em histórico
- **Exportação**: Excel com todos os dados filtrados e formatados

### 2.6 Formas de Pagamento
- Cadastro configurável (Dinheiro, PIX, Cartão, Transferência, Boleto, etc.)
- Vinculação em transações com rastreamento completo
- Suporte a parcelamento e juros

---

### Regras de Negócio

#### O que altera o DRE
- Lançamento de novos fatos geradores (receitas ou despesas)
- Reclassificação de categoria de um fato gerador
- Estorno de fato gerador (cancela o lançamento contábil)
- Ajustes de competência (mudança de mês/ano de referência)

#### O que altera o Caixa
- Registro de pagamento/recebimento efetivo
- Conciliação bancária (confirmação de entrada/saída)
- Ajustes de saldo manual (ex.: erro de lançamento)
- Juros, multas ou descontos aplicados no momento do pagamento

#### O que NÃO altera o DRE
- Forma de pagamento escolhida (à vista, parcelado, PIX, boleto)
- Data de pagamento diferente da data de competência
- Juros ou descontos aplicados no caixa (são tratados como ajustes de caixa, não de competência)

#### Reembolsos
- Fato gerador original permanece inalterado (ex.: líder comprou material)
- Transação de caixa registra o reembolso ao líder
- DRE reflete a categoria do material (não "Reembolso")
- Permite rastreamento de quem pagou e quando foi reembolsado

#### Estornos
- **Estorno de Fato Gerador**: Cancela o lançamento contábil e impacta DRE
- **Estorno de Caixa**: Reverte o pagamento/recebimento, impacta apenas o saldo da conta
- Ambos exigem justificativa e são registrados em log de auditoria

---

### Fluxo Completo (Exemplo Prático)

#### Cenário 1: Oferta Simples
1. Tesoureiro registra **fato gerador**: "Oferta Culto Domingo" (categoria: Receita Operacional)
2. Tesoureiro registra **transação de caixa**: Entrada de R$ 500 via PIX
3. Sistema vincula transação ao fato gerador automaticamente
4. DRE exibe R$ 500 em "Receita Operacional"
5. Caixa exibe R$ 500 em "Entradas do mês"

#### Cenário 2: Despesa com Parcelamento
1. Líder compra equipamento de R$ 3.000 parcelado em 3x sem juros
2. Sistema registra **fato gerador**: "Equipamento de Som" (categoria: Despesas Administrativas) - R$ 3.000
3. Tesoureiro registra **3 transações de caixa**: R$ 1.000 cada mês
4. **DRE do mês da compra**: Exibe R$ 3.000 em Despesas (competência)
5. **Fluxo de Caixa**: Exibe R$ 1.000 saindo por mês (regime de caixa)
6. Resultado: DRE reflete o impacto real da decisão; Caixa mostra o impacto financeiro mensal

---

### Referências e Links

- **Manual do Usuário (Financeiro)**: [docs/manual-usuario.md](manual-usuario.md) — Passo a passo para uso do módulo
- **Fluxo Visual (Mermaid)**: [docs/diagramas/fluxo-financeiro.md](diagramas/fluxo-financeiro.md) — Diagrama do fluxo completo
- **Sequência de Eventos**: [docs/diagramas/sequencia-financeira.md](diagramas/sequencia-financeira.md) — Ordem temporal das operações
- **Composição do DRE**: [docs/diagramas/dre.md](diagramas/dre.md) — Como o DRE é gerado
- **Decisão Arquitetural**: [docs/adr/ADR-001-separacao-fato-gerador-caixa-dre.md](adr/ADR-001-separacao-fato-gerador-caixa-dre.md) — Fundamento técnico da separação conceitual

---

---

## 3. Cultos e Eventos

### 3.1 Gestão de Cultos
- Cadastro de cultos com tipo, data, local, tema
- Status: Planejado, Confirmado, Realizado, Cancelado
- Duração estimada e observações

### 3.2 Liturgia
- **Timeline Visual**: Sequência de itens da liturgia
- **Tipos de Itens**: Abertura, louvor, oração, pregação, avisos, encerramento
- **Responsáveis**: Membros ou convidados externos
- **Recursos de Mídia**: Vinculação de imagens/vídeos por item
- **Duração Individual**: Tempo estimado por item
- **Templates de Liturgia**: Salvar e aplicar modelos

### 3.3 Músicas
- Cadastro de canções com título, artista, tom, BPM
- Cifra e letra integradas
- Links para Spotify e YouTube
- Atribuição de ministro e solista

### 3.4 Escalas de Voluntários
- **Times**: Recepção, Mídia, Louvor, Kids, etc.
- **Posições**: Funções específicas por time
- **Membros**: Cadastro de voluntários por time
- **Escalação por Culto**: Atribuição de pessoas a posições
- **Confirmação**: Workflow de aceite/recusa pelos voluntários
- **Templates**: Escalas padrão para reutilização

### 3.5 Projeção (Telão)
- Página fullscreen para projeção (/telao/:cultoId)
- Playlist automática baseada na liturgia
- Controles por teclado (setas, F, P, B, C)
- Atualização em tempo real via Supabase Realtime
- Suporte a imagens e vídeos

---

## 4. Intercessão

### 4.1 Pedidos de Oração
- Recebimento de pedidos (membros e externos)
- Classificação por tipo (saúde, família, financeiro, etc.)
- Status: Pendente, Alocado, Orando, Respondido, Arquivado
- Suporte a pedidos anônimos

### 4.2 Intercessores
- Cadastro de intercessores dedicados
- Limite máximo de pedidos por intercessor
- Alocação automática balanceada
- Observações e acompanhamento

### 4.3 Testemunhos
- Envio de testemunhos por membros
- Categorização e aprovação para publicação
- Status: Aberto, Público, Arquivado
- Vinculação automática com perfis existentes

### 4.4 Sentimentos
- Registro diário de sentimentos pelos membros
- Notificação push diária às 9h ("Como você está?")
- Redirecionamento inteligente:
  - Sentimentos positivos → Compartilhar testemunho
  - Sentimentos negativos → Criar pedido de oração
- **Alertas Críticos**: Detecção de 3+ dias consecutivos de sentimentos negativos

---

## 5. Jornadas e Ensino

### 5.1 Jornadas (Cursos)
- Criação de trilhas educacionais (Consolidação, Escola de Líderes, etc.)
- **Etapas**: Fases sequenciais da jornada
- **Tipos de Conteúdo**: Vídeo, texto, presencial, evento
- **Kanban**: Visualização do progresso dos participantes
- **Responsáveis**: Líderes/discipuladores por participante

### 5.2 Player de Cursos (Aluno)
- Interface LMS para consumo de conteúdo
- Barra de progresso por curso
- Marcação de etapas concluídas
- Navegação entre etapas com status visual

### 5.3 Gestão de Ensino
- Agendamento de aulas (presencial/online/híbrido)
- Vinculação com jornadas e cultos
- Registro de presenças

### 5.4 Ministério Infantil (Kids)
- **Salas**: Cadastro com capacidade e faixa etária
- **Check-in/Check-out**: Registro de entrada e saída
- **Segurança**: Código único por criança
- **Etiquetas**: Impressão de labels para criança e responsável
- **Ocupação em Tempo Real**: Visualização de lotação por sala

---

## 6. Comunicação

### 6.1 Canais de Distribuição
- **App/Dashboard**: Alertas e banners para usuários logados
- **Telão**: Slideshow para projeção na igreja
- **Site**: Integração futura com website

### 6.2 Tipos de Comunicado
- **Banners**: Comunicados visuais com imagem
- **Alertas**: Mensagens de urgência

### 6.3 Gestão de Mídias
- Biblioteca centralizada de imagens e vídeos
- Tags para categorização
- Vinculação com comunicados e liturgia

### 6.4 Hub de Publicação
- Interface unificada para gerenciar comunicações
- Filtros por canal
- Agendamento de publicação
- Status ativo/inativo

---

## 7. Dashboard

### 7.1 Dashboard Admin/Pastor
- Gráfico de fluxo de caixa mensal
- KPIs de projetos e tarefas
- Alertas pastorais (ovelhas em risco)
- Aniversariantes do período

### 7.2 Dashboard Líder
- Gestão de célula/ministério
- Ações rápidas de chamada
- Registro de visitantes

### 7.3 Dashboard Membro
- Carrossel de comunicados
- Carteirinha digital com QR Code
- Grade de ações (PIX, pedidos, etc.)
- Minhas tarefas

---

## 8. Projetos e Tarefas

### 8.1 Projetos
- Cadastro com título, descrição, datas
- Status: Ativo, Concluído, Pausado
- Líder responsável
- Barra de progresso visual

### 8.2 Tarefas (Kanban)
- Três colunas: Não Iniciado, Em Execução, Finalizado
- Drag-and-drop para mudança de status
- Prioridade: Baixa, Média, Alta
- Data de vencimento com destaque para atrasadas
- Responsável por tarefa

---

## 9. Presença e Check-in

### 9.1 Chamada de Culto
- Registro de presença por culto
- Métodos: Manual, QR Code, WhatsApp Geo, Líder
- Validação por líder de célula/ministério

### 9.2 Check-in por Geolocalização
- Integração via WhatsApp (Make.com)
- Validação de proximidade com coordenadas da igreja
- Registro automático de presença

### 9.3 QR Code de Membro
- Carteirinha digital no dashboard
- Leitura para check-in rápido

---

## 10. Minhas Escalas (Voluntário)

- Visualização de escalas atribuídas
- Confirmação ou recusa com justificativa
- Briefing por categoria:
  - Louvor: Repertório com tom/BPM/cifra
  - Kids: Tema da aula e materiais
  - Outros: Checklist geral

---

## 11. Minha Família

- Visualização de membros da família
- Adição de dependentes (filhos)
- Edição de dados dos dependentes
- Vinculação automática via `familia_id`

---

## 12. Cadastro Público

### 12.1 Registro de Visitante
- Página pública (/cadastro/Visitante)
- QR Code para distribuição
- Campos: Nome, telefone, como conheceu, tipo de visita

### 12.2 Atualização de Membro
- Página pública (/cadastro/Membro)
- Busca por email
- Atualização de dados sem login

---

## 13. Autenticação e Permissões

### 13.1 Roles do Sistema
- **Admin**: Acesso total
- **Pastor**: Acesso total
- **Líder**: Acesso a funcionalidades de liderança
- **Secretário**: Gestão de pessoas e cadastros
- **Tesoureiro**: Acesso ao módulo financeiro
- **Membro**: Acesso básico + módulos permitidos
- **Básico**: Acesso restrito (visualização)

### 13.2 Níveis de Acesso por Módulo
- Visualizar
- Criar e Editar
- Aprovar/Gerenciar
- Acesso Total

### 13.3 Autenticação Biométrica
- WebAuthn/Passkeys
- Desbloqueio rápido por biometria do dispositivo

---

## 14. Notificações

### 14.1 Tipos de Notificação
- Novos pedidos de oração
- Novos testemunhos
- Escalas atribuídas
- Alertas de sentimentos críticos
- Aniversariantes

### 14.2 Automações
- Notificação diária de sentimentos (9h)
- Alertas de aniversário
- Verificação de sentimentos críticos (8h)

---

## 15. Integrações

### 15.1 Make.com (Webhooks)
- Recebimento de pedidos de oração
- Recebimento de testemunhos
- Check-in por geolocalização
- Notificação de liturgia

### 15.2 Supabase Realtime
- Atualização em tempo real do telão
- Sincronização de dados

---

## 16. Exportação de Dados

- Exportação Excel disponível em:
  - Transações financeiras
  - Lista de pessoas
  - Pedidos de oração
  - Testemunhos
  - DRE

---

## 17. Bíblia

- Acesso integrado à Bíblia
- Disponível para todos os usuários

---

## Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **IA**: Google Gemini 2.5 Pro (processamento de notas fiscais)
- **Gráficos**: Recharts
- **PWA**: Instalável como aplicativo
- **Realtime**: Supabase Realtime para atualizações ao vivo
