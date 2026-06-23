import { Seo } from "@/components/Seo";

export default function PublicMensagens() {
  return (
    <>
      <Seo
        title="Mensagens"
        description="Ouça e assista às mensagens pregadas na Igreja Carvalho."
        url="https://igrejacarvalho.com.br/mensagens"
      />

      <section
        className="mx-auto max-w-4xl px-4 py-20"
        aria-labelledby="mensagens-heading"
      >
        <header className="mb-12">
          <h1
            id="mensagens-heading"
            className="font-serif text-4xl font-bold text-pub-bark sm:text-5xl"
          >
            Mensagens
          </h1>
          <p className="mt-4 text-pub-bark/55 leading-relaxed">
            Sermões e pregações da Igreja Carvalho.
          </p>
        </header>

        {/*
          TODO: integração com YouTube ou tabela de pregações
          Opções:
            a) Embed de playlist do YouTube via iframe
            b) Tabela `cancoes_culto` com link_youtube agrupada por culto
        */}
        <div className="rounded-xl border-2 border-dashed border-pub-green/20 p-16 text-center text-pub-bark/30">
          <p className="text-lg">Grid de mensagens virá aqui</p>
          <p className="mt-2 text-xs">
            Integração: YouTube playlist embed ou tabela{" "}
            <code className="rounded bg-pub-beige-dark/40 px-1">cultos</code>
            {" "}+{" "}
            <code className="rounded bg-pub-beige-dark/40 px-1">link_youtube</code>
          </p>
        </div>
      </section>
    </>
  );
}
