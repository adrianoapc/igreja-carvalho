import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Quem somos", href: "/#quem-somos" },
  { label: "Agenda",     href: "/agenda" },
  { label: "Mensagens",  href: "/mensagens" },
  { label: "Contato",    href: "/contato" },
];

export function PublicHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-pub-green transition-shadow duration-200 ${
        isScrolled ? "shadow-lg" : ""
      }`}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">

        {/* Wordmark */}
        <Link
          to="/"
          className="flex flex-col leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
          aria-label="Igreja Carvalho — página inicial"
        >
          <span className="font-serif text-[0.7rem] font-semibold tracking-[0.22em] text-pub-beige/60 uppercase leading-none">
            Igreja
          </span>
          <span className="font-serif text-xl font-bold tracking-[0.14em] text-pub-beige uppercase leading-tight">
            Carvalho
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden md:flex items-center gap-6"
          aria-label="Navegação principal"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-pub-beige/80 hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold rounded-sm"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-pub-gold text-pub-gold bg-transparent hover:bg-pub-gold hover:text-pub-bark"
          >
            <Link to="/oracao">Oração</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-pub-beige text-pub-green hover:bg-pub-gold hover:text-pub-bark"
          >
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded p-2 text-pub-beige hover:text-pub-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden border-t border-pub-beige/10 bg-pub-green px-4 pb-4 pt-2"
          aria-label="Navegação mobile"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <NavLink
                  to={link.href}
                  className="block rounded px-3 py-2.5 text-sm font-medium text-pub-beige/90 hover:bg-pub-beige/10 hover:text-pub-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-gold"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li className="mt-3 flex flex-col gap-2">
              <Button
                asChild
                variant="outline"
                className="w-full border-pub-gold text-pub-gold bg-transparent hover:bg-pub-gold hover:text-pub-bark"
              >
                <Link to="/oracao" onClick={() => setMenuOpen(false)}>
                  Oração
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-pub-beige text-pub-green hover:bg-pub-gold hover:text-pub-bark"
              >
                <Link to="/auth" onClick={() => setMenuOpen(false)}>
                  Entrar
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
