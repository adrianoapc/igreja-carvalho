import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Download, FileText, CreditCard } from "lucide-react";
import { ImportarTab } from "@/components/financas/ImportarTab";
import { ExportarTab } from "@/components/financas/ExportarTab";
import { ImportarExtratosTab } from "@/components/financas/ImportarExtratosTab";
import { ImportarRecebivelGetnetTab } from "@/components/financas/ImportarRecebivelGetnetTab";

export default function GerenciarDados() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") || "importar";
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Gerenciar Dados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe e exporte dados financeiros com filtros avançados
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            <span>Importar</span>
          </TabsTrigger>
          <TabsTrigger value="exportar" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </TabsTrigger>
          <TabsTrigger value="extratos" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Extratos</span>
          </TabsTrigger>
          <TabsTrigger value="recebivel-getnet" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Recebível Getnet</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importar" className="mt-6">
          <ImportarTab />
        </TabsContent>

        <TabsContent value="exportar" className="mt-6">
          <ExportarTab />
        </TabsContent>

        <TabsContent value="extratos" className="mt-6">
          <ImportarExtratosTab />
        </TabsContent>

        <TabsContent value="recebivel-getnet" className="mt-6">
          <ImportarRecebivelGetnetTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
