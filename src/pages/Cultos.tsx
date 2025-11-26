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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Planejamento de Cultos</h1>
          <p className="text-muted-foreground mt-1">Gerencie a programação e escalas dos cultos</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Novo Culto
        </Button>
      </div>

      <div className="grid gap-6">
        {cultos.map((culto) => (
          <Card key={culto.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{culto.tipo}</CardTitle>
                      <p className="text-sm text-muted-foreground">{culto.tema}</p>
                    </div>
                  </div>
                </div>
                <Badge className={culto.status === "Confirmado" ? "bg-green-100 text-green-700" : "bg-accent/20 text-accent-foreground"}>
                  {culto.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{culto.data}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{culto.horario}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{culto.pregador}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Departamentos Escalados:</p>
                <div className="flex flex-wrap gap-2">
                  {culto.departamentos.map((dept) => (
                    <Badge key={dept} variant="outline">{dept}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm">Ver Escalas</Button>
                <Button variant="outline" size="sm">Editar Liturgia</Button>
                <Button variant="outline" size="sm">Adicionar Canções</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
