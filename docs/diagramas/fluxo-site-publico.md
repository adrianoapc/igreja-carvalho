# Fluxo do Site Público (Landing Page)

Representa a arquitetura do site institucional público acessível sem autenticação em `igrejacarvalho.com.br`. O conteúdo é alimentado pelas views `eventos_publicos` e `comunicados_publicos` no Supabase, controladas pelo painel admin. Redes sociais (YouTube e Instagram) são integradas via APIs externas.

Baseado nos componentes `src/pages/public/`, `src/components/public/`, migrações `20260622*` e hooks `useEventosPublicos`, `useYoutubeVideos`.

```mermaid
flowchart TD
    Visitante([Visitante acessa site]) --> PublicLayout[PublicLayout\nHeader + Footer + CookieBanner]

    PublicLayout --> Route{Rota}

    Route -->|/| Home[PublicHome\nLanding Page]
    Route -->|/agenda| Agenda[PublicAgenda\nGrade de Eventos]
    Route -->|/mensagens| Mensagens[PublicMensagens\nVídeos YouTube]
    Route -->|/oracao| Oracao[PublicOracao\nFormulário LGPD]
    Route -->|/contato| Contato[PublicContato\nMapa + Dados]
    Route -->|/privacidade| Privacidade[Privacidade\nPolítica LGPD]

    %% Home sections
    Home --> Carousel[PublicBannerCarousel\ncomunicados_publicos\ntipo=banner, exibir_site=true]
    Home --> Eventos[Seção Próximos Eventos\neventos_publicos\npublicados + futuros]
    Home --> Instagram[InstagramSection\nBehold.so widget\nVITE_BEHOLD_WIDGET_ID]
    Home --> OracaoCard[CTA Pedido de Oração]
    Home --> ContatoSection[ContatoSection\nMapa + Horários]

    %% Agenda
    Agenda --> EventosQuery[useEventosPublicos\nSELECT eventos_publicos\nORDER BY data_evento]
    EventosQuery --> RLS_Eventos{eventos.publicar_no_site\n= true?}
    RLS_Eventos -->|Sim| EventoCard[EventoCard]
    RLS_Eventos -->|Não| Hidden[Oculto]

    %% Mensagens
    Mensagens --> YTHook[useYoutubeVideos\nYouTube Data API v3\nplaylistItems uploads]
    YTHook --> EnvYT{VITE_YOUTUBE_API_KEY\nconfigurado?}
    EnvYT -->|Sim| VideoGrid[Grid de vídeos]
    EnvYT -->|Não| Placeholder[Placeholder configuração]

    %% Oração
    Oracao --> Turnstile[Cloudflare Turnstile\nanti-spam]
    Oracao --> ConsentLGPD[Consentimento obrigatório\nLGPD]
    ConsentLGPD --> EdgeFn[Edge Function\nreceber-pedido-make\nvalida + armazena]
    EdgeFn --> DB_Oracao[(pedidos_oracao\nexpurgo 12 meses)]

    %% Comunicados → banners
    Admin([Admin logado]) --> EventoDialog[EventoDialog\ntoggle publicar_no_site]
    EventoDialog --> DB_Eventos[(eventos)]
    Admin --> PublicacaoStepper[PublicacaoStepper\nexibir_site = true]
    PublicacaoStepper --> DB_Comunicados[(comunicados\ntipo=banner)]

    DB_Eventos --> View_Eventos[(VIEW\neventos_publicos)]
    DB_Comunicados --> View_Banners[(VIEW\ncomunicados_publicos)]

    View_Eventos --> EventosQuery
    View_Banners --> Carousel

    %% Cookie consent
    ContatoSection --> CookieGate{Cookie\nconsentido?}
    CookieGate -->|Sim| MapIframe[Google Maps iframe]
    CookieGate -->|Não| MapFallback[Link externo Maps\nsem cookies]
```

## Variáveis de ambiente necessárias

| Variável | Obrigatória | Uso |
|---|---|---|
| `VITE_YOUTUBE_API_KEY` | Não | Busca vídeos do canal na página /mensagens |
| `VITE_YOUTUBE_CHANNEL_ID` | Não | ID do canal (ex: `UCxxxxxxx`) |
| `VITE_BEHOLD_WIDGET_ID` | Não | Feed do Instagram na Home |
| `VITE_TURNSTILE_SITE_KEY` | Recomendado | Anti-spam no formulário de oração |

## Como publicar conteúdo

- **Banners/Carrossel**: Comunicação → Nova Publicação → tipo Banner → ativar "Exibir no site"
- **Eventos na Agenda**: Eventos → editar evento → ativar "🌐 Publicar na agenda do site"
