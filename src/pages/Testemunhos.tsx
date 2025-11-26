import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Heart, Clock } from "lucide-react";

const testemunhos = [
  { id: 1, nome: "Ana Maria", testemunho: "Fui curada de uma doença grave após as orações da igreja. Glória a Deus!", data: "25/11/2024", categoria: "Cura", aprovado: true },
  { id: 2, nome: "Roberto Silva", testemunho: "Consegui o emprego que tanto orava! Deus é fiel!", data: "24/11/2024", categoria: "Provisão", aprovado: true },
  { id: 3, nome: "Juliana Costa", testemunho: "Meu casamento foi restaurado através das ministrações da igreja", data: "23/11/2024", categoria: "Relacionamento", aprovado: false },
  { id: 4, nome: "Marcos Paulo", testemunho: "Deus transformou minha vida completamente após aceitar Jesus", data: "22/11/2024", categoria: "Salvação", aprovado: true },
];

export default function Testemunhos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Testemunhos</h1>
          <p className="text-muted-foreground mt-1">Compartilhe as bênçãos e milagres</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Novo Testemunho
        </Button>
      </div>

      <div className="grid gap-4">
        {testemunhos.map((testemunho) => (
          <Card key={testemunho.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center">
                    <Heart className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{testemunho.nome}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{testemunho.data}</span>
                      <Badge variant="outline" className="ml-2">{testemunho.categoria}</Badge>
                    </div>
                  </div>
                </div>
                {testemunho.aprovado ? (
                  <Badge className="bg-green-100 text-green-700">Aprovado</Badge>
                ) : (
                  <Badge className="bg-accent/20 text-accent-foreground">Pendente</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{testemunho.testemunho}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm">Ver Detalhes</Button>
                {!testemunho.aprovado && (
                  <Button variant="outline" size="sm" className="text-primary">Aprovar</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
