import { useLocation, Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

// Dicionário para traduzir as rotas (pode crescer com o tempo)
const ROUTE_LABELS: Record<string, string> = {
  // Gestão
  financas: "Financeiro",
  configuracoes: "Configurações",
  admin: "Administração",
  projetos: "Projetos",
  
  // Pessoas
  pessoas: "Pessoas",
  membros: "Membros",
  visitantes: "Visitantes",
  gabinete: "Gabinete",
  intercessao: "Intercessão",
  
  // Ministério
  ministerio: "Ministério",
  escalas: "Escalas",
  cultos: "Cultos",
  kids: "Kids",
  ensino: "Ensino",
  midias: "Mídias",
  mural: "Mural",
  comunicados: "Comunicados",
  publicacao: "Publicação",
  chamada: "Chamada",
  voluntariado: "Voluntariado",
  
  // Usuário
  perfil: "Meu Perfil",
  familia: "Minha Família",
  cursos: "Meus Cursos",
};

// Rotas que NÃO devem ser clicáveis (apenas visualização de agrupamento)
// Isso resolve o teu medo de o usuário cair num limbo ou "Acesso Negado"
const NON_CLICKABLE_PATHS = ["admin", "ministerio"]; 

export function AppBreadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Se estiver na home, não precisa mostrar breadcrumb ou mostra só "Dashboard"
  if (pathnames.length === 0) {
    return (
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        <BreadcrumbSeparator />

        {pathnames.map((value, index) => {
          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          
          // Formata o nome: procura no dicionário ou deixa a primeira letra maiúscula
          const label = ROUTE_LABELS[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');

          // Verifica se é um ID (uuid ou número) para não poluir o breadcrumb
          const isId = value.length > 20 || !isNaN(Number(value));
          if (isId) return null; // Pula IDs no breadcrumb para ficar limpo

          return (
            <Fragment key={to}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  // Lógica de Segurança: Se estiver na lista negra, renderiza texto, não link
                  NON_CLICKABLE_PATHS.includes(value) ? (
                    <span className="text-muted-foreground">{label}</span>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={to}>{label}</Link>
                    </BreadcrumbLink>
                  )
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
