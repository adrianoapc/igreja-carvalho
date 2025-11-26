import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";

const pedidos = [
  { id: 1, nome: "Maria Silva", pedido: "Oração pela saúde da minha mãe que está internada", data: "26/11/2024", status: "Pendente" },
  { id: 2, nome: "João Santos", pedido: "Agradecimento pela nova oportunidade de emprego que recebi", data: "25/11/2024", status: "Respondido" },
  { id: 3, nome: "Ana Paula", pedido: "Oração pelos meus estudos e pela prova importante na próxima semana", data: "25/11/2024", status: "Em Oração" },
  { id: 4, nome: "Pedro Costa", pedido: "Oração pela restauração do meu casamento", data: "24/11/2024", status: "Em Oração" },
  { id: 5, nome: "Carlos Oliveira", pedido: "Oração pela saúde financeira da família", data: "24/11/2024", status: "Pendente" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Pendente":
      return "bg-accent/20 text-accent-foreground";
    case "Em Oração":
      return "bg-primary/20 text-primary";
    case "Respondido":
      return "bg-green-100 text-green-700";
    default:
      return "bg-muted";
  }
};

export default function Oracoes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos de Oração</h1>
          <p className="text-muted-foreground mt-1">Gerencie e acompanhe os pedidos de oração</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <div className="grid gap-4">
        {pedidos.map((pedido) => (
          <Card key={pedido.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    {pedido.nome.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{pedido.nome}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{pedido.data}</span>
                    </div>
                  </div>
                </div>
                <Badge className={getStatusColor(pedido.status)}>
                  {pedido.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{pedido.pedido}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">Ver Detalhes</Button>
                <Button variant="outline" size="sm">Marcar como Respondido</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
