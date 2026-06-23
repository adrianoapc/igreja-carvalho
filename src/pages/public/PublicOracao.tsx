import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos do Turnstile (API Cloudflare injetada via script) ─────────────────
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove:  (widgetId: string) => void;
      reset:   (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// ─── Tipos do formulário ─────────────────────────────────────────────────────
type FormState = "idle" | "loading" | "success" | "error";

// ─── Componente ──────────────────────────────────────────────────────────────
export default function PublicOracao() {
  const [nome, setNome]               = useState("");
  const [anonimo, setAnonimo]         = useState(false);
  const [mensagem, setMensagem]       = useState("");
  const [contato, setContato]         = useState("");
  const [confidencial, setConfidencial] = useState(false);
  const [consentimento, setConsentimento] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [formState, setFormState]     = useState<FormState>("idle");
  const [errorMsg, setErrorMsg]       = useState("");

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId     = useRef<string | null>(null);

  // ── Carregar widget Turnstile ─────────────────────────────────────────────
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return; // chave não configurada em dev

    const scriptId = "cf-turnstile-script";

    function renderWidget() {
      if (!turnstileContainerRef.current || !window.turnstile) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey:           TURNSTILE_SITE_KEY,
        callback:          (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback":  () => setTurnstileToken(""),
        theme:             "light",
        action:            "oracao",
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id    = scriptId;
      script.src   = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      document.getElementById(scriptId)!.addEventListener("load", renderWidget);
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!consentimento || formState === "loading") return;

    setFormState("loading");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("receber-pedido-make", {
        body: {
          mensagem:           mensagem.trim(),
          nome:               anonimo ? undefined : nome.trim() || undefined,
          anonimo,
          contato:            anonimo ? undefined : contato.trim() || undefined,
          confidencial,
          consentimento:      true,
          cf_turnstile_token: turnstileToken || "dev-bypass",
          website:            "", // honeypot: sempre vazio no código legítimo
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro desconhecido.");

      setFormState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.";
      setErrorMsg(msg);
      setFormState("error");

      // Reseta Turnstile para permitir nova tentativa
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken("");
      }
    }
  }, [mensagem, nome, anonimo, contato, confidencial, consentimento, turnstileToken, formState]);

  const canSubmit =
    mensagem.trim().length >= 10 &&
    consentimento &&
    (!!turnstileToken || !TURNSTILE_SITE_KEY) && // dev sem chave passa direto
    formState !== "loading";

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (formState === "success") {
    return (
      <>
        <Seo
          title="Pedido de Oração"
          description="Envie seu pedido de oração para a Igreja Carvalho."
          url="https://igrejacarvalho.com.br/oracao"
        />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
          <CheckCircle className="mx-auto mb-6 h-16 w-16 text-pub-green" strokeWidth={1.5} />
          <h1 className="font-serif text-3xl font-bold text-pub-bark sm:text-4xl">
            Recebemos seu pedido
          </h1>
          <p className="mt-4 max-w-sm leading-relaxed text-pub-bark/60">
            Nossa equipe de intercessão orará por você com cuidado e sigilo.
            Que Deus seja glorificado nessa resposta.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                setMensagem(""); setNome(""); setContato("");
                setAnonimo(false); setConfidencial(false); setConsentimento(false);
                setTurnstileToken(""); setFormState("idle");
              }}
              className="rounded-md border border-pub-green px-6 py-2.5 text-sm font-medium text-pub-green hover:bg-pub-green hover:text-pub-beige transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
            >
              Enviar outro pedido
            </button>
            <Link
              to="/"
              className="rounded-md bg-pub-gold px-6 py-2.5 text-sm font-semibold text-pub-bark hover:bg-pub-gold/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <>
      <Seo
        title="Pedido de Oração"
        description="Envie seu pedido de oração para a Igreja Carvalho. Nossa equipe de intercessão orará por você."
        url="https://igrejacarvalho.com.br/oracao"
      />

      {/* Cabeçalho da página */}
      <div className="bg-pub-green px-4 pb-12 pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pub-beige/65">
          Ministério de intercessão
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-pub-beige sm:text-5xl">
          Pedido de Oração
        </h1>
        <p className="mt-4 text-pub-beige/60">
          Compartilhe seu pedido — nossa equipe orará por você com cuidado e sigilo.
        </p>
      </div>

      <div className="bg-pub-beige px-4 py-16">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-pub-bark/5 sm:px-10 sm:py-10">

            {/* ── HONEYPOT (invisível para humanos, pego pelos bots) ── */}
            {/* Posição fora da viewport; tabIndex -1 evita foco via teclado */}
            <div
              aria-hidden="true"
              style={{
                position:  "absolute",
                left:      "-9999px",
                width:     "1px",
                height:    "1px",
                overflow:  "hidden",
              }}
            >
              <label htmlFor="hp-website">Website</label>
              <input
                id="hp-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* ── Campo: nome ───────────────────────────────────────── */}
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="oracao-nome"
                  className="text-sm font-medium text-pub-bark"
                >
                  Seu nome <span className="text-pub-bark/40 font-normal">(opcional)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={anonimo}
                    onChange={(e) => setAnonimo(e.target.checked)}
                    className="h-4 w-4 rounded border-pub-bark/20 accent-pub-green focus-visible:ring-2 focus-visible:ring-pub-gold"
                  />
                  <span className="text-xs text-pub-bark/50">Enviar como anônimo</span>
                </label>
              </div>
              <input
                id="oracao-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={anonimo || formState === "loading"}
                placeholder={anonimo ? "Anônimo" : "Como podemos te chamar?"}
                autoComplete="name"
                maxLength={255}
                className="w-full rounded-lg border border-pub-bark/15 bg-pub-beige/40 px-4 py-2.5 text-sm text-pub-bark placeholder:text-pub-bark/30 focus:border-pub-green focus:outline-none focus:ring-2 focus:ring-pub-green/20 disabled:opacity-50"
              />
            </div>

            {/* ── Campo: pedido ─────────────────────────────────────── */}
            <div className="mb-5">
              <label
                htmlFor="oracao-mensagem"
                className="mb-1.5 block text-sm font-medium text-pub-bark"
              >
                Seu pedido{" "}
                <span className="text-pub-gold" aria-hidden="true">*</span>
              </label>
              <textarea
                id="oracao-mensagem"
                required
                rows={5}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={formState === "loading"}
                placeholder="Escreva seu pedido aqui. Tudo que compartilhar será tratado com respeito e cuidado."
                maxLength={5000}
                className="w-full resize-none rounded-lg border border-pub-bark/15 bg-pub-beige/40 px-4 py-2.5 text-sm text-pub-bark placeholder:text-pub-bark/30 focus:border-pub-green focus:outline-none focus:ring-2 focus:ring-pub-green/20 disabled:opacity-50"
              />
              <p className="mt-1 text-right text-xs text-pub-bark/30">
                {mensagem.length}/5000
              </p>
            </div>

            {/* ── Campo: contato ────────────────────────────────────── */}
            <div className="mb-6">
              <label
                htmlFor="oracao-contato"
                className="mb-1.5 block text-sm font-medium text-pub-bark"
              >
                Contato{" "}
                <span className="text-pub-bark/40 font-normal">(opcional — e-mail ou WhatsApp)</span>
              </label>
              <input
                id="oracao-contato"
                type="text"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                disabled={anonimo || formState === "loading"}
                placeholder={anonimo ? "Não disponível no modo anônimo" : "Para que possamos dar retorno"}
                autoComplete="off"
                maxLength={200}
                className="w-full rounded-lg border border-pub-bark/15 bg-pub-beige/40 px-4 py-2.5 text-sm text-pub-bark placeholder:text-pub-bark/30 focus:border-pub-green focus:outline-none focus:ring-2 focus:ring-pub-green/20 disabled:opacity-50"
              />
            </div>

            {/* ── Divisor ───────────────────────────────────────────── */}
            <div className="mb-5 h-px bg-pub-bark/8" aria-hidden="true" />

            {/* ── Checkbox: confidencial ────────────────────────────── */}
            <label className="mb-4 flex cursor-pointer gap-3 select-none">
              <input
                type="checkbox"
                checked={confidencial}
                onChange={(e) => setConfidencial(e.target.checked)}
                disabled={formState === "loading"}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-pub-bark/20 accent-pub-green focus-visible:ring-2 focus-visible:ring-pub-gold"
              />
              <span className="text-sm text-pub-bark/70 leading-snug">
                <strong className="font-medium text-pub-bark">Manter confidencial</strong>
                {" "}— somente o pastor terá acesso a este pedido.
              </span>
            </label>

            {/* ── Checkbox: consentimento (obrigatório) ─────────────── */}
            <label className="mb-6 flex cursor-pointer gap-3 select-none">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                disabled={formState === "loading"}
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-pub-bark/20 accent-pub-green focus-visible:ring-2 focus-visible:ring-pub-gold"
              />
              <span className="text-sm text-pub-bark/70 leading-snug">
                Concordo que as informações acima sejam armazenadas pela Igreja Carvalho
                para fins de ministério de intercessão, conforme a{" "}
                <Link
                  to="/privacidade"
                  className="text-pub-green underline underline-offset-2 hover:text-pub-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pub-gold"
                >
                  Política de Privacidade
                </Link>
                .{" "}
                <strong className="font-medium text-pub-bark">Obrigatório.</strong>
              </span>
            </label>

            {/* ── Widget Turnstile ──────────────────────────────────── */}
            {TURNSTILE_SITE_KEY && (
              <div className="mb-6 flex justify-center">
                <div ref={turnstileContainerRef} />
              </div>
            )}

            {/* ── Mensagem de erro ──────────────────────────────────── */}
            {formState === "error" && errorMsg && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ── Botão de envio ────────────────────────────────────── */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              className="w-full rounded-lg bg-pub-green px-6 py-3 text-sm font-semibold text-pub-beige transition-colors hover:bg-pub-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {formState === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  Enviando…
                </span>
              ) : (
                "Enviar pedido de oração"
              )}
            </button>

            {/* ── Nota de privacidade ───────────────────────────────── */}
            <p className="mt-4 text-center text-xs text-pub-bark/35 leading-relaxed">
              Seus dados são protegidos pela LGPD e armazenados por até 12 meses.
              <br />
              Nunca compartilhamos seu pedido fora da equipe de intercessão.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
