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

### 1.7 Módulo Pessoas / Membros
- **Objetivo**: Centralizar o cadastro unificado de visitantes, frequentadores e membros, permitindo listar, buscar/filtrar e manter dados completos de perfil e status.
- **Funcionalidades principais**: listar (ordenado por nome via `profiles`), buscar/filtrar por nome/telefone/email/status, criar pessoa, editar pessoa (dados pessoais, contatos, eclesiásticos, adicionais, status), exportar listagens e navegar para detalhes.
- **Campos/atributos (profiles)**: `id`, `nome`, `email`, `telefone`, `avatar_url`, `status` (`visitante` | `frequentador` | `membro`), `data_primeira_visita`, `numero_visitas`, `user_id`, `sexo`, `data_nascimento`, `estado_civil`, `data_casamento`, `rg`, `cpf`, `alergias`, `necessidades_especiais`, `cep`, `cidade`, `bairro`, `estado`, `endereco`, `entrou_por`, `data_entrada`, `status_igreja`, `data_conversao`, `batizado`, `data_batismo`, `e_lider`, `e_pastor`, `escolaridade`, `profissao`, `nacionalidade`, `naturalidade`, `entrevistado_por`, `cadastrado_por`, `tipo_sanguineo`, `observacoes`.
- **Regras de negócio**: status permitido limitado a `visitante`/`frequentador`/`membro`; filtros locais por nome/telefone/email/status na listagem; criação/edição persiste em `profiles` via Supabase; não há deduplicação automática visível para nome/telefone/email (conferência manual necessária).
- **Links**: [Manual do Usuário — Pessoas](manual-usuario.md#3-gestão-de-pessoas) · [Fluxo Pessoas (Mermaid)](diagramas/fluxo-pessoas.md) · [Sequência Pessoas (Mermaid)](diagramas/sequencia-pessoas.md) · [Permissões Pessoas](diagramas/permissoes-pessoas.md)
- **Referências complementares**: [BIDIRECTIONAL_RELATIONSHIPS.md](BIDIRECTIONAL_RELATIONSHIPS.md) (exibição bidirecional de familiares), [AUTHORIZED_GUARDIANS.md](AUTHORIZED_GUARDIANS.md) (responsáveis autorizados para crianças/Kids) e [KIDS_INCLUSION.md](KIDS_INCLUSION.md) (campo de necessidades especiais na jornada Kids ligado aos perfis).

#### Módulo Pessoas / Membros — visão funcional
- **Funcionalidades disponíveis**: dashboard com estatísticas por status; listagem com ordenação por nome e avatars (quando cadastrados); busca e filtro de status; criação/edição de perfis completos; evolução de status visitante → frequentador → membro; visualização de vínculos familiares bidirecionais; atribuição de funções ministeriais; exportação da listagem.
- **Ações permitidas**: criar pessoa (nome obrigatório, contato recomendado), editar dados pessoais/contatos/status/funções, navegar para detalhes, aplicar busca/filtros, carregar mais itens via scroll, acionar atalhos rápidos para segmentos (membros, visitantes, frequentadores).
- **Regras funcionais**: status restrito a `visitante`/`frequentador`/`membro`; sem deduplicação automática (verificar duplicidade de nome/telefone/email antes de salvar); campos mínimos para cadastro exigem nome; contatos incompletos reduzem eficácia da busca e follow-up; vínculos familiares exibem ambos os lados com inversão de papel; avatars não são obrigatórios e podem exibir fallback.
- **Links relacionados**: [Manual do Usuário — Pessoas](manual-usuario.md#3-gestão-de-pessoas) · [Produto — Pessoas/Membros](produto/README_PRODUTO.MD#pessoas--membros-visão-de-produto)

---

## Módulo Kids

### Visão de funcionalidades
- **Gestão de crianças e turmas**: diretório de crianças com busca/filtragem e visão de salas/turmas do ministério Kids (cadastro/edição direto no diretório está **a confirmar** conforme disponibilidade da tela).
- **Presença e diário**: registro de check-in/checkout nas atividades e anotações de diário (humor, saúde, observações). Resumo conceitual em `docs/KIDS_INCLUSION.md`.
- **Etiquetas e segurança**: uso das informações de perfil para etiquetas de segurança e conferência na retirada.
- **Ocupação por sala**: visão de lotação em tempo real das salas Kids.

### Regras de autorização de responsáveis
- **Quem pode retirar**: apenas responsáveis autorizados (guardians) configurados previamente podem realizar o checkout de uma criança.
- **Como configurar**: seleção de pessoa autorizada e, quando aplicável, indicação das crianças específicas. Fluxos e cenários em `docs/AUTHORIZED_GUARDIANS.md`.
- **Escopo**: autorização é vinculada ao contexto familiar e às crianças selecionadas; alterações devem ser registradas antes do evento.

### Regras de notificações
- **Eventos que disparam**: checkout concluído, registros de diário/observações e alertas comportamentais/assiduidade.
- **Para quem e quando**: direcionamento conforme perfil (equipe do Kids, responsáveis, liderança) e momento do evento. Resumo operacional em `docs/NOTIFICACOES_KIDS.md`.

### Referências
- Manual (seção Kids): [docs/manual-usuario.md](manual-usuario.md#kids)
- Produto (seção Kids): [docs/produto/README_PRODUTO.MD](produto/README_PRODUTO.MD#kids-visão-de-produto)
- Regras e fluxos Kids: [KIDS_INCLUSION.md](KIDS_INCLUSION.md) · [AUTHORIZED_GUARDIANS.md](AUTHORIZED_GUARDIANS.md) · [NOTIFICACOES_KIDS.md](NOTIFICACOES_KIDS.md)

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

---

## Módulo Comunicação

### Objetivo do Módulo
Facilitar a criação e publicação de comunicados institucionais (avisos, banners, alertas) de forma manual e editorial pela liderança, garantindo visibilidade multiplataforma (app, telão/projetor, site público). O módulo **não** faz disparo automático de notificações push, e-mail ou WhatsApp; apenas publica conteúdo gerenciado manualmente.

### Funcionalidades Principais

#### Tipos de Comunicação
Baseado na tabela `comunicados`:
- **Banner**: comunicado visual com imagem destacada, exibido em carrossel (campo `tipo = 'banner'`)
- **Alerta**: comunicado de urgência com mensagem obrigatória, exibido com destaque visual (campo `tipo = 'alerta'`)

#### Criação e Gestão de Comunicados
- **Criar comunicado**: wizard em 3 etapas (conteúdo, canais, agendamento)
  - Conteúdo: título, tipo (banner/alerta), descrição, imagem (storage `comunicados`), link de ação
  - Canais: selecionar onde exibir (`exibir_app`, `exibir_telao`, `exibir_site`)
  - Agendamento: datas de início/fim (`data_inicio`, `data_fim`), tags (`tags[]`), categoria (`categoria_midia`), ordem telão (`ordem_telao`)
- **Editar comunicado**: abrir comunicado existente e modificar via diálogo de edição
- **Ativar/Desativar**: flag `ativo` controla se o comunicado está visível ou pausado
- **Excluir**: remove registro e arquivo do storage `comunicados` (se não usado por outros)
- **Vincular a culto**: FK opcional `culto_id` para associar comunicado a evento específico
- **Vincular a mídia**: FK opcional `midia_id` para reutilizar mídias da biblioteca

#### Segmentação por Canal
- **App/Dashboard** (`exibir_app = true`):
  - Exibido no carrossel de banners do dashboard dos membros
  - Componente: `BannerCarousel.tsx`
  - Query: comunicados ativos dentro do período (`data_inicio <= NOW()` e `data_fim >= NOW()` ou nula)
- **Telão/Projetor** (`exibir_telao = true`):
  - Consumido pela página `/telao` em carrossel automático
  - Componente: `Telao.tsx`
  - Ordem controlada por `ordem_telao`
  - Suporta arte alternativa via `url_arquivo_telao` (ex.: formato 16:9 vs 9:16)
- **Site Público** (`exibir_site = true`):
  - Exibido no carrossel do site da igreja (integração a confirmar)

#### Estados do Comunicado
Baseado nos campos da tabela `comunicados`:
- **Ativo** (`ativo = true`): comunicado está sendo exibido nos canais selecionados (respeitando período de data_inicio/data_fim)
- **Inativo** (`ativo = false`): comunicado pausado ou expirado, não aparece em nenhum canal

**Observação:** Não há estados intermediários como "rascunho", "em aprovação" ou "enviado". Comunicados são criados e imediatamente ativados ou desativados.

#### Histórico e Listagem
- **Listagem completa**: página `/comunicados` mostra todos os comunicados cadastrados com:
  - Título, tipo (banner/alerta), status (ativo/inativo)
  - Canais de exibição (ícones app/telão/site)
  - Datas de início/fim
  - Contadores: total de comunicados e quantos estão ativos
- **Busca e filtros**: (a confirmar) buscar por título, filtrar por canal ou status
- **Ordenação**: (a confirmar) por data de criação/atualização

#### Categorização e Tags
- **Tags** (`tags[]`): array de strings para categorização livre (ex.: `["Abertura", "Louvor", "Avisos Gerais"]`)
- **Categoria de mídia** (`categoria_midia`): classificação predefinida (`geral`, `eventos`, `liturgia`)
- Uso: organização e busca dentro da biblioteca de comunicados/mídias

### Regras de Autorização

#### Permissões RLS (Row Level Security)
Baseado nas policies da migração `20251203182759_...sql`:

1. **Leitura pública** (`comunicados_leitura_publica`):
   - **Quem**: todos os usuários (incluindo não autenticados)
   - **O que**: SELECT em comunicados ativos dentro do período de exibição
   - **Condição**: `ativo = true` e `data_inicio <= NOW()` e (`data_fim IS NULL` ou `data_fim >= NOW()`)

2. **Gestão admin** (`comunicados_gestao_admin`):
   - **Quem**: apenas usuários autenticados com role `admin` ou `secretario` (a confirmar via `has_role()`)
   - **O que**: ALL (INSERT, UPDATE, DELETE, SELECT ilimitado)
   - **Condição**: `auth.role() = 'authenticated'` (policy simplificada; refinamento via app-level se necessário)

#### Storage Bucket
Baseado na migração de storage:
- **Bucket `comunicados`**: público (`public = true`)
- **Policies**:
  - `comunicados_public_access`: SELECT público
  - `comunicados_admin_insert`: INSERT apenas para autenticados
  - `comunicados_admin_update`: UPDATE apenas para autenticados
  - `comunicados_admin_delete`: DELETE apenas para autenticados

#### Resumo de Permissões
- **Visualizar comunicados ativos**: qualquer pessoa (público)
- **Criar/editar/excluir comunicados**: apenas administradores e secretaria
- **Upload de imagens**: apenas usuários autenticados

### Fluxo Típico de Uso

1. **Criação**:
   - Liderança/secretaria acessa `/comunicados` → "+ Novo Comunicado"
   - Preenche wizard (conteúdo, canais, agendamento)
   - Clica em "Publicar" → INSERT na tabela `comunicados` com `ativo = true`

2. **Exibição**:
   - **App**: membros veem no carrossel do dashboard (query automática por `exibir_app = true`)
   - **Telão**: operador abre `/telao` → carrossel consome comunicados com `exibir_telao = true`
   - **Site**: (integração a confirmar)

3. **Gestão**:
   - Editar: clicar no comunicado → modal de edição → UPDATE
   - Desativar: toggle `ativo = false` → comunicado some dos canais
   - Excluir: DELETE → remove do banco e storage

4. **Expiração**:
   - Comunicados com `data_fim` passada são automaticamente filtrados nas queries de exibição
   - Não há job automático para desativar; permanecem com `ativo = true` mas não aparecem

### Integrações e Limitações

#### O que o módulo FAZ:
- Criação editorial manual de comunicados
- Publicação multiplataforma (app, telão, site)
- Agendamento de período de exibição
- Upload e gestão de imagens no storage público
- Vínculo opcional com cultos e biblioteca de mídias
- Controle de ordem de exibição no telão

#### O que o módulo NÃO FAZ:
- ❌ Disparo automático de push notifications
- ❌ Envio de e-mails ou mensagens WhatsApp
- ❌ Segmentação por perfis de usuário (roles/grupos)
- ❌ Workflow de aprovação ou estados intermediários (rascunho/revisão)
- ❌ Automação de marketing ou CRM
- ❌ Analytics de visualizações/cliques (a confirmar)

### Referências

- Manual do Usuário — Comunicação: [docs/manual-usuario.md](manual-usuario.md#9-comunicação)
- Produto — Comunicação: [docs/produto/README_PRODUTO.MD](produto/README_PRODUTO.MD#comunicação-visão-de-produto)
- Diagrama de fluxo: [docs/diagramas/fluxo-comunicacao.md](diagramas/fluxo-comunicacao.md)
- Diagrama de sequência: [docs/diagramas/sequencia-comunicacao.md](diagramas/sequencia-comunicacao.md)

---

## Módulo Notificações

O **Módulo Notificações** gerencia alertas automáticos disparados pelo sistema em resposta a **eventos operacionais**. Diferente do módulo de Comunicação (que é criação manual e editorial), as notificações são **automáticas, baseadas em templates fixos e destinatários definidos por cargo (role)**.

### Objetivo

Reduzir a dependência de comunicação manual entre áreas, garantindo que **pessoas certas sejam notificadas no momento certo** sobre eventos críticos ou relevantes para suas funções.

### Componentes Principais

#### Frontend
- **`src/pages/admin/Notificacoes.tsx`**: tela de configuração de regras de notificações (admin)
- **`src/hooks/useNotifications.tsx`**: hook para gerenciar notificações in-app, push e sincronização em tempo real
- **`src/components/NotificationBell.tsx`**: componente do sininho (bell) na barra superior com popover de notificações
- **`src/components/NotificationSettings.tsx`**: tela de preferências do usuário (a confirmar)

#### Backend (Supabase)
- **Tabelas**:
  - `notifications`: registro de notificações enviadas/recebidas (user_id, title, message, type, read, metadata)
  - `notificacao_eventos`: catálogo de eventos que podem disparar notificações (slug, nome, categoria, variaveis, provider_preferencial)
  - `notificacao_regras`: regras de disparo (evento_slug, role_alvo, canais, ativo)

- **Edge Functions**:
  - `disparar-alerta`: função central que recebe eventos, busca regras ativas, resolve destinatários e dispara notificações multi-canal
  - `notificar-aniversarios`: cron job que verifica aniversários do dia seguinte e dispara notificações
  - `notificar-sentimentos-diario`: cron job diário perguntando aos membros sobre sentimentos
  - `notificar-liturgia-make`: notificação de liturgia via Make (a confirmar)

#### Canais de Entrega
- **In-App (Sininho)**: notificação no sistema via tabela `notifications`, visível no `NotificationBell`
- **Push Notification**: browser Notification API (requer permissão do usuário)
- **WhatsApp**: via Meta API direto ou Make (conforme `provider_preferencial` do evento)
- **Email**: estrutura preparada na tabela `notificacao_regras`, mas não implementado

### Catálogo de Eventos

Baseado na migration `20251211215552_509ce355-3ad5-444f-857c-4bf1e1001209.sql`:

| Evento Slug                       | Categoria   | Provider Preferencial | Variáveis Disponíveis                      |
|-----------------------------------|-------------|-----------------------|--------------------------------------------|
| `financeiro_conta_vencer`         | financeiro  | meta_direto           | descricao, valor, vencimento               |
| `financeiro_reembolso_aprovacao`  | financeiro  | make                  | solicitante, valor                         |
| `kids_checkin`                    | kids        | meta_direto           | crianca, responsavel                       |
| `kids_ocorrencia`                 | kids        | meta_direto           | crianca, motivo                            |
| `novo_visitante`                  | pessoas     | make                  | nome, telefone                             |
| `pedido_oracao`                   | intercessao | make                  | nome, motivo                               |

> 📌 **Provider Preferencial**: define qual integração externa usar para WhatsApp (`meta_direto` = Meta API, `make` = n8n/Make webhook).

### Regras de Disparo

Cada **regra** (`notificacao_regras`) define:
- **evento_slug**: qual evento escutar (ex: `kids_checkin`)
- **role_alvo**: qual cargo recebe (ex: `admin`, `pastor`, `tesoureiro`)
- **user_id_especifico**: override para usuário específico (opcional)
- **canais** (jsonb):
  - `inapp`: boolean (sininho no sistema)
  - `push`: boolean (push notification no navegador)
  - `whatsapp`: boolean (via integração externa)
- **ativo**: boolean (liga/desliga a regra)

Exemplo de regra:
```json
{
  "evento_slug": "kids_ocorrencia",
  "role_alvo": "admin",
  "canais": {
    "inapp": true,
    "push": true,
    "whatsapp": false
  },
  "ativo": true
}
```

### Fluxo de Disparo

1. **Evento Ocorre no Sistema**:
   - Ex: criança faz check-in → código frontend/backend invoca Edge Function `disparar-alerta` com payload:
     ```json
     {
       "evento": "kids_checkin",
       "dados": {
         "crianca": "João Silva",
         "responsavel": "Maria Silva"
       }
     }
     ```

2. **Edge Function Processa**:
   - Busca evento em `notificacao_eventos` (valida se existe)
   - Busca regras ativas em `notificacao_regras` para o evento
   - Resolve destinatários:
     - Se `role_alvo`: busca todos usuários com esse cargo em `user_roles`
     - Se `user_id_especifico`: apenas esse usuário
   - Formata mensagem substituindo variáveis no template (ex: `{{crianca}}` → "João Silva")

3. **Entrega Multi-Canal**:
   - **In-App**: INSERT na tabela `notifications` (user_id, title, message, type)
   - **Push**: usa browser Notification API no frontend (via realtime subscription)
   - **WhatsApp**: chama API externa (Meta ou Make) com número do destinatário e mensagem formatada

4. **Exibição no Frontend**:
   - `useNotifications` hook subscreve realtime na tabela `notifications`
   - Ao receber nova notificação, atualiza estado e exibe no `NotificationBell`
   - Se push habilitado, dispara também browser notification

### Estados e Ciclo de Vida

- **Criação**: notificação inserida via Edge Function com `read = false`
- **Não lida**: visível no sininho com bolinha azul à esquerda
- **Lida**: usuário clica → UPDATE `read = true`, bolinha desaparece
- **Excluída**: usuário clica na lixeira → DELETE (não há soft delete)

Não há estados intermediários (rascunho, pendente, etc.). Notificações são **imediatas e finais**.

### Regras de Autorização (RLS)

#### Tabela `notifications`
Baseado em `docs/database-schema.sql`:
- **Criar**: `"Sistema pode criar notificações"` → INSERT sem restrição (service role)
- **Ler**: `"Usuários podem ver suas notificações"` → SELECT WHERE `auth.uid() = user_id`
- **Atualizar**: `"Usuários podem atualizar suas notificações"` → UPDATE WHERE `auth.uid() = user_id`

#### Tabelas `notificacao_eventos` e `notificacao_regras`
Baseado em migration `20251211215552_...sql`:
- **Leitura pública eventos**: SELECT para todos autenticados
- **Leitura pública regras**: SELECT para todos autenticados (para o sistema resolver destinatários)
- **Admin gerencia regras**: ALL apenas para usuários com role `admin` em `user_roles`

### Fluxo Típico de Uso

#### Como Usuário Final:
1. **Receber notificação**:
   - Sistema dispara evento → notificação aparece no sininho
   - Badge vermelho indica contagem de não lidas
   - (Opcional) Push notification no navegador/celular

2. **Ver detalhes**:
   - Clica no sininho → popover abre com lista de notificações
   - Cada notificação mostra: ícone, categoria, título, mensagem, tempo relativo

3. **Interagir**:
   - Clicar na notificação → redireciona para tela relevante (deep link) e marca como lida
   - Clicar em "Limpar" → marca todas como lidas de uma vez
   - Clicar na lixeira → exclui notificação específica

#### Como Administrador:
1. **Acessar configurações**:
   - `/admin/notificacoes` → tela com cards de eventos agrupados por categoria

2. **Adicionar destinatário a um evento**:
   - Clicar em "+ Add" no card do evento
   - Selecionar role (cargo) no dropdown
   - Regra criada com canais padrão (inapp = true, push/whatsapp = false)

3. **Configurar canais**:
   - Usar switches (toggle) para ativar/desativar canais por destinatário
   - Exemplo: "Tesoureiro recebe apenas in-app, líder recebe in-app + push + WhatsApp"

4. **Remover destinatário**:
   - Hover na linha → clicar na lixeira → DELETE da regra

### Integrações e Limitações

#### O que o módulo FAZ:
- Disparo automático de notificações baseado em eventos reais do sistema
- Entrega multi-canal (in-app, push, WhatsApp)
- Configuração flexível por evento e role
- Templates automáticos com substituição de variáveis
- Histórico de notificações recebidas (read/unread)
- Sincronização em tempo real via Supabase Realtime

#### O que o módulo NÃO FAZ:
- ❌ Criação manual de mensagens (isso é Comunicação)
- ❌ Edição de conteúdo da notificação (templates são fixos)
- ❌ Segmentação arbitrária ou campanhas de marketing
- ❌ Workflow de aprovação ou estados intermediários
- ❌ Analytics de taxa de abertura/clique (a confirmar)
- ❌ Agendamento manual de envio (notificações são sempre imediatas ao evento)

### Referências

- Manual do Usuário — Notificações: [docs/manual-usuario.md](manual-usuario.md#10-notificações)
- Produto — Notificações: [docs/produto/README_PRODUTO.MD](produto/README_PRODUTO.MD#notificações-visão-de-produto)
- Diagrama de fluxo: [docs/diagramas/fluxo-notificacoes.md](diagramas/fluxo-notificacoes.md) (a criar)
- Diagrama de sequência: [docs/diagramas/sequencia-notificacoes.md](diagramas/sequencia-notificacoes.md) (a criar)

