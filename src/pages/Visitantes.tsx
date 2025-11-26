import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Phone, Calendar } from "lucide-react";

const visitantes = [
  { id: 1, nome: "Lucas Mendes", telefone: "(11) 98765-1111", primeiraVisita: "26/11/2024", ultimaVisita: "26/11/2024", vezes: 1 },
  { id: 2, nome: "Fernanda Lima", telefone: "(11) 98765-2222", primeiraVisita: "19/11/2024", ultimaVisita: "26/11/2024", vezes: 2 },
  { id: 3, nome: "Ricardo Alves", telefone: "(11) 98765-3333", primeiraVisita: "12/11/2024", ultimaVisita: "26/11/2024", vezes: 3 },
];

export default function Visitantes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Visitantes</h1>
          <p className="text-muted-foreground mt-1">Registre e acompanhe os visitantes</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Visitante
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar visitantes..." className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visitantes.map((visitante) => (
              <div key={visitante.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-lg">
                    {visitante.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{visitante.nome}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {visitante.telefone}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {visitante.vezes}x visitou
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Última visita</p>
                    <p className="text-sm font-medium text-primary">{visitante.ultimaVisita}</p>
                  </div>
                  <Button variant="outline" size="sm">Detalhes</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
