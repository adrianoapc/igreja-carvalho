import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Users, CreditCard, Church, Bot } from "lucide-react";
import { AuthGate } from "@/components/auth/AuthGate";

import AdminPermissions from "./AdminPermissions";
import Webhooks from "./admin/Webhooks";
import Chatbots from "./admin/Chatbots";
import ConfiguracoesIgreja from "./ConfiguracoesIgreja";
import BasesMinisteriais from "./financas/BasesMinisteriais";
import Notificacoes from "./admin/Notificacoes";

export default function Configuracoes() {
  return (
    <AuthGate requiredPermission="configuracoes.view">
      <div className="container mx-auto p-4 md:p-8 space-y-8 animate-fade-in pb-20">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie acessos, parâmetros da igreja, finanças e integrações.
          </p>
        </div>

        <Tabs defaultValue="institucional" className="w-full">
          <div className="overflow-x-auto pb-2 mb-4">
            <TabsList className="w-full justify-start md:justify-center h-auto p-1 bg-muted/50 inline-flex min-w-max">
              <TabsTrigger value="institucional" className="py-2 px-4 gap-2">
                <Church className="w-4 h-4" /> Institucional
              </TabsTrigger>
              <TabsTrigger value="acessos" className="py-2 px-4 gap-2">
                <Users className="w-4 h-4" /> Acessos & Staff
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="py-2 px-4 gap-2">
                <CreditCard className="w-4 h-4" /> Finanças
              </TabsTrigger>
              <TabsTrigger value="ia" className="py-2 px-4 gap-2">
                <Bot className="w-4 h-4" /> Inteligência
              </TabsTrigger>
              <TabsTrigger value="sistema" className="py-2 px-4 gap-2">
                <Settings className="w-4 h-4" /> Sistema
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="institucional" className="space-y-4">
            <ConfiguracoesIgreja />
          </TabsContent>

          <TabsContent value="acessos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Equipe</CardTitle>
                <CardDescription>Defina quem são os pastores, líderes e suas permissões.</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminPermissions />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-4">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Estrutura Ministerial</CardTitle>
                  <CardDescription>Centros de custo e bases para alocação de recursos.</CardDescription>
                </CardHeader>
                <CardContent>
                  <BasesMinisteriais />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contas Bancárias & Categorias</CardTitle>
                  <CardDescription>Gerencie as contas habilitadas e o plano de contas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Gestão de Categorias e Contas Bancárias será movida para cá em breve.
                    Por enquanto, acesse via menu Financeiro &gt; Configurações.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ia" className="space-y-4">
            <Chatbots />
          </TabsContent>

          <TabsContent value="sistema" className="space-y-4">
            <div className="grid gap-6">
              <Webhooks />
              <Notificacoes />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AuthGate>
  );
}
