import { lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";

const ReviewCheckinInscricao = lazy(() => import("./CheckinInscricao"));
const ReviewEventosLegacy = lazy(() => import("./Eventos"));
const ReviewIndexLegacy = lazy(() => import("./Index"));
const ReviewJornadasLegacy = lazy(() => import("./Jornadas"));
const ReviewWhatsAppNumeros = lazy(() => import("./admin/WhatsAppNumeros"));
const ReviewFiliais = lazy(() => import("./configuracoes/Filiais"));
const ReviewAgendaPublica = lazy(() => import("./eventos/AgendaPublica"));
const ReviewContasManutencao = lazy(
  () => import("./financas/ContasManutencao"),
);
const ReviewIntegracoes = lazy(() => import("./financas/Integracoes"));
const ReviewPixRecebido = lazy(() => import("./financas/PixRecebido"));
const ReviewSessaoLancamentos = lazy(
  () => import("./financas/SessaoLancamentos"),
);
const ReviewVoluntarioCandidatos = lazy(
  () => import("./voluntario/Candidatos"),
);

const candidates = {
  "checkin-inscricao": {
    title: "Checkin Inscrição",
    component: ReviewCheckinInscricao,
  },
  "eventos-legado": {
    title: "Eventos (legado)",
    component: ReviewEventosLegacy,
  },
  "index-legado": {
    title: "Index (legado)",
    component: ReviewIndexLegacy,
  },
  "jornadas-legado": {
    title: "Jornadas (legado)",
    component: ReviewJornadasLegacy,
  },
  "whatsapp-numeros": {
    title: "WhatsApp Números",
    component: ReviewWhatsAppNumeros,
  },
  filiais: {
    title: "Configurações > Filiais",
    component: ReviewFiliais,
  },
  "agenda-publica": {
    title: "Agenda Pública",
    component: ReviewAgendaPublica,
  },
  "contas-manutencao": {
    title: "Finanças > Contas (Manutenção)",
    component: ReviewContasManutencao,
  },
  "financas-integracoes": {
    title: "Finanças > Integrações",
    component: ReviewIntegracoes,
  },
  "pix-recebido": {
    title: "Finanças > Pix Recebido",
    component: ReviewPixRecebido,
  },
  "sessao-lancamentos": {
    title: "Finanças > Sessão de Lançamentos",
    component: ReviewSessaoLancamentos,
  },
  "voluntario-candidatos": {
    title: "Voluntário > Candidatos (legado)",
    component: ReviewVoluntarioCandidatos,
  },
} as const;

type CandidateKey = keyof typeof candidates;

export default function ReviewPage() {
  const { slug } = useParams();
  const key = slug as CandidateKey | undefined;
  const candidate = key ? candidates[key] : undefined;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Revisão de Telas
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Use esta rota temporária para validar telas candidatas à remoção.
        </p>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Acesse uma tela específica:
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(candidates).map(([candidateKey, info]) => (
            <Link
              key={candidateKey}
              to={`/revisao/${candidateKey}`}
              className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
            >
              {info.title}
            </Link>
          ))}
        </div>
      </div>

      {!candidate && slug && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Tela não encontrada para revisão: {slug}
        </div>
      )}

      {!slug && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Selecione uma tela acima ou acesse direto em /revisao/&lt;slug&gt;.
        </div>
      )}

      {candidate && (
        <div className="rounded-md border bg-background">
          <div className="border-b px-4 py-2 text-sm text-muted-foreground">
            Visualizando: {candidate.title}
          </div>
          <div className="p-4">
            <Suspense
              fallback={
                <div className="text-sm text-muted-foreground">Carregando…</div>
              }
            >
              <candidate.component />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
