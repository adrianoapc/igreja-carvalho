# 📘 Produto – Sistema Financeiro da Igreja

Este produto organiza **gastos, pagamentos e relatórios financeiros** da igreja,
garantindo **transparência, governança e clareza** para liderança, conselho e tesouraria.

## Princípio Central
A forma como pagamos **não altera** o motivo pelo qual gastamos.

## Estrutura do Sistema
1. Registro do Gasto (Fato Gerador)
2. Aprovação e Pagamento (Fluxo de Caixa)
3. Conciliação Bancária
4. Relatórios e DRE

📎 Diagramas disponíveis em `docs/diagramas/`.

---

## Pessoas / Membros (visão de produto)

- **Problema que resolve**: reduz a dispersão de cadastros e a falta de visibilidade sobre quem é visitante, frequentador ou membro, trazendo visão unificada de pessoas, família e participação.
- **Objetivo**: entregar uma base única e confiável de pessoas, fácil de buscar, filtrar e manter atualizada, apoiando decisões pastorais e operacionais.
- **Para quem**: secretaria (cadastro e atualização), liderança/pastores (acompanhamento e ações pastorais), tesouraria/financeiro (cruzar presença com compromissos), times de ministérios (voluntários e funções).
- **Principais capacidades**: listar e buscar pessoas (status, nome, contato), cadastrar/editar perfis completos, acompanhar evolução de status (visitante → membro), visualizar vínculos familiares, atribuir funções/roles ministeriais e disponibilizar ações rápidas e estatísticas da base.
- **Limites do escopo**: não é ferramenta de check-in Kids (apenas referencia vínculos), não faz gestão financeira, não substitui controle detalhado de voluntários por escala, não automatiza follow-up pastoral (apenas suporta dados para isso).

## Kids (visão de produto)

- **Objetivo**: apoiar o ministério infantil no acolhimento seguro das crianças durante cultos e atividades, com foco em organização de turmas, controle de presença e comunicação responsável.
- **Para quem**: líderes e voluntários do Ministério Kids (gestão de salas e turmas, check-in/checkout), pais/responsáveis (autorização e retirada), secretaria (cadastro e atualizações), liderança (visão geral e alertas).
- **Principais capacidades**: 
	- cadastro e gestão de crianças e turmas;
	- autorizações de responsáveis para retirada;
	- registro de presença (check-in/checkout) e diário/observações;
	- notificações sobre eventos relevantes do Kids (ex.: checkout, diário, alertas).
- **Limites do escopo**: não é sistema pedagógico completo (planejamento de aulas/competências), não substitui controle financeiro, não faz comunicação externa massiva (apenas notificações internas vinculadas ao Kids), não gerencia conteúdo educacional.

Referências de produto e fluxos detalhados:
- Inclusão de crianças e regras: `../KIDS_INCLUSION.md`
- Notificações do Kids: `../NOTIFICACOES_KIDS.md`
- Responsáveis autorizados: `../AUTHORIZED_GUARDIANS.md`

## Comunicação (visão de produto)

- **Objetivo**: facilitar a criação e publicação de comunicados institucionais (avisos, banners, alertas) de forma manual e editorial pela liderança, garantindo visibilidade multiplataforma (app, telão/projetor, site público).
- **Para quem**: liderança/secretaria (criação de conteúdo), equipe de comunicação (arte e publicação), administradores (gestão de canais de exibição), membros (consumo no app/site).
- **Principais capacidades**: 
	- criar comunicados manualmente (tipo banner ou alerta), com título, descrição, imagem e link de ação;
	- segmentar publicação por canal (exibir no app, telão/projetor ou site);
	- agendar período de exibição (data início/fim);
	- vincular opcionalmente a cultos ou mídias;
	- organizar por tags e ordem de exibição no telão;
	- histórico completo de comunicados criados e status (ativo/inativo).
- **Limites do escopo**: NÃO faz disparo automático de push notifications, e-mail ou WhatsApp; NÃO substitui notificações de sistema (que são automáticas e vinculadas a eventos); apenas publica conteúdo editorial gerenciado manualmente; não é ferramenta de automação de marketing ou CRM.

Referências complementares:
- Manual do usuário — Comunicação: `../manual-usuario.md` (seção 9)

## Notificações (visão de produto)

- **Objetivo**: automatizar o envio de alertas relevantes para usuários específicos (por cargo/role) baseado em eventos do sistema, reduzindo dependência de comunicação manual e aumentando a agilidade nas respostas operacionais.
- **Para quem**: administradores (configuração de regras de disparo e canais), líderes e responsáveis por áreas (recebem notificações personalizadas conforme seu cargo), equipe técnica (gestão de eventos e integrações).
- **Principais capacidades**: 
	- catálogo de eventos do sistema (ex: `novo_visitante`, `financeiro_conta_vencer`, `kids_checkin`, `kids_ocorrencia`, `pedido_oracao`);
	- configuração de regras por evento (quem recebe: role ou usuário específico, canais ativos: in-app/push/WhatsApp);
	- disparo automático via Edge Function (`disparar-alerta`) ao detectar evento;
	- entrega multi-canal: notificação in-app (sininho na barra superior), push notification (browser API), WhatsApp (Meta API direto ou Make);
	- histórico de envio e status (lido/não lido) na tabela `notifications`;
	- interface admin para ativar/desativar regras e canais por evento.
- **Limites do escopo**: NÃO é criação manual de mensagens (isso é Comunicação); NÃO permite editar conteúdo da notificação (usa templates automáticos); NÃO substitui comunicação editorial ou avisos gerais; apenas dispara alertas baseados em eventos reais do sistema; não faz segmentação arbitrária ou campanhas de marketing.

Referências complementares:
- Manual do usuário — Notificações: `../manual-usuario.md` (seção 10, a confirmar)

## Jornadas e Ensino (visão de produto)

- **Objetivo**: estruturar trilhas de formação (jornadas/cursos) e o dia a dia de aulas/presenças, oferecendo ao aluno um player simples e ao time de ensino ferramentas de controle.
- **Para quem**: líderes/discipuladores e secretaria (criam jornadas, etapas e matrículas), professores/voluntários (agendam aulas, registram presença), alunos/membros (consomem conteúdo e acompanham progresso), pais/responsáveis no Kids (check-in/check-out e etiquetas).
- **Principais capacidades**:
	- criar e editar jornadas com etapas sequenciais (vídeo, texto, presencial);
	- matricular alunos (manual ou autoinscrição), acompanhar progresso e responsáveis;
	- player para o aluno marcar etapas concluídas e continuar de onde parou;
	- gestão de aulas: sala, modalidade, professor, datas e presenças;
	- check-in manual e impressão de etiquetas de segurança para Kids (quando aplicável);
	- cursos pagos: flag de pagamento, valor e bloqueio de acesso até confirmação financeira.
- **Limites do escopo**: não é LMS completo de avaliações/provas; não gera certificados automaticamente (a confirmar); integrações de pagamento no app do aluno não estão presentes (baixa ocorre no financeiro); comunicação editorial deve usar o módulo Comunicação.

Referências:
- Funcionalidades — Jornadas e Ensino: `../funcionalidades.md#5-jornadas-e-ensino`
- Manual do usuário — Jornadas e Ensino: `../manual-usuario.md#7-jornadas-e-ensino`
- Diagrama de cursos pagos: `../diagramas/fluxo-cursos-pagos.md`
 - Diagramas gerais do módulo: `../diagramas/fluxo-ensino.md`, `../diagramas/sequencia-ensino.md`
 - Arquitetura (visão técnica): `../01-Arquitetura/01-arquitetura-geral.MD#módulo-jornadas-e-ensino-visão-técnica`

