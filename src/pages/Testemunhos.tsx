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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Testemunhos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Compartilhe as bênçãos e milagres</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Testemunho</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      <div className="grid gap-3 md:gap-4">
        {testemunhos.map((testemunho) => (
          <Card key={testemunho.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="pb-3 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base md:text-lg truncate">{testemunho.nome}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{testemunho.data}</span>
                      <Badge variant="outline" className="text-xs">{testemunho.categoria}</Badge>
                    </div>
                  </div>
                </div>
                {testemunho.aprovado ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap">Aprovado</Badge>
                ) : (
                  <Badge className="bg-accent/20 text-accent-foreground whitespace-nowrap">Pendente</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <p className="text-sm md:text-base text-muted-foreground line-clamp-3">{testemunho.testemunho}</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3 md:mt-4">
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">Ver Detalhes</Button>
                {!testemunho.aprovado && (
                  <Button variant="outline" size="sm" className="text-primary w-full sm:w-auto text-xs md:text-sm">Aprovar</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
