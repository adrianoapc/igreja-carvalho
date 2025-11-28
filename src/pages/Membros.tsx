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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Membros</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gerencie os membros da igreja</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Membro</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar membros..." 
                className="pl-10 text-sm md:text-base"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {membros.map((membro) => (
              <div key={membro.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-base md:text-lg flex-shrink-0">
                    {membro.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{membro.nome}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{membro.email}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {membro.telefone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-left sm:text-right">
                    <p className="text-xs md:text-sm font-medium text-primary">{membro.departamento}</p>
                    <p className="text-xs text-muted-foreground">{membro.status}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs md:text-sm">Editar</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
