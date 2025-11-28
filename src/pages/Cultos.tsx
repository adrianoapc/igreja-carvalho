import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, Users } from "lucide-react";

const cultos = [
  {
    id: 1,
    tipo: "Culto de Celebração",
    data: "26/11/2024",
    horario: "10:00",
    pregador: "Pastor João Silva",
    tema: "A Fé que Move Montanhas",
    departamentos: ["Louvor", "Mídia", "Recepção"],
    status: "Confirmado"
  },
  {
    id: 2,
    tipo: "Culto de Oração",
    data: "29/11/2024",
    horario: "19:30",
    pregador: "Pastora Maria Santos",
    tema: "O Poder da Oração",
    departamentos: ["Intercessão", "Mídia"],
    status: "Planejado"
  },
  {
    id: 3,
    tipo: "Culto de Celebração",
    data: "03/12/2024",
    horario: "10:00",
    pregador: "Pastor João Silva",
    tema: "Gratidão em Todo Tempo",
    departamentos: ["Louvor", "Mídia", "Recepção", "Crianças"],
    status: "Planejado"
  },
];

export default function Cultos() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Planejamento de Cultos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie a programação e escalas dos cultos</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Culto</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6">
        {cultos.map((culto) => (
          <Card key={culto.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg md:text-xl truncate">{culto.tipo}</CardTitle>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{culto.tema}</p>
                    </div>
                  </div>
                </div>
                <Badge className={culto.status === "Confirmado" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap" : "bg-accent/20 text-accent-foreground whitespace-nowrap"}>
                  {culto.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm truncate">{culto.data}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm">{culto.horario}</span>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Users className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs md:text-sm truncate">{culto.pregador}</span>
                </div>
              </div>

              <div>
                <p className="text-xs md:text-sm font-medium mb-2">Departamentos Escalados:</p>
                <div className="flex flex-wrap gap-2">
                  {culto.departamentos.map((dept) => (
                    <Badge key={dept} variant="outline" className="text-xs">{dept}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">Ver Escalas</Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">Editar Liturgia</Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">Canções</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
