# Fluxo – Ministério Kids

Este fluxo descreve, em alto nível, como o Ministério Kids funciona do ponto de vista do processo: cadastro/gestão de informações da criança (incluindo inclusão/necessidades especiais, quando aplicável), configuração de responsáveis autorizados para retirada e os pontos em que notificações são disparadas para os responsáveis.

```mermaid
flowchart TD
  A[Início: Acessa Ministério Kids] --> B{Necessita cadastrar/atualizar dados da criança?}
  B -- Sim --> C[Cadastro/Edição de Criança<br/>(Familia/Dependente)<br/>• Nome e dados básicos<br/>• Alergias (opcional)<br/>• Inclusão/necessidades especiais (opcional)]
  C --> D[Dados salvos no perfil da criança]
  B -- Não --> E[Vincular Responsáveis Autorizados]
  D --> E[Vincular Responsáveis Autorizados]

  subgraph AUT[Autorizações]
    E --> E1[Buscar pessoa a autorizar]
    E1 --> E2[Confirmar parentesco]
    E2 --> E3[Selecionar crianças permitidas]
    E3 --> E4[Salvar autorização]
  end

  E4 --> F{Durante a atividade Kids}
  F --> G[Registrar Diário/Observações da Criança]
  F --> H[Realizar Check-out da Criança]

  %% Notificações
  G --> N1[/Dispara notificação: Diário do Kids atualizado\n(Destinatário: responsável)/]
  H --> N2[/Dispara notificação: Check-out confirmado\n(Destinatário: responsável)/]

  %% Fim
  N1 --> Z[Fim]
  N2 --> Z
```

Referências detalhadas:
- Inclusão (necessidades especiais) e campos: [../KIDS_INCLUSION.md](../KIDS_INCLUSION.md)
- Responsáveis autorizados (fluxo passo a passo): [../AUTHORIZED_GUARDIANS.md](../AUTHORIZED_GUARDIANS.md)
- Notificações (diário e checkout): [../NOTIFICACOES_KIDS.md](../NOTIFICACOES_KIDS.md)
