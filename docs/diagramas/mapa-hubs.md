# Mapa de Hubs (Visão Macro)

```mermaid
flowchart TD
  %% Hubs principais
  Notificacoes[Hub Notificações]\n(Alertas sistêmicos)
  Comunicacao[Hub Comunicação]\n(Banners, mídias, mural)
  CultosLiturgia[Hub Cultos & Liturgia]\n(Liturgia, telão, templates)
  Eventos[Hub Eventos]\n(Agenda, conferências)
  Voluntariado[Hub Voluntariado]\n(Escalas, times)
  Pessoas[Hub Pessoas]\n(Membros, visitantes, famílias)
  Pastoral[Hub Pastoral]\n(Gabinete, cuidado)
  Intercessao[Hub Intercessão]\n(Pedidos, testemunhos)
  Ensino[Hub Ensino/Discipulado]\n(Jornadas, cursos)
  Kids[Hub Kids]\n(Check-in, turmas)
  Financas[Hub Finanças]\n(Contas, DRE)

  %% Integrações entre hubs
  Eventos --> Comunicacao
  Eventos --> Notificacoes
  Eventos --> CultosLiturgia

  CultosLiturgia --> Comunicacao
  CultosLiturgia --> Voluntariado

  Voluntariado --> Pessoas
  Voluntariado --> Notificacoes

  Pessoas --> Pastoral
  Pessoas --> Intercessao
  Pessoas --> Ensino
  Pessoas --> Financas

  Pastoral --> Intercessao
  Pastoral --> Notificacoes

  Intercessao --> Notificacoes

  Ensino --> Comunicacao
  Ensino --> Financas

  Kids --> Pessoas
  Kids --> Notificacoes
  Kids --> Comunicacao

  Financas --> Pessoas

  %% Ajustes visuais
  classDef hub fill:#EEF2FF,stroke:#4F46E5,color:#111827,stroke-width:1px;
  class Notificacoes,Comunicacao,CultosLiturgia,Eventos,Voluntariado,Pessoas,Pastoral,Intercessao,Ensino,Kids,Financas hub;
```
