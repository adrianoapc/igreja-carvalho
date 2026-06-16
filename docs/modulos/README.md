# Módulos do Sistema

Mapa canônico dos 21 módulos. Cada subpasta contém docs vivos do módulo.

## Módulos com subpasta

| Módulo | Pasta | Rotas principais |
|---|---|---|
| Pessoas | [pessoas/](pessoas/) | `/pessoas`, `/pessoas/contatos`, `/cadastro/visitante` |
| Kids / Infantil | [kids/](kids/) | `/kids`, `/recepcao/infantil` |
| Cultos | — | `/cultos`, `/cultos/:id` |
| Escalas | — | `/escalas` |
| Ensino / Jornadas | — | `/ensino`, `/ensino/:id`, `/jornadas` |
| Cuidado Pastoral | [cuidado/](cuidado/) | (a confirmar — ver memorial) |
| Intercessão | [intercessao/](intercessao/) | `/intercessao`, `/relogio-oracao` |
| Comunicação | — | `/comunicados`, `/publicacao` |
| Financeiro — core | [financeiro/core/](financeiro/core/) | `/financeiro`, `/transacoes` |
| Financeiro — ofertas | [financeiro/ofertas-contagem/](financeiro/ofertas-contagem/) | `/ofertas`, `/contagem` |
| Financeiro — integrações | [financeiro/integracoes-bancarias/](financeiro/integracoes-bancarias/) | `/integracoes-bancarias` |
| Financeiro — reembolsos | [financeiro/reembolsos/](financeiro/reembolsos/) | `/reembolsos` |
| Voluntariado | [voluntariado/](voluntariado/) | `/voluntariado`, `/voluntariado/candidatos` |
| Eventos | — | `/eventos`, `/eventos/:id` |
| Agenda | — | `/agenda` |
| Projetos | [projetos/](projetos/) | `/projetos`, `/projetos/:id`, `/projetos/backlog` |
| SuperAdmin | [superadmin/](superadmin/) | `/superadmin` |
| Recepcao | — | `/recepcao` |
| Mídia | — | (a confirmar) |
| Bíblia | — | (a confirmar) |
| Configurações | — | `/configuracoes` |

## Módulos sem subpasta (finos)

- **Agenda** — calendário de eventos; sem doc específico ainda
- **Bíblia** — leitor de passagens; sem doc específico ainda
- **Mídia** — galeria/uploads; sem doc específico ainda

## Relacionamentos entre módulos

- Motor de jornadas (ensino) é compartilhado pelo módulo **Cuidado** (triagem/pipeline pastoral)
- Sentimentos IA conecta **Intercessão** ↔ **Cuidado** ↔ **Pessoas**
- PIX webhook alimenta **Financeiro / ofertas** via `pix_webhook_temp`
- Voluntariado pipeline usa eventos de **Ensino** (trilhas de formação)
