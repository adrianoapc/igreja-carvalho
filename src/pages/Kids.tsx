import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Baby, Users, LogIn, LogOut, Search, Plus, Edit, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Child {
  id: string;
  nome: string;
  dataNascimento: string;
  idade: number;
  sala: string;
  responsavel: string;
  telefone: string;
  observacoes?: string;
  status: "checked-in" | "checked-out";
  checkinTime?: string;
}

const salas = [
  { id: "berçario", nome: "Berçário", faixaEtaria: "0-2 anos" },
  { id: "maternal", nome: "Maternal", faixaEtaria: "2-4 anos" },
  { id: "jardim", nome: "Jardim", faixaEtaria: "4-6 anos" },
  { id: "primarios", nome: "Primários", faixaEtaria: "6-8 anos" },
  { id: "juniores", nome: "Juniores", faixaEtaria: "8-12 anos" },
];

const mockChildren: Child[] = [
  {
    id: "1",
    nome: "Maria Silva",
    dataNascimento: "2020-05-15",
    idade: 4,
    sala: "maternal",
    responsavel: "João Silva",
    telefone: "(11) 98765-4321",
    observacoes: "Alergia a amendoim",
    status: "checked-out",
  },
  {
    id: "2",
    nome: "Pedro Santos",
    dataNascimento: "2018-08-22",
    idade: 6,
    sala: "jardim",
    responsavel: "Ana Santos",
    telefone: "(11) 97654-3210",
    status: "checked-in",
    checkinTime: "09:30",
  },
  {
    id: "3",
    nome: "Lucas Oliveira",
    dataNascimento: "2016-03-10",
    idade: 8,
    sala: "primarios",
    responsavel: "Carlos Oliveira",
    telefone: "(11) 96543-2109",
    status: "checked-in",
    checkinTime: "09:15",
  },
];

export default function Kids() {
  const [children, setChildren] = useState<Child[]>(mockChildren);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSala, setSelectedSala] = useState<string>("all");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const filteredChildren = children.filter((child) => {
    const matchesSearch = child.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          child.responsavel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSala = selectedSala === "all" || child.sala === selectedSala;
    return matchesSearch && matchesSala;
  });

  const handleCheckIn = (id: string) => {
    setChildren(children.map(child => 
      child.id === id 
        ? { ...child, status: "checked-in", checkinTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
        : child
    ));
  };

  const handleCheckOut = (id: string) => {
    setChildren(children.map(child => 
      child.id === id 
        ? { ...child, status: "checked-out", checkinTime: undefined }
        : child
    ));
  };

  const getSalaNome = (salaId: string) => {
    return salas.find(s => s.id === salaId)?.nome || salaId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kids</h1>
          <p className="text-muted-foreground mt-1">Gerenciamento de crianças e salas</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar Criança
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Criança</DialogTitle>
              <DialogDescription>
                Preencha os dados da criança para cadastro no Kids
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input id="nome" placeholder="Nome da criança" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                  <Input id="dataNascimento" type="date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sala">Sala *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {salas.map((sala) => (
                      <SelectItem key={sala.id} value={sala.id}>
                        {sala.nome} ({sala.faixaEtaria})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responsavel">Nome do Responsável *</Label>
                  <Input id="responsavel" placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone do Responsável *</Label>
                  <Input id="telefone" placeholder="(00) 00000-0000" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Médicas/Alergias</Label>
                <Textarea 
                  id="observacoes" 
                  placeholder="Alergias, medicamentos, restrições alimentares, etc."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas das Salas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Crianças</CardTitle>
            <Baby className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{children.length}</div>
            <p className="text-xs text-muted-foreground">
              Cadastradas no sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Check-ins Hoje</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {children.filter(c => c.status === "checked-in").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Crianças presentes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salas.length}</div>
            <p className="text-xs text-muted-foreground">
              Faixas etárias diferentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar por nome da criança ou responsável..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedSala} onValueChange={setSelectedSala}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por sala" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Salas</SelectItem>
                  {salas.map((sala) => (
                    <SelectItem key={sala.id} value={sala.id}>
                      {sala.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Crianças */}
      <Card>
        <CardHeader>
          <CardTitle>Crianças Cadastradas</CardTitle>
          <CardDescription>
            {filteredChildren.length} criança(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredChildren.map((child) => (
              <Card key={child.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{child.nome}</h3>
                        <Badge variant={child.status === "checked-in" ? "default" : "secondary"}>
                          {child.status === "checked-in" ? "Presente" : "Ausente"}
                        </Badge>
                        <Badge variant="outline">{getSalaNome(child.sala)}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Idade:</span> {child.idade} anos
                        </div>
                        <div>
                          <span className="font-medium">Responsável:</span> {child.responsavel}
                        </div>
                        <div>
                          <span className="font-medium">Telefone:</span> {child.telefone}
                        </div>
                        {child.checkinTime && (
                          <div>
                            <span className="font-medium">Check-in:</span> {child.checkinTime}
                          </div>
                        )}
                      </div>
                      {child.observacoes && (
                        <div className="text-sm mt-2">
                          <span className="font-medium text-foreground">Observações:</span>{" "}
                          <span className="text-muted-foreground">{child.observacoes}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {child.status === "checked-out" ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleCheckIn(child.id)}
                          className="gap-2"
                        >
                          <LogIn className="w-4 h-4" />
                          Check-in
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleCheckOut(child.id)}
                          className="gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Check-out
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Salas e Faixas Etárias */}
      <Card>
        <CardHeader>
          <CardTitle>Salas e Faixas Etárias</CardTitle>
          <CardDescription>Distribuição das crianças por sala</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salas.map((sala) => {
              const criancasSala = children.filter(c => c.sala === sala.id);
              const presentes = criancasSala.filter(c => c.status === "checked-in").length;
              
              return (
                <Card key={sala.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{sala.nome}</CardTitle>
                    <CardDescription>{sala.faixaEtaria}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-medium">{criancasSala.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Presentes:</span>
                        <span className="font-medium text-primary">{presentes}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
