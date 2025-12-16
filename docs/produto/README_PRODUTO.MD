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
