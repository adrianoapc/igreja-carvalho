import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Mail, Phone } from "lucide-react";

const membros = [
  { id: 1, nome: "João Silva", email: "joao@email.com", telefone: "(11) 98765-4321", departamento: "Louvor", status: "Ativo" },
  { id: 2, nome: "Maria Santos", email: "maria@email.com", telefone: "(11) 98765-4322", departamento: "Intercessão", status: "Ativo" },
  { id: 3, nome: "Pedro Costa", email: "pedro@email.com", telefone: "(11) 98765-4323", departamento: "Mídia", status: "Ativo" },
  { id: 4, nome: "Ana Paula", email: "ana@email.com", telefone: "(11) 98765-4324", departamento: "Crianças", status: "Ativo" },
  { id: 5, nome: "Carlos Oliveira", email: "carlos@email.com", telefone: "(11) 98765-4325", departamento: "Jovens", status: "Ativo" },
];

export default function Membros() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Membros</h1>
          <p className="text-muted-foreground mt-1">Gerencie os membros da igreja</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Novo Membro
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar membros..." 
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {membros.map((membro) => (
              <div key={membro.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                    {membro.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{membro.nome}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {membro.email}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {membro.telefone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">{membro.departamento}</p>
                    <p className="text-xs text-muted-foreground">{membro.status}</p>
                  </div>
                  <Button variant="outline" size="sm">Editar</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
