import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Agenda() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/public")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agenda de Cultos</h1>
            <p className="text-muted-foreground">Próximos cultos e eventos</p>
          </div>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              <CardTitle>Em Desenvolvimento</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              A agenda de cultos e eventos estará disponível em breve. Aqui você poderá ver:
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Data e horário dos próximos cultos</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Eventos especiais da igreja</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Local e informações de cada evento</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
