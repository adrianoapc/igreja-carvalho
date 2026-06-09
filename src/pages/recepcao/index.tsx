import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Users,
  ClipboardList,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

interface AcaoCard {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  rota: string;
  cor: string;
}

export default function HubRecepcao() {
  const navigate = useNavigate();

  const acoes: AcaoCard[] = [
    {
      icon: <UserPlus className="w-7 h-7" />,
      titulo: "Cadastrar Visitante",
      descricao: "Registrar nova pessoa que visitou hoje",
      rota: "/recepcao/visitante",
      cor: "from-blue-500 to-blue-600",
    },
    {
      icon: <Users className="w-7 h-7" />,
      titulo: "Registrar Frequentador",
      descricao: "Confirmar presença de quem frequenta regularmente",
      rota: "/recepcao/frequentador",
      cor: "from-emerald-500 to-emerald-600",
    },
    {
      icon: <ClipboardList className="w-7 h-7" />,
      titulo: "Chamada de Membros",
      descricao: "Marcar presenças e ausências no culto de hoje",
      rota: "/chamada",
      cor: "from-violet-500 to-violet-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Recepção</h1>
        <p className="text-sm text-muted-foreground">Selecione a ação desejada</p>
      </div>

      {/* Cards de ação */}
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {acoes.map((acao) => (
          <Card
            key={acao.rota}
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
            onClick={() => navigate(acao.rota)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${acao.cor} flex items-center justify-center text-white shrink-0`}>
                {acao.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">{acao.titulo}</p>
                <p className="text-sm text-muted-foreground leading-snug">{acao.descricao}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
