import { Link } from "react-router-dom";

export function PublicFooter() {
  return (
    <footer className="bg-pub-bark text-pub-beige/80" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-3">

          {/* Marca */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col leading-none">
              <span className="font-serif text-[0.65rem] font-semibold tracking-[0.22em] text-pub-beige/50 uppercase">Igreja</span>
              <span className="font-serif text-lg font-bold tracking-[0.14em] text-pub-beige uppercase">Carvalho</span>
            </div>
            <p className="text-xs leading-relaxed text-pub-beige/55">
              "Plantados por Deus, vivendo para servir."
            </p>
          </div>

          {/* Links legais */}
          <nav aria-label="Links institucionais">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-pub-gold">
              Links
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link
                  to="/contato"
                  className="hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Contato e Localização
                </Link>
              </li>
              <li>
                <Link
                  to="/privacidade"
                  className="hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  to="/auth"
                  className="hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>

          {/* Redes sociais */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-pub-gold">
              Redes sociais
            </h2>
            <ul className="flex flex-col gap-2 text-sm" aria-label="Redes sociais">
              <li>
                <a
                  href="https://instagram.com/igrejacarvalho"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram da Igreja Carvalho"
                  className="hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://youtube.com/@igrejacarvalho"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Canal no YouTube da Igreja Carvalho"
                  className="hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  YouTube
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-pub-beige/10 pt-6 text-center text-xs text-pub-beige/30">
          © {new Date().getFullYear()} Igreja Carvalho. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
