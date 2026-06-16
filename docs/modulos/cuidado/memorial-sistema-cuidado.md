# Memorial do sistema – domínio de cuidado e acompanhamento

> Documento de reavaliação. Consolida o que existe, o que é suposição, os gaps e as
> oportunidades do núcleo de cuidado (assimilação, acompanhamento, discipulado, ovelhas em risco).
> Convenções: **[fato]** = confirmado em conversa/código; **[suposição]** = inferido, validar;
> **[a preencher]** = fora da minha visibilidade, completar com o código real.

---

## 1. Propósito

Ter uma visão única do núcleo de cuidado para decidir, com calma, três coisas:
o **modelo de jornada** a adotar, os **gaps** a fechar e as **oportunidades** de diferenciação
frente aos players brasileiros. Não é documentação de API; é base de decisão de produto e arquitetura.

---

## 2. Tese de produto

Encontrar formas de competir em amplitude (app, site, financeiro, streaming, kids, totem) com incumbentes que já
têm dezenas de milhares de igrejas. Queremos liderar na **camada de operação do cuidado**: quem cuida de
quem, com a carga equilibrada, e com cobrança de que o cuidado realmente aconteça. COm uso de agentes de IA, integração inteligente entre sistemas e dashboards premium de gestao inteligente de igrejas e cuidado real de pessoas.

Posicionamento de uma frase: _não somos mais um app de igreja; somos a camada de inteligência de
acompanhamento e discipulado – o sistema que garante que ninguém se perca no processo._

---

## 3. Arquitetura do domínio de cuidado

### Entidades (modelo de dados)

| Entidade                                    | Papel                                                                                                     | Status                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `profiles`                                  | Pessoa (visitante/membro), com `status`, `aceitou_jesus`, `numero_visitas`, `igreja_id`, `filial_id`      | [fato]                             |
| `jornadas`                                  | Definição de um pipeline (kanban). Recebe `gatilho_automatico` (`novo_visitante` / `aceitou_jesus`)       | [fato] (gatilho = migration nova)  |
| `etapas_jornada`                            | Etapas de cada jornada, com `ordem`                                                                       | [fato]                             |
| `inscricoes_jornada`                        | Pessoa dentro de uma jornada: `etapa_atual_id`, `responsavel_id`, `concluido`, `created_at`, `updated_at` | [fato] / `updated_at` [suposição]  |
| `times`, `membros_time`, `categorias_times` | Equipes por categoria; categoria **"Acompanhamento"** alimenta o round-robin                              | [fato] (categoria = seed novo)     |
| `visitante_contatos`                        | Lembrete de contato pós-cadastro (`membro_responsavel_id`)                                                | [fato], schema exato [a preencher] |
| `pedidos_oracao`                            | Pedidos de oração; já usam alocação balanceada (`alocar_pedido_balanceado`)                               | [fato]                             |
| `presencas_culto`                           | Presença em cultos; base do risco por ausência                                                            | [fato]                             |
| `sentimentos_membros`                       | Auto-registro de sentimento; base do risco por sentimento                                                 | [fato]                             |

### Funções / serviços

| Função                              | Papel                                                                     | Status                           |
| ----------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `alocar_pedido_balanceado`          | Round-robin de pedidos de oração por carga                                | [fato]                           |
| `alocar_responsavel_acompanhamento` | Round-robin de inscrições por carga, via time "Acompanhamento"            | [fato] (planejada)               |
| `cadastro-publico` (edge fn)        | Cria visitante, agenda contato, auto-inscreve em jornadas                 | [fato]                           |
| `get_ovelhas_em_risco`              | Lista ovelhas em risco (ausência, sentimento, + sinais de acompanhamento) | [fato], estendida nesta conversa |
| Função de notificações              | Envio de notificações/avisos                                              | [a preencher] – não vista        |

---

## 4. Fluxos-chave

### 4.1 Cadastro público → jornada → responsável

1. Visitante preenche o link público; `cadastro-publico` cria/atualiza `profiles`.
2. Toda pessoa nova entra na jornada de gatilho `novo_visitante`.
3. Quem marca `aceitou_jesus` (no cadastro ou em visita posterior, 1ª vez) entra também na de `aceitou_jesus`.
4. Cada inscrição resolve o `responsavel_id` por round-robin balanceado (time "Acompanhamento").
5. Pastor/líder vê no board da jornada com o filtro "Minhas".

Nuance conhecida: as duas inscrições passam pelo round-robin em sequência; a 1ª já conta como carga
na 2ª chamada, então os responsáveis tendem a ser pessoas diferentes. [fato]

### 4.2 Ovelhas em risco (motor de "rachadura")

Função única que agrega motivos de risco por pessoa (várias linhas por pessoa são esperadas):
ausência (21d+), sentimento difícil (7d), visitante sem contato, jornada parada, inscrição sem
responsável, decisão sem discipulado. Hoje é **pull** (alguém abre a tela). [fato]

### 4.3 Handoff contato → discipulado _(decisão em aberto – ver §5)_

Alternativa ao auto-inscrever: a conclusão do contato (card numa etapa terminal) abre o discipulado
e fecha o contato. Mais fiel ao processo real, menos jornadas órfãs. [suposição de design]

---

## 5. Decisão em aberto: modelo de jornada

Três modelos defensáveis; escolher um e registrar o porquê.

| Modelo                    | Como funciona                          | Prós                                 | Contras                                                |
| ------------------------- | -------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| Paralelo (plano atual)    | Duas jornadas auto-criadas no cadastro | Simples; visibilidade imediata       | Abre discipulado sem confirmação; jornadas redundantes |
| Handoff (estilo Rock RMS) | Contato fecha e dispara o discipulado  | Fiel ao processo; sem órfãs          | Depende de alguém concluir o contato                   |
| Funil único (padrão BR)   | "Decisão" é uma etapa do mesmo kanban  | Familiar a quem usa InChurch/InPeace | Perde separação contato ↔ discipulado                  |

Recomendação para avaliar: meio-termo – `aceitou_jesus` como sinal/tag desde o cadastro (não perde
ninguém), mas **materializar** a inscrição de discipulado no handoff.

---

## 6. Posicionamento competitivo

Leitura baseada em material público (marketing, reclamações) – tratar como hipótese a validar.

- **InChurch**: líder em amplitude (escala de dezenas de milhares de igrejas, app/site/financeiro/streaming). Admite no próprio material a dificuldade de acompanhar pessoas individualmente. Reclamações de implantação pesada e de pedidos de discipulado não atendidos.
- **InPeace**: "Jornada de Pessoas" como funil único; decisão é etapa.
- **FielWeb**: kanban do primeiro contato ao batismo; vende agentes de IA; cita jornadas de discipulado à parte.
- **Prover / Zeke**: foco em células; "aceitou Jesus" como campo/marco.

### Quatro pilares para liderar

| Dimensão                 | Mercado hoje                          | Onde liderar                                     |
| ------------------------ | ------------------------------------- | ------------------------------------------------ |
| Distribuição do cuidado  | Atribuição manual                     | Round-robin por carga real                       |
| Ninguém cai na rachadura | Acompanhamento individual ainda falha | Motor de SLA: parado / órfão / sem contato       |
| Triagem inicial          | Etapas manuais; IA genérica           | IA roteia por bairro/idade/perfil + sugere passo |
| Discipulado              | Campo "discipulador" + células        | Pipeline com dono, handoff e métricas            |

Maior brecha: "ninguém cai na rachadura" – o incumbente concede a dor publicamente.

Estratégia a considerar: ser **complementar** (integrar com InChurch puxando cadastros e devolvendo
status) em vez de substituto – reduz barreira de entrada e foge da dor de migração.

---

## 7. Gaps identificados

1. **Notificação é pull, não push.** O motor de ovelhas existe, mas ninguém é avisado proativamente. Falta o agregado por responsável virar notificação. [fato]
2. **`jornada_parada` usa `updated_at` como proxy.** Sem um carimbo de "entrou na etapa atual", há ruído. Falta `etapa_desde` (trigger ao mudar `etapa_atual_id`). [suposição]
3. **Escopo multi-igreja em `get_ovelhas_em_risco`.** Função `SECURITY DEFINER` sem filtro de igreja/filial – risco de vazar ovelhas entre igrejas se a RLS não cobrir. [fato]
4. **Sem unicidade de gatilho.** Duas jornadas com o mesmo `gatilho_automatico`: a edge function pega a primeira. Aceitável em v1, registrar. [fato]
5. **Modelo de jornada indefinido.** Paralelo ↔ handoff ↔ funil único ainda não decidido (§5). [fato]
6. **Métricas de funil ausentes.** Não há tempo até 1º contato, taxa visitante→batismo, retenção por responsável. [suposição]
7. **Triagem por IA ainda conceitual.** Roteamento por bairro/idade/perfil mencionado, não implementado. [suposição]
8. **Fonte de "contato realizado" frágil.** Depende do schema de `visitante_contatos` (não visto). [a preencher]

---

## 8. Oportunidades / roadmap candidato

Ordem sugerida por (impacto na tese × esforço).

1. **Push do motor de ovelhas** – agregar `get_ovelhas_em_risco` por responsável e disparar pela função de notificações existente. Alto impacto, baixo esforço. Encosta direto na maior brecha.
2. **Carimbo `etapa_desde`** – trigger simples; melhora o motor inteiro de "parado".
3. **Decidir o modelo de jornada** – destrava migration e edge function definitivas.
4. **Métricas de funil** – dashboard de conversão e tempo de resposta por responsável/equipe.
5. **Triagem por IA** – roteamento inteligente na entrada (a especificar).
6. **Integração com InChurch** – avaliar como wedge de entrada.

---

## 9. Itens a validar / preencher (próxima passada)

- [a preencher] Schema real de `inscricoes_jornada` (existe `updated_at`? há histórico de etapa?).
- [a preencher] Schema de `visitante_contatos` (como marcar "contato realizado").
- [a preencher] A função de notificações: assinatura, canais (push/WhatsApp/e-mail), gatilhos.
- [a preencher] RLS atual sobre as tabelas do domínio (resolve o escopo multi-igreja?).
- [a preencher] Demais módulos do sistema (financeiro, eventos, kids, células, comunicação) – fora do escopo desta passada.
- [validar] Toda a coluna "Mercado hoje" da §6 (material público, não auditoria técnica).

---

## 10. Histórico de decisões

> Registrar aqui cada decisão à medida que for tomada (data, decisão, motivo).

- _(em aberto)_ Modelo de jornada: paralelo / handoff / funil único.
- _(em aberto)_ Escopo de igreja em `get_ovelhas_em_risco`.
- _(em aberto)_ Estratégia: substituto ↔ complementar aos incumbentes.
