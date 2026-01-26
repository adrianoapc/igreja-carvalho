# Backlog de Melhorias

Este documento reúne melhorias sugeridas para o projeto.  
Mantenha as entradas organizadas e atualizadas à medida que novos insights forem adicionados.

## 📌 Visão Geral
- **Objetivo:** Consolidar ideias, necessidades e oportunidades de melhoria.
- **Status:** Em construção contínua.
- **Responsáveis:** A definir por cada iniciativa.

---

## ✅ Itens do Backlog

### [ ] 1. **Criar as 6 trilhas base de voluntariado**
- **Descrição:** Cadastrar jornadas placeholder (Kids, Louvor, Mídia, Recepção, etc.) com conteúdo mínimo para que a triagem direcione corretamente.
- **Categoria:** Operacional / Conteúdo
- **Prioridade:** Crítica
- **Impacto Esperado:** Evitar que candidatos caiam em trilhas vazias.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Pode começar com 1 vídeo + 1 texto de regras.


### [ ] 2. **Definir variante definitiva de navbar mobile**
- **Descrição:** Encerrar testes em `NAVBAR_TESTS.md` e escolher a variante padrão (recomendação: Fintech/Nubank).
- **Categoria:** UX / Navegação
- **Prioridade:** Crítica
- **Impacto Esperado:** Experiência de app nativo consistente no mobile.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Remover código de teste e padronizar no `MainLayout.tsx`.


### [ ] 3. **Teste de impressão Kids em hardware real**
- **Descrição:** Validar fluxo de impressão de etiquetas Kids em tablets reais + impressoras térmicas (Zebra/Brother).
- **Categoria:** Operacional / Infraestrutura
- **Prioridade:** Crítica
- **Impacto Esperado:** Evitar filas e falhas de check-in no domingo.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Ter plano B com etiquetas manuais.


### [ ] 4. **Validação de segurança (RLS) em pedidos de oração**
- **Descrição:** Confirmar tecnicamente que membros comuns não conseguem ler pedidos de oração de outras pessoas via API.
- **Categoria:** Segurança / Privacidade
- **Prioridade:** Crítica
- **Impacto Esperado:** Garantir confidencialidade e reduzir risco de vazamento.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Recomendado antes do lançamento oficial.


### [ ] 5. **Avatares consistentes em Pessoas (listas e cards)**
- **Descrição:** Centralizar o upload de avatar e garantir renderização de `avatar_url` nas listas de Membros/Visitantes e nos cards de Ações Rápidas.
- **Categoria:** UX / Visual
- **Prioridade:** Crítica
- **Impacto Esperado:** Melhor percepção de completude e identificação rápida das pessoas.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Principal débito visual apontado na auditoria de UX.


### [ ] 6. **Checkout Pix automático (Copy & Paste + webhook)**
- **Descrição:** Integrar gateway de pagamento (Asaas/Mercado Pago/OpenPix) para gerar QR Code Pix dinâmico e atualizar `status_pagamento` via webhook.
- **Categoria:** Financeiro / Automação / Infraestrutura
- **Prioridade:** Crítica
- **Impacto Esperado:** Eliminar baixa manual e reduzir gargalos em eventos grandes.
- **Esforço Estimado:** Alto
- **Status:** Pendente
- **Observações:** Edge Function para processar webhook e confirmar transações.


### [ ] 7. **Ajustar padding do conteúdo para navbar mobile**
- **Descrição:** Garantir que o conteúdo principal não fique oculto atrás da Bottom Bar após definir a variante oficial.
- **Categoria:** UX / Layout
- **Prioridade:** Alta
- **Impacto Esperado:** Navegação confortável sem elementos escondidos no mobile.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Revisar `MainLayout.tsx` e espaçamentos globais.


### [ ] 8. **Card do Relógio de Oração na Sala de Guerra**
- **Descrição:** Conectar o Relógio de Oração à Sala de Guerra com um card no topo usando `useRelogioAgora`.
- **Categoria:** UX / Integração
- **Prioridade:** Alta
- **Impacto Esperado:** Facilitar entrada no turno correto e dar contexto ao intercessor.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Link para o player do turno ativo e estado vazio quando não houver relógio.


### [ ] 9. **Formulários de novo cadastro responsivos no mobile**
- **Descrição:** Ajustar grids de data em `Membro.tsx` e `Visitante.tsx` para comportamento responsivo (ex.: `grid-cols-1` no mobile).
- **Categoria:** UX / Mobile
- **Prioridade:** Alta
- **Impacto Esperado:** Reduzir fricção em telas pequenas (iPhone SE/Android compactos).
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Edição já foi corrigida; falta apenas novo cadastro.


### [ ] 10. **Link de pagamento automático no envio de confirmação**
- **Descrição:** Ao criar inscrição, enviar mensagem automática com instruções de Pix e link para envio de comprovante.
- **Categoria:** Comunicação / Quick Win
- **Prioridade:** Alta
- **Impacto Esperado:** Reduz atrito e acelera confirmação sem gateway completo.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Usar infraestrutura atual de notificações.


### [ ] 11. **Notificação automática para novos candidatos**
- **Descrição:** Ativar gatilho `notify_new_candidato_voluntario` para alertar líderes/admin quando alguém se inscrever.
- **Categoria:** Operacional / Comunicação
- **Prioridade:** Alta
- **Impacto Esperado:** Reduzir tempo de resposta e evitar candidatos parados.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Pode iniciar com e-mail/alerta simples.


### [ ] 12. **Notificações para responsáveis por tarefas**
- **Descrição:** Disparar notificação ao criar tarefa ou alterar responsável/status em Projetos.
- **Categoria:** Comunicação / Automação
- **Prioridade:** Alta
- **Impacto Esperado:** Evitar tarefas esquecidas e aumentar engajamento.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Trigger/Edge Function ao inserir/atualizar tarefa.


### [ ] 13. **Realtime na Sala de Guerra**
- **Descrição:** Verificar se a página atualiza automaticamente quando novos pedidos chegam, sem necessidade de F5.
- **Categoria:** UX / Tempo Real
- **Prioridade:** Alta
- **Impacto Esperado:** Melhor fluidez para intercessores e resposta mais rápida.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Validar assinatura/stream e estado da UI.


### [ ] 14. **Seleção de canais no Comunicado**
- **Descrição:** Adicionar checkboxes `exibir_app` e `exibir_telao` no `ComunicadoDialog.tsx` para controlar onde o aviso aparece.
- **Categoria:** Produto / Comunicação
- **Prioridade:** Alta
- **Impacto Esperado:** Garantir controle editorial e evitar comunicados invisíveis.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Verificar defaults na tabela `comunicados`.


### [ ] 15. **Testes de RBAC com `requiredPermission`**
- **Descrição:** Validar bloqueios de rota no `AuthGate.tsx` com diferentes perfis e permissões.
- **Categoria:** Segurança / Qualidade
- **Prioridade:** Alta
- **Impacto Esperado:** Garantir que usuários sem permissão não acessem áreas administrativas.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Cobrir casos de Financeiro e Admin.


### [ ] 16. **Agendamento considera bloqueios de agenda**
- **Descrição:** Atualizar `AgendamentoDialog.tsx` para considerar `agenda_bloqueios` ao calcular slots disponíveis.
- **Categoria:** Produto / Arquitetura
- **Prioridade:** Alta
- **Impacto Esperado:** Evitar agendamentos durante férias/ausências.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Integrar com a lógica já usada para `agenda_pastoral` e `atendimentos_pastorais`.


### [ ] 17. **Ativar e divulgar check-in via WhatsApp/Geo**
- **Descrição:** Verificar e ativar a Edge Function `checkin-whatsapp-geo`, promovendo check-in automático por geolocalização.
- **Categoria:** Produto / Automação
- **Prioridade:** Alta
- **Impacto Esperado:** Reduzir filas e dependência de QR Code.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Definir raio de geofencing e comunicação no lançamento.


### [ ] 18. **Cache local da liturgia inteligente**
- **Descrição:** Implementar cache local da última liturgia carregada para fallback offline do `useLiturgiaInteligente`.
- **Categoria:** Confiabilidade / Performance
- **Prioridade:** Alta
- **Impacto Esperado:** Garantir funcionamento em instabilidade de internet.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Persistir no LocalStorage e revalidar quando online.


### [ ] 19. **Formulário de inscrição customizável**
- **Descrição:** Permitir perguntas extras por evento (ex.: tamanho de camiseta, restrição alimentar), armazenando JSONB em `eventos` e respostas em `inscricoes_evento`.
- **Categoria:** Produto / Dados
- **Prioridade:** Alta
- **Impacto Esperado:** Melhor logística de retiros e conferências.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Estrutura JSON com tipos de campo e obrigatoriedade.


### [ ] 20. **Hotsite público de evento (SEO + compartilhamento)**
- **Descrição:** Criar uma rota pública (`/public/evento/:slug`) com layout otimizado para conversão, exibindo banner, descrição rica e botão flutuante de inscrição, consumindo dados de `eventos`.
- **Categoria:** Produto / UX / Marketing
- **Prioridade:** Alta
- **Impacto Esperado:** Aumentar compartilhamento e inscrições sem exigir login imediato.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Incluir OG tags para WhatsApp, seção de prova social (“Quem já vai”).


### [ ] 21. **Indisponibilidade unificada por perfil (agenda_bloqueios)**
- **Descrição:** Criar entidade central de bloqueios por `profile_id` para pastor e voluntário, usada por gabinete, escalas e demais módulos.
- **Categoria:** Produto / UX / Arquitetura
- **Prioridade:** Alta
- **Impacto Esperado:** Reduzir conflitos de agenda e eliminar soluções manuais (eventos “fake”).
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Considerar tabela `agenda_bloqueios`, RLS por perfil e UI em “Minha Agenda”.


### [ ] 22. **Interface rica de anotações pós-atendimento**
- **Descrição:** Criar UI estruturada para o pastor registrar notas durante/ao final do atendimento, com templates e campos guiados.
- **Categoria:** UX / Produto
- **Prioridade:** Alta
- **Impacto Esperado:** Melhor qualidade de registro e adesão ao uso do prontuário.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Inspirar-se em modelos de “checklist” de visitas e aconselhamento.


### [ ] 23. **Investigar causa raiz do refresh token inválido**
- **Descrição:** Seguir o checklist de `docs/REFRESH_TOKEN_INVESTIGATION.md` para entender tokens curtos (12 caracteres) no login.
- **Categoria:** Segurança / Autenticação
- **Prioridade:** Alta
- **Impacto Esperado:** Evitar dependência do fallback por access token.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Verificar configuração/versão do Supabase.


### [ ] 24. **Stage Display com timer regressivo**
- **Descrição:** Criar modo `?mode=stage` no `TelaoLiturgia.tsx` com item atual, próximo item e timer grande.
- **Categoria:** UX / Operacional
- **Prioridade:** Alta
- **Impacto Esperado:** Melhor controle de tempo para quem está no púlpito.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Atalho para alternar overlay de tempo.


### [ ] 25. **Validação financeira no check-in de eventos pagos**
- **Descrição:** Exigir conferência de `status_pagamento` no check-in de eventos pagos e alertar quando estiver pendente.
- **Categoria:** Produto / Financeiro
- **Prioridade:** Alta
- **Impacto Esperado:** Evitar acesso sem pagamento e melhorar controle na recepção.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Alertas visuais/sonoros para recepção.


### [ ] 26. **Versão mobile do DRE com cards colapsáveis**
- **Descrição:** Criar visualização mobile do DRE em `Financas.tsx` usando cards colapsáveis por mês ou gráfico resumo, evitando tabela ampla com ~13 colunas.
- **Categoria:** UX / Mobile / Financeiro
- **Prioridade:** Alta
- **Impacto Esperado:** Facilitar leitura do DRE no celular para liderança e tesouraria.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Prioridade pós-lançamento (v1.1) se o prazo estiver curto.


### [ ] 27. **Visão 360º do membro no prontuário**
- **Descrição:** Enriquecer o `AtendimentoProntuario` com dados cruzados (Pessoas, Ensino, Intercessão) para contexto pastoral.
- **Categoria:** Produto / Dados
- **Prioridade:** Alta
- **Impacto Esperado:** Atendimento mais contextualizado e ações mais assertivas.
- **Esforço Estimado:** Alto
- **Status:** Pendente
- **Observações:** Exibir histórico de jornadas, pedidos de oração e envolvimento em ministérios.


### [ ] 28. **Ajustar Tabs do Insights no mobile**
- **Descrição:** Tornar a `TabsList` de `Insights.tsx` responsiva (select ou scroll horizontal) para telas pequenas.
- **Categoria:** UX / Mobile
- **Prioridade:** Média
- **Impacto Esperado:** Evitar quebra de layout e melhorar legibilidade.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Avaliar `overflow-x-auto` ou conversão para `Select` no mobile.


### [ ] 29. **Auditoria de expiração do access token**
- **Descrição:** Revisar policy de expiração no Supabase para alinhar com a segurança (ex.: 1h) dado o uso do fallback.
- **Categoria:** Segurança / Infraestrutura
- **Prioridade:** Média
- **Impacto Esperado:** Reduzir risco de sessão prolongada indevida.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Revisar impactos em biometria e revalidação.


### [ ] 30. **Ação para botão Pix no Dashboard Membro**
- **Descrição:** Implementar ação no botão “Contribuições (Pix)” com link/QR Code estático ou página dedicada.
- **Categoria:** Produto / UX
- **Prioridade:** Média
- **Impacto Esperado:** Evitar CTA sem ação e facilitar contribuições.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Remover TODO e definir fluxo mínimo.


### [ ] 31. **Busca global no dashboard de Pessoas**
- **Descrição:** Adicionar barra de busca no topo de `/pessoas` para acesso direto a perfis sem navegar por listagens.
- **Categoria:** UX / Fluxo
- **Prioridade:** Média
- **Impacto Esperado:** Acelerar fluxo de atendimento e consulta.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Complementa as listagens existentes (“Ver Todos” / “Membros”).


### [ ] 32. **Limpeza de código de testes de navbar**
- **Descrição:** Remover variantes não adotadas e flags de experimento no layout.
- **Categoria:** Manutenção / UX
- **Prioridade:** Média
- **Impacto Esperado:** Código mais simples e menos risco de regressão visual.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Consolidar no padrão escolhido.


### [ ] 33. **Onboarding via WhatsApp ao entrar em trilha**
- **Descrição:** Enviar mensagem automática com link da trilha quando o status mudar para `Em Trilha`.
- **Categoria:** Comunicação / Automação
- **Prioridade:** Média
- **Impacto Esperado:** Aumentar conversão e início rápido do treinamento.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Reaproveitar integração com WhatsApp/Z-API.


### [ ] 34. **Testes com usuários reais (Redirecionamento Inteligente)**
- **Descrição:** Testar o fluxo em que a IA sugere transformar sentimentos em pedidos de oração, validando compreensão e taxa de clique.
- **Categoria:** Produto / Pesquisa
- **Prioridade:** Média
- **Impacto Esperado:** Aumentar adesão e clareza do fluxo.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Documentar feedbacks e ajustes necessários.


### [ ] 35. **Totem de autoatendimento no check-in**
- **Descrição:** Disponibilizar modo quiosque com `/checkin` para autoatendimento no foyer.
- **Categoria:** Operacional / UX
- **Prioridade:** Média
- **Impacto Esperado:** Reduzir carga da recepção e fila em cultos grandes.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Tablet dedicado em modo tela cheia.


### [ ] 36. **Validação do trigger de sincronização com escalas**
- **Descrição:** Testar fluxo de remoção na liturgia para garantir remoção correspondente na escala.
- **Categoria:** Qualidade / Integração
- **Prioridade:** Média
- **Impacto Esperado:** Evitar “fantasmas” na escala e inconsistências operacionais.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Cobrir create/update/delete do trigger `sync_liturgia_responsavel_to_escala`.


### [ ] 37. **Verificar gráfico de Fluxo de Caixa no mobile**
- **Descrição:** Testar responsividade do gráfico do Admin em telas pequenas (iPhone SE) e ajustar rótulos do eixo X se necessário.
- **Categoria:** UX / Mobile
- **Prioridade:** Média
- **Impacto Esperado:** Melhor legibilidade do dashboard financeiro.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** `ResponsiveContainer` já usado, foco em labels.


### [ ] 38. **Analytics de desempenho por tipo de jornada**
- **Descrição:** Implementar relatórios que indiquem onde alunos ficam “travados” por etapa/tipo de jornada.
- **Categoria:** Produto / Analytics
- **Prioridade:** Média
- **Impacto Esperado:** Melhor gestão pedagógica e ajustes de conteúdo com base em dados.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Pendência registrada na ADR-009.


### [ ] 39. **Comentários e anexos em tarefas de projetos**
- **Descrição:** Adicionar suporte a comentários e anexos nas tarefas de projeto para centralizar arquivos e contexto.
- **Categoria:** Produto / Colaboração
- **Prioridade:** Média
- **Impacto Esperado:** Melhor comunicação e menos dependência de WhatsApp.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Avaliar reutilizar `TransacaoDocumentViewer` para anexos.


### [ ] 40. **Envio de voucher/QR Code via WhatsApp**
- **Descrição:** Disparar mensagem automática com voucher (PDF/Imagem com QR Code) quando `status_pagamento` mudar para `pago`.
- **Categoria:** Comunicação / Automação
- **Prioridade:** Média
- **Impacto Esperado:** Check-in mais rápido e menos dependência do app no dia do evento.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Reaproveitar infraestrutura de notificações (`disparar-alerta`) com novo gatilho.


### [ ] 41. **Envio opcional de push ao publicar comunicado**
- **Descrição:** Incluir toggle “Notificar usuários via App” para disparar notificações ao salvar comunicado urgente.
- **Categoria:** Comunicação / Automação
- **Prioridade:** Média
- **Impacto Esperado:** Alertas críticos chegam imediatamente.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Integrar com pipeline de notificações existente.


### [x] 42. **Ingressos variáveis por lote e categoria**
- **Descrição:** Evoluir de preço único para tabela `evento_lotes` (promo, normal, kids) com vigência por data.
- **Categoria:** Produto / Financeiro
- **Prioridade:** Média
- **Impacto Esperado:** Maior flexibilidade de receita e planejamento de caixa.
- **Esforço Estimado:** Médio
- **Status:** ✅ Concluído
- **Observações:** Tabela `evento_lotes` criada. `AdicionarInscricaoDialog` e `InscricoesTabContent` atualizados. Gerenciador de lotes na aba Inscrições.


### [ ] 43. **Lembrete automático de follow-up**
- **Descrição:** Criar Edge Function (`cron-follow-up-pastoral`) para notificar pastores sobre atendimentos em acompanhamento.
- **Categoria:** Automação / Comunicação
- **Prioridade:** Média
- **Impacto Esperado:** Melhor continuidade no cuidado pastoral.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Regras configuráveis (ex.: 7/15/30 dias).


### [ ] 44. **Plano de migração para quizzes em JSON**
- **Descrição:** Definir estratégia de versionamento/migração para a estrutura JSON dos quizzes.
- **Categoria:** Engenharia / Risco Técnico
- **Prioridade:** Média
- **Impacto Esperado:** Reduzir risco de inconsistência quando a estrutura evoluir.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Identificado como risco técnico na ADR-009.


### [ ] 45. **Status de “Treinando/Sombra” na escala**
- **Descrição:** Permitir escalar voluntários em `em_trilha` com tag visual de treinamento, sem contar como efetivo.
- **Categoria:** Produto / UX
- **Prioridade:** Média
- **Impacto Esperado:** Facilitar aprendizado prático em equipes como Mídia e Recepção.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Alinha com práticas do mercado (shadowing).


### [ ] 46. **Visualização mobile alternativa para Contas e Fornecedores**
- **Descrição:** Implementar visualização em lista/cards para tabelas de Contas e Fornecedores no mobile, reduzindo dependência de scroll horizontal.
- **Categoria:** UX / Mobile / Financeiro
- **Prioridade:** Média
- **Impacto Esperado:** Leitura mais rápida de saldos e contatos em telas pequenas.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Ajuste P1 de responsividade.


### [ ] 47. **Integração com letras/cifras**
- **Descrição:** Avaliar integração para exibição de letras de músicas e cifras no fluxo de liturgia.
- **Categoria:** Produto / Integração
- **Prioridade:** Média
- **Impacto Esperado:** Reduzir dependência de softwares externos no louvor.
- **Esforço Estimado:** Alto
- **Status:** Pendente
- **Observações:** Definir formato (PPT/ProPresenter/markdown).


### [ ] 48. **Ajuda de uso entre Projetos e Eventos**
- **Descrição:** Incluir texto/tooltip na tela de Projetos esclarecendo a diferença entre tarefas de projetos e tarefas de eventos.
- **Categoria:** UX / Comunicação
- **Prioridade:** Baixa
- **Impacto Esperado:** Reduzir confusão e direcionar o uso correto.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Mensagem curta na tela inicial de Projetos.


### [ ] 49. **Aviso sobre travamento de tipo de jornada**
- **Descrição:** Inserir aviso claro na UI sobre impossibilidade de alterar o tipo após criação (Curso/Processo/Híbrido).
- **Categoria:** UX / Comunicação
- **Prioridade:** Baixa
- **Impacto Esperado:** Reduzir frustração administrativa e tickets de suporte.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Decisão técnica aceita, mas precisa de comunicação explícita.


### [ ] 50. **Badge de tempo de serviço no perfil**
- **Descrição:** Exibir “Serve há X anos” no perfil do voluntário.
- **Categoria:** Produto / Engajamento
- **Prioridade:** Baixa
- **Impacto Esperado:** Valorizar voluntários antigos e dar contexto para líderes.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Gamificação simples e opcional.


### [ ] 51. **Botão “Ligar agora” no Kanban mobile**
- **Descrição:** Adicionar ação rápida no card para abrir discador/WhatsApp e registrar a ligação no histórico.
- **Categoria:** UX / Mobile
- **Prioridade:** Baixa
- **Impacto Esperado:** Agilidade no contato com o membro.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Registrar evento no `historico_evolucao`.


### [ ] 52. **Remover logs de teste RBAC do Dashboard**
- **Descrição:** Limpar o bloco `// --- INÍCIO DO BLOCO DE TESTE RBAC ---` e `console.table` em `Dashboard.tsx`.
- **Categoria:** Qualidade / Manutenção
- **Prioridade:** Baixa
- **Impacto Esperado:** Console limpo em produção.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Garantir que não haja logs de debug.


### [ ] 53. **Tags de humor no fechamento do atendimento**
- **Descrição:** Permitir seleção de emoji (😢 😐 🙂 😃) ao finalizar atendimento para gerar evolução emocional.
- **Categoria:** Produto / Dados
- **Prioridade:** Baixa
- **Impacto Esperado:** Visualizar tendência emocional ao longo do tempo.
- **Esforço Estimado:** Baixo
- **Status:** Pendente
- **Observações:** Exibir gráfico simples no prontuário.


### [ ] 54. **Reavaliar necessidade do stepper de publicação**
- **Descrição:** Avaliar a volta do `PublicacaoStepper.tsx` conforme o formulário de comunicados crescer.
- **Categoria:** UX
- **Prioridade:** Baixa
- **Impacto Esperado:** Melhorar clareza do fluxo com mais opções.
- **Esforço Estimado:** Médio
- **Status:** Pendente
- **Observações:** Pode ser aplicado pós-MVP.

---

## 🗂️ Sugestões futuras (em triagem)
- **Check-in Kids vinculado:** gerar etiquetas automaticamente ao inscrever famílias (vínculo pais/filhos).
- **Triagem espiritual automática:** validar pré-requisitos em eventos específicos.
- **Gestão de quartos (rooming list):** organização de hospedagem por quarto/ônibus.

---

## 📜 Histórico de Atualizações
- **2026-01-02** Inclusão do backlog de melhorias para o módulo de Eventos e Inscrições.
- **2026-01-02** Inclusão de pendências visuais e de usabilidade do módulo de Pessoas.
- **2026-01-02** Inclusão de pendências de responsividade no módulo Financeiro (DRE, Contas, Fornecedores).
- **2026-01-02** Inclusão de pendências do módulo de Intercessão (RLS, realtime, testes com usuários).
- **2026-01-02** Inclusão de pendências e riscos do módulo de Jornadas (analytics, comunicação, migração de quizzes).
- **2026-01-02** Inclusão de pendências operacionais e melhorias do módulo de Voluntariado.
- **2026-01-02** Inclusão de pendências do módulo de Gabinete Pastoral (notas, visão 360º, follow-up, usabilidade).
- **2026-01-02** Inclusão de pendências do módulo de Projetos (colaboração, notificações, UX).
- **2026-01-02** Inclusão de pendências do módulo de Check-ins (Kids, WhatsApp/Geo, financeiro).
- **2026-01-02** Inclusão de pendências do módulo de Liturgia (stage display, cache, integração).
- **2026-01-02** Inclusão do elo entre Relógio de Oração e Sala de Guerra.
- **2026-01-02** Inclusão de pendências do módulo de Comunicação (canais, push, UX).
- **2026-01-02** Inclusão de pendências de autenticação (refresh token, RBAC, expiração).
- **2026-01-02** Inclusão de pendências do módulo de Dashboards (logs, mobile, Pix).
- **2026-01-02** Inclusão de pendências mobile do módulo Financeiro (Tabs de Insights).
- **2026-01-02** Inclusão de pendências críticas de layout e navegação mobile (navbar).
- **2026-01-02** Inclusão de ajuste de layout para conteúdo com navbar mobile fixa.
- **2026-01-02** Reordenação por prioridade/complexidade e inclusão de checklists.
