import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Play } from "lucide-react";

export default function Ensinamentos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ensinamentos</h1>
          <p className="text-muted-foreground mt-1">Planos de leitura e trilhas</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle>Plano de Leitura Anual</CardTitle>
                <p className="text-sm text-muted-foreground">365 dias</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Leia a Bíblia completa em um ano com este plano estruturado.
            </p>
            <Button variant="outline" className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Iniciar Plano
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft hover:shadow-medium transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-accent flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <CardTitle>Trilha: Fundamentos da Fé</CardTitle>
                <p className="text-sm text-muted-foreground">8 semanas</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Aprenda os fundamentos essenciais da fé cristã.
            </p>
            <Button variant="outline" className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Iniciar Trilha
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
