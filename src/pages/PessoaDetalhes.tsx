import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Heart,
  Users,
  BookOpen,
  MoreHorizontal,
  Edit,
  Check,
  X,
  Gift,
  Shield,
  Church,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PessoaDetalhesData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: "visitante" | "frequentador" | "membro";
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  aceitou_jesus: boolean | null;
  deseja_contato: boolean | null;
  recebeu_brinde: boolean | null;
}

export default function PessoaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Mock data - substituir por dados reais do Supabase
  const [pessoa] = useState<PessoaDetalhesData>({
    id: id || "",
    nome: "Giovani Vieira Rodrigues Vilarinho",
    email: "giovani@exemplo.com",
    telefone: "+55 (17) 99660-0002",
    status: "visitante",
    data_primeira_visita: "2025-09-28",
    data_ultima_visita: "2025-09-29",
    numero_visitas: 3,
    aceitou_jesus: false,
    deseja_contato: true,
    recebeu_brinde: false,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "visitante": return "outline";
      case "frequentador": return "secondary";
      case "membro": return "default";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "visitante": return "VISITANTE";
      case "frequentador": return "FREQUENTADOR";
      case "membro": return "MEMBRO";
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Data de criação: {pessoa.data_primeira_visita && format(new Date(pessoa.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Atualizado em: {pessoa.data_ultima_visita && format(new Date(pessoa.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-4 border-green-500">
                <AvatarFallback className="text-2xl bg-gradient-accent text-accent-foreground">
                  {pessoa.nome.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{pessoa.nome}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getStatusBadgeVariant(pessoa.status)}>
                    {getStatusLabel(pessoa.status)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    • ID do perfil: {pessoa.id.slice(0, 8)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  <X className="w-4 h-4 inline mr-1" />
                  não é usuário da plataforma
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon">
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Church Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Church className="w-5 h-5" />
            Igreja Carvalho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Funções:</span>
            <Badge variant="outline">Nenhum</Badge>
            <Badge variant="default" className="bg-green-600">
              ATIVO
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="perfil">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="pessoais">
            <Heart className="w-4 h-4 mr-2" />
            Pessoais
          </TabsTrigger>
          <TabsTrigger value="contatos">
            <Phone className="w-4 h-4 mr-2" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="igreja">
            <Church className="w-4 h-4 mr-2" />
            Igreja
          </TabsTrigger>
          <TabsTrigger value="mais">
            <MoreHorizontal className="w-4 h-4 mr-2" />
            Mais
          </TabsTrigger>
        </TabsList>

        {/* Tab: Perfil */}
        <TabsContent value="perfil" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Idade</p>
                    <p className="font-semibold">47 anos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Como está se sentindo?</p>
                    <p className="font-semibold">Não informou</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Estado Civil</p>
                    <p className="font-semibold">Casado(a)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">É batizado?</p>
                    <p className="font-semibold">Sim</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">É pastor?</p>
                    <p className="font-semibold">Não</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Faz parte da liderança?</p>
                    <p className="font-semibold">Não</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-semibold">{pessoa.telefone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Gift className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Necessidades especiais</p>
                    <p className="font-semibold">Não</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Pessoais */}
        <TabsContent value="pessoais" className="space-y-4">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <p>Informações pessoais adicionais</p>
                <p className="text-sm mt-1">Em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Contatos */}
        <TabsContent value="contatos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Contatos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum contato registrado</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Igreja */}
        <TabsContent value="igreja" className="space-y-4">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <p>Informações da igreja</p>
                <p className="text-sm mt-1">Participação em ministérios e células</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Mais */}
        <TabsContent value="mais" className="space-y-4">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <p>Informações adicionais</p>
                <p className="text-sm mt-1">Documentos, anotações e histórico</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
