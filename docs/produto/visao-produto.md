# Visão de Produto — Igreja Carvalho

> **Status:** v0.1 — rascunho de trabalho. _Escrito antes da consolidação dos docs (Passo 2)._
> **Revisar após** o Passo 2 da reorganização, quando o inventário real de módulos estiver fechado.
> **Data:** 2026-06-15 · **Autor:** dono do produto
> Convenções: **[fato]** = confirmado em código/rotas · **[a confirmar]** = inferido, validar no repo.
> Eixo deste documento: **estratégico** (o que faz alguém escolher e ficar). Não confundir com o mapa
> **estrutural** (`docs/modulos/`), que descreve o que existe por módulo/rota. Os dois eixos são ortogonais.

---

## 1. Por que existimos

Cuidar de pessoas. O sistema nasceu dentro de uma igreja real, que está crescendo e precisa de cuidado
de verdade — não de um cadastro estático. Os líderes e o time de campo precisam operar o cuidado no dia a
dia, com tudo o que já foi construído. Visão de reino antes de visão de mercado: se o sistema ajuda uma
comunidade a cuidar melhor das suas pessoas, ele cumpriu o propósito antes de vender qualquer licença.

Consequência prática (não só devocional): **nossa casa é o reference customer.** O produto é validado por
uso real, todo dia, pela igreja que o construiu.

## 2. O que o sistema é — escopo de plataforma — [fato]

Honestidade primeiro: já construímos uma plataforma ampla de gestão de igreja (ChMS completo), não um
nicho. Módulos reais, derivados das rotas (`src/App.tsx`):

Pessoas · Cuidado/Acompanhamento · Intercessão (oração, sentimentos, sala de guerra) · Cultos & Eventos
(liturgia, telão, check-in) · Escalas · Ensino & Jornadas · Kids · Voluntariado · Comunicação &
Notificações · Gabinete Pastoral · Financeiro completo · Cadastro Público · Recepção/Check-in ·
Superadmin multi-tenant.

Essa amplitude é **moat e retenção** — o motivo de uma igreja não querer sair depois de entrar. **Não é a
manchete.** Não vendemos amplitude; entregamos amplitude e vendemos profundidade (§3).

## 3. Como ganhamos — os três wedges

Onde lideramos de verdade. Não competimos em "ter o módulo X"; competimos em **operar melhor** o que importa.

### Wedge 1 — Operação do cuidado
Não "ter cadastro de pessoas", e sim garantir que **ninguém cai na rachadura**: distribuição do cuidado por
carga real (round-robin — `alocar_responsavel_acompanhamento`, `alocar_pedido_balanceado`), motor de ovelhas
em risco (`get_ovelhas_em_risco`), jornada/discipulado como pipeline com dono e SLA (não cadastro estático),
triagem assistida na entrada (`chatbot-triagem`). [fato]

**Exemplo-bandeira:** pedido de oração chega via WhatsApp → IA classifica (`analise-pedido-ia`) → roteia
balanceado pro time de intercessores → tudo dentro de casa. Um fluxo que combina os três wedges de uma vez.

### Wedge 2 — Operação financeira
Profundidade onde o incumbente tropeça em implantação: conciliação bancária baseada em eventos (ADR-028),
integração PIX/Santander/Getnet (`pix-webhook`, `santander-api`, `getnet-sftp`, `buscar-pix-cron`),
conferência cega / contagem dupla (ADR-023), DRE, fechamento de ofertas, sugestão de conciliação por ML
(`gerar-sugestoes-ml`). [fato] Tesouraria de igreja é dor real e pegajosa; quem resolve, retém.

### Wedge 3 — IA integrada que não vaza o rebanho
A IA roda **dentro** do sistema (`chatbot-triagem`, `analise-pedido-ia`, `analise-sentimento-ia`,
`gerar-sugestoes-ml`), com os dados em casa. Contraste direto com o que vimos o incumbente fazer em webinar:
exportar a lista de membros pra um agente externo. Sob a LGPD, convicção religiosa é **dado pessoal sensível**
(Art. 5º, II) — uma lista de membros é, por definição, uma lista de convicções religiosas. Mandar isso pra
fora é exposição. Nós respondemos as mesmas perguntas sem o dado sair. [fato — arquitetura existe]
_(Não é parecer jurídico; validar base legal e DPA.)_

## 4. Posicionamento (uma frase)

> Cuidado real, **integrado e dentro de casa** (sem vazar o rebanho), provado numa igreja que está
> crescendo — e ao alcance de igrejas que não podem pagar os incumbentes.

## 5. Em que NÃO competimos (disciplina)

- **Não brigamos de frente em amplitude** com InChurch/InPeace/FielWeb. Eles têm dezenas de milhares de
  igrejas e exército de dev; amplitude head-on é briga perdida.
- Amplitude é moat, **não** é a história de vendas.
- "Descobrimos que construímos muito" **não** é licença pra reposicionar como "fazemos tudo". É licença pra
  *curar* o que mantemos (§7, §8).

## 6. Distribuição e reference customer

- **Nossa casa, todo dia** — profundidade e verdade diária; mata scope creep (o uso real decide o que é
  núcleo vs. fino).
- **Coorte de igrejas pequenas (doação)** — visão de reino que também é estratégia: distribuição bottom-up
  que a implantação pesada dos incumbentes não alcança, e validação **multi-contexto** (antídoto ao over-fit
  de uma igreja só).
- **Guard-rail honesto:** hospedar membros de outras igrejas faz as obrigações de LGPD passarem a ser nossas
  (operador/controlador de dado sensível multi-tenant) e gera carga de suporte sobre uma pessoa. Fazer como
  coorte controlada, "as-is", com papéis de dados claros. Cuidar de pessoas inclui cuidar dos dados delas.

## 7. Classificação estratégica dos módulos

Eixo estratégico (≠ mapa estrutural de `docs/modulos/`). Três baldes:

| Balde | Módulos | Tratamento |
|---|---|---|
| **Wedge** (vende e diferencia) | Cuidado/Acompanhamento · Intercessão · Financeiro (conciliação/banco/PIX) · IA integrada | Aprofundar e destacar |
| **Núcleo** (table-stakes, retém) | Pessoas · Cultos & Eventos · Liturgia/Escalas · Comunicação · Kids · Voluntariado · Gabinete · Cadastro Público · Recepção | Manter sólido; não é manchete |
| **Fino / decidir** | Agenda · Bíblia · Perfil · Mídia · Projetos · Configurações | Aprofundar, depreciar ou manter quieto — caso a caso [a confirmar] |

## 8. Tensões honestas (não varrer pra baixo do tapete)

- **Dev solo + plataforma ampla = passivo de manutenção.** A superfície já construída é grande; cada módulo
  fino é custo recorrente.
- **Over-fit numa igreja só** — mitigado pela coorte de igrejas pequenas (§6).
- **Doação = responsabilidade de dados** — ver §6.
- **Dois wedges pesados (cuidado + financeiro) disputam o tempo do mesmo dev.** Sequenciar, não paralelizar.

## 9. Decisões em aberto e checkpoint

- [ ] Revisar esta visão **após o Passo 2** da consolidação de docs (inventário fechado pode mover módulos
  entre baldes). ← _Passo 2 concluído em 2026-06-15; revisar baldes §7._
- [ ] PROJETOS: real-sem-doc ou morto? (§7, balde fino) [a confirmar]
- [ ] Confirmar quais "finos" depreciar vs. aprofundar.
- [ ] Base legal/DPA da IA in-house e da hospedagem multi-igreja (§3, §6).

> **Registro de decisões** (anotar cada virada: data, decisão, motivo, alternativa rejeitada — como nos ADRs):
> - _(2026-06-15)_ Adotados três wedges (cuidado · financeiro · IA integrada). **Rejeitado:** wedge único de
>   cuidado — subclassificava o financeiro já construído.
> - _(2026-06-15)_ Mantida a disciplina de não competir em amplitude; amplitude tratada como moat, não manchete.
