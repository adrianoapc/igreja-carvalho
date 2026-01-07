import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Calendar,
  MapPin,
  Video,
  Church,
  BookOpen,
  User,
  Clock,
  Link,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFilialId } from "@/hooks/useFilialId";
import { format } from "date-fns";

interface NovaAulaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Jornada {
  id: string;
  titulo: string;
}

interface Sala {
  id: string;
  nome: string;
}

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
}

interface Profile {
  id: string;
  nome: string;
}

export default function NovaAulaDrawer({
  open,
  onOpenChange,
  onSuccess,
}: NovaAulaDrawerProps) {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [jornadaId, setJornadaId] = useState("");
  const [tema, setTema] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [duracao, setDuracao] = useState("60");

  const [modalidade, setModalidade] = useState<
    "presencial" | "online" | "hibrido"
  >("presencial");
  const [salaId, setSalaId] = useState("");
  const [linkReuniao, setLinkReuniao] = useState("");

  const [vinculadoCulto, setVinculadoCulto] = useState(false);
  const [cultoId, setCultoId] = useState("");

  // Data lists
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [cultos, setCultos] = useState<Evento[]>([]);
  const [professores, setProfessores] = useState<Profile[]>([]);

  useEffect(() => {
    if (open) {
      fetchOptions();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setStep(1);
    setJornadaId("");
    setTema("");
    setProfessorId("");
    setDataInicio("");
    setHoraInicio("");
    setDuracao("60");
    setModalidade("presencial");
    setSalaId("");
    setLinkReuniao("");
    setVinculadoCulto(false);
    setCultoId("");
  };

  const fetchOptions = async () => {
    // Fetch jornadas
    const { data: jornadasData } = await supabase
      .from("jornadas")
      .select("id, titulo")
      .eq("ativo", true)
      .order("titulo");
    setJornadas(jornadasData || []);

    // Fetch salas
    let salasQuery = supabase
      .from("salas")
      .select("id, nome")
      .eq("ativo", true);

    if (igrejaId) salasQuery = salasQuery.eq("igreja_id", igrejaId);
    if (!isAllFiliais && filialId)
      salasQuery = salasQuery.eq("filial_id", filialId);

    const { data: salasData } = await salasQuery.order("nome");
    setSalas(salasData || []);

    // Fetch cultos futuros
    const { data: cultosData } = await supabase
      .from("eventos")
      .select("id, titulo, data_evento")
      .gte("data_evento", new Date().toISOString())
      .order("data_evento");
    setCultos(cultosData || []);

    // Fetch professores (membros)
    const { data: profData } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("status", "membro")
      .order("nome");
    setProfessores(profData || []);
  };

  const handleSave = async () => {
    if (!tema || !dataInicio || !horaInicio) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if ((modalidade === "presencial" || modalidade === "hibrido") && !salaId) {
      toast.error("Selecione uma sala para aulas presenciais/híbridas");
      return;
    }

    if ((modalidade === "online" || modalidade === "hibrido") && !linkReuniao) {
      toast.error("Informe o link da reunião para aulas online/híbridas");
      return;
    }

    setLoading(true);

    const dataHoraInicio = new Date(`${dataInicio}T${horaInicio}`);

    const { error } = await supabase.from("aulas").insert({
      tema,
      jornada_id: jornadaId || null,
      professor_id: professorId || null,
      data_inicio: dataHoraInicio.toISOString(),
      duracao_minutos: parseInt(duracao),
      modalidade,
      sala_id:
        modalidade === "presencial" || modalidade === "hibrido" ? salaId : null,
      link_reuniao:
        modalidade === "online" || modalidade === "hibrido"
          ? linkReuniao
          : null,
      evento_id: vinculadoCulto ? cultoId : null,
      status: "agendada",
    });

    setLoading(false);

    if (error) {
      console.error("Erro ao criar aula:", error);
      toast.error("Erro ao criar aula");
      return;
    }

    toast.success("Aula agendada com sucesso!");
    onSuccess();
  };

  const canProceed = () => {
    if (step === 1) return tema.length > 0;
    if (step === 2) {
      if (modalidade === "presencial") return salaId.length > 0;
      if (modalidade === "online") return linkReuniao.length > 0;
      if (modalidade === "hibrido")
        return salaId.length > 0 && linkReuniao.length > 0;
    }
    return true;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Nova Aula - Passo {step} de 3
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto">
          {/* Step 1: O que é? */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <h3 className="font-medium text-sm text-primary flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Passo 1: O que é?
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina o conteúdo da aula
                </p>
              </div>

              <div className="space-y-2">
                <Label>Jornada / Trilha (opcional)</Label>
                <Select value={jornadaId} onValueChange={setJornadaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    {jornadas.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tema da Aula *</Label>
                <Input
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="Ex: Aula 3 - A Trindade"
                />
              </div>

              <div className="space-y-2">
                <Label>Professor (opcional)</Label>
                <Select value={professorId} onValueChange={setProfessorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {professores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Data *
                  </Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Horário *
                  </Label>
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duração (minutos)</Label>
                <Select value={duracao} onValueChange={setDuracao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Onde? */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <h3 className="font-medium text-sm text-primary flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Passo 2: Onde?
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina a modalidade e local
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modalidade *</Label>
                <Select
                  value={modalidade}
                  onValueChange={(v) =>
                    setModalidade(v as "presencial" | "online" | "hibrido")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-600" />
                        Presencial
                      </div>
                    </SelectItem>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-blue-600" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="hibrido">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <Video className="w-4 h-4 text-purple-600" />
                        Híbrido
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(modalidade === "presencial" || modalidade === "hibrido") && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Sala *
                  </Label>
                  <Select value={salaId} onValueChange={setSalaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a sala" />
                    </SelectTrigger>
                    <SelectContent>
                      {salas.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(modalidade === "online" || modalidade === "hibrido") && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Link className="w-3 h-3" />
                    Link da Reunião *
                  </Label>
                  <Input
                    value={linkReuniao}
                    onChange={(e) => setLinkReuniao(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Integração */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <h3 className="font-medium text-sm text-primary flex items-center gap-2">
                  <Church className="w-4 h-4" />
                  Passo 3: Integração
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Vincule a um culto se necessário
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <Church
                    className={`w-5 h-5 ${
                      vinculadoCulto ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className="font-medium">Acontece durante um Evento?</p>
                    <p className="text-xs text-muted-foreground">
                      Ex: Escola Bíblica Dominical
                    </p>
                  </div>
                </div>
                <Switch
                  checked={vinculadoCulto}
                  onCheckedChange={setVinculadoCulto}
                />
              </div>

              {vinculadoCulto && (
                <div className="space-y-2">
                  <Label>Evento Vinculado</Label>
                  <Select value={cultoId} onValueChange={setCultoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o culto" />
                    </SelectTrigger>
                    <SelectContent>
                      {cultos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.titulo} -{" "}
                          {format(new Date(c.data_evento), "dd/MM HH:mm")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resumo */}
              <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                <h4 className="font-medium text-sm">Resumo da Aula</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Tema:</strong> {tema}
                  </p>
                  {jornadaId && (
                    <p>
                      <strong>Jornada:</strong>{" "}
                      {jornadas.find((j) => j.id === jornadaId)?.titulo}
                    </p>
                  )}
                  <p>
                    <strong>Data:</strong> {dataInicio} às {horaInicio}
                  </p>
                  <p>
                    <strong>Duração:</strong> {duracao} minutos
                  </p>
                  <p>
                    <strong>Modalidade:</strong>{" "}
                    {modalidade === "presencial"
                      ? "Presencial"
                      : modalidade === "online"
                      ? "Online"
                      : "Híbrido"}
                  </p>
                  {(modalidade === "presencial" || modalidade === "hibrido") &&
                    salaId && (
                      <p>
                        <strong>Sala:</strong>{" "}
                        {salas.find((s) => s.id === salaId)?.nome}
                      </p>
                    )}
                  {(modalidade === "online" || modalidade === "hibrido") &&
                    linkReuniao && (
                      <p>
                        <strong>Link:</strong> {linkReuniao}
                      </p>
                    )}
                  {vinculadoCulto && cultoId && (
                    <p>
                      <strong>Evento:</strong>{" "}
                      {cultos.find((c) => c.id === cultoId)?.titulo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t">
          <div className="flex gap-2 w-full">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
              >
                Voltar
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex-1"
              >
                Próximo
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Salvando..." : "Agendar Aula"}
              </Button>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" className="w-full">
              Cancelar
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
