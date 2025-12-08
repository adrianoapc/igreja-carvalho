import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X, Check, Loader2, Baby, AlertTriangle, Printer, LogIn, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Child {
  id: string;
  nome: string;
  data_nascimento: string | null;
  avatar_url: string | null;
  alergias: string | null;
  sexo: string | null;
  tipo_parentesco: string;
}

interface ActiveCheckin {
  id: string;
  crianca_id: string;
  checkin_at: string;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function KidsCheckinScanner() {
  const { profile, hasAccess } = useAuth();
  const navigate = useNavigate();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(true);
  const [activeCheckinsMap, setActiveCheckinsMap] = useState<Map<string, ActiveCheckin>>(new Map());
  const [isCheckoutMode, setIsCheckoutMode] = useState(false);

  // Culto do dia - obrigatório para permitir check-in
  const { data: cultoHoje, isLoading: cultoLoading } = useQuery({
    queryKey: ["culto-hoje"],
    queryFn: async () => {
      const agora = new Date();
      const inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(agora);
      fim.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("cultos")
        .select("id, titulo, data_culto, status")
        .gte("data_culto", inicio.toISOString())
        .lte("data_culto", fim.toISOString())
        .in("status", ["planejado", "confirmado"])
        .order("data_culto", { ascending: true })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });

  // Desabilitar scanner se não houver culto hoje
  useEffect(() => {
    if (!cultoLoading) {
      setIsScannerActive(!!cultoHoje);
      if (!cultoHoje) {
        setDrawerOpen(false);
        setScannedId(null);
        setSelectedChildren(new Set());
      }
    }
  }, [cultoHoje, cultoLoading]);

  // Buscar check-ins ativos das crianças do responsável escaneado
  const { data: activeCheckins } = useQuery({
    queryKey: ["active-checkins", scannedId],
    queryFn: async () => {
      if (!scannedId) return [];

      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("kids_checkins")
        .select("id, crianca_id, checkin_at")
        .eq("responsavel_id", scannedId)
        .gte("checkin_at", `${today}T00:00:00`)
        .is("checkout_at", null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!scannedId,
  });

  // Atualizar mapa de check-ins ativos
  useEffect(() => {
    if (activeCheckins) {
      const map = new Map<string, ActiveCheckin>();
      activeCheckins.forEach((checkin) => {
        map.set(checkin.crianca_id, checkin);
      });
      setActiveCheckinsMap(map);
      
      // Determinar se é modo check-out (pelo menos uma criança já está checked-in)
      setIsCheckoutMode(activeCheckins.length > 0);
    }
  }, [activeCheckins]);

  // Buscar crianças quando um QR Code for escaneado
  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ["scanned-children", scannedId],
    queryFn: async () => {
      if (!scannedId) return [];

      const { data: relationships, error: relError } = await supabase
        .from("familias")
        .select("tipo_parentesco, familiar_id")
        .eq("pessoa_id", scannedId);

      if (relError) throw relError;
      if (!relationships || relationships.length === 0) return [];

      const familiarIds = relationships.map((r) => r.familiar_id).filter(Boolean);
      if (familiarIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, data_nascimento, avatar_url, alergias, sexo")
        .in("id", familiarIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Filtrar apenas crianças (menores de 12 anos)
      return relationships
        .filter((r) => r.familiar_id && profileMap.has(r.familiar_id))
        .map((r) => {
          const familiar = profileMap.get(r.familiar_id)!;
          return {
            id: familiar.id,
            nome: familiar.nome,
            data_nascimento: familiar.data_nascimento,
            avatar_url: familiar.avatar_url,
            alergias: familiar.alergias,
            sexo: familiar.sexo,
            tipo_parentesco: r.tipo_parentesco,
          };
        })
        .filter((child) => {
          const age = calculateAge(child.data_nascimento);
          return age !== null && age < 12;
        }) as Child[];
    },
    enabled: !!scannedId,
  });

  // Abrir drawer quando crianças forem carregadas
  useEffect(() => {
    if (children && children.length > 0 && !drawerOpen) {
      setDrawerOpen(true);
      setIsScannerActive(false);
    } else if (children && children.length === 0 && scannedId) {
      toast.error("Nenhuma criança encontrada para este usuário");
      setScannedId(null);
      setIsScannerActive(true);
    }
  }, [children, scannedId, drawerOpen]);

  const handleScan = (result: string) => {
    if (result && !scannedId && isScannerActive) {
      setScannedId(result);
      setIsScannerActive(false);
    }
  };

  const handleError = (error: Error) => {
    console.error("QR Scanner error:", error);
    toast.error("Erro ao acessar a câmera. Verifique as permissões.");
  };

  const toggleChild = (childId: string) => {
    const newSelected = new Set(selectedChildren);
    if (newSelected.has(childId)) {
      newSelected.delete(childId);
    } else {
      newSelected.add(childId);
    }
    setSelectedChildren(newSelected);
  };

  const handleCheckin = async () => {
    if (!cultoHoje) {
      toast.error("Não há culto aberto hoje. Cadastre o culto antes do check-in.");
      return;
    }

    if (selectedChildren.size === 0) {
      toast.error("Selecione pelo menos uma criança");
      return;
    }

    setIsProcessing(true);

    try {
      const selectedChildrenArray = Array.from(selectedChildren);
      const childNames = children
        ?.filter((c) => selectedChildren.has(c.id))
        .map((c) => c.nome.split(" ")[0]);

      if (isCheckoutMode) {
        // MODO CHECK-OUT: Atualizar registros existentes
        const checkoutPromises = selectedChildrenArray
          .map((childId) => {
            const checkin = activeCheckinsMap.get(childId);
            if (!checkin) return null;

            return supabase
              .from("kids_checkins")
              .update({
                checkout_at: new Date().toISOString(),
                checkout_por: profile?.id || null,
              })
              .eq("id", checkin.id);
          })
          .filter((p) => p !== null);

        const results = await Promise.all(checkoutPromises);
        const firstError = results.find((r) => r && r.error)?.error;
        if (firstError) {
          console.error("Erro Supabase (checkout kids_checkins):", firstError);
          toast.error(`Erro ao registrar saída: ${firstError.message || "desconhecido"}`);
          throw firstError;
        }

        // Mensagem carinhosa de saída
        const namesStr = childNames?.join(", ");
        toast.success(`Saída confirmada. Até logo, ${namesStr}! 👋`, {
          description: "Foi uma bênção ter você conosco.",
          duration: 6000,
        });
      } else {
        // MODO CHECK-IN: Criar novos registros
        // 1. Criar kids_checkins
        const checkins = selectedChildrenArray.map((childId) => ({
          crianca_id: childId,
          responsavel_id: scannedId,
          culto_id: cultoHoje.id,
          checkin_por: profile?.id || null,
        }));

        const { error: checkinError } = await supabase
          .from("kids_checkins")
          .insert(checkins);

        if (checkinError) {
          console.error("Erro Supabase (kids_checkins):", checkinError);
          toast.error(`Erro ao registrar check-in: ${checkinError.message || "desconhecido"}`);
          throw checkinError;
        }

        // 2. Criar presencas_culto (único por criança por culto)
        const presencas = selectedChildrenArray.map((childId) => ({
          culto_id: cultoHoje.id,
          pessoa_id: childId,
          metodo: "qrcode",
          // Evita FK inválida caso o perfil do usuário não esteja em profiles
          validado_por: profile?.id ? profile.id : null,
        }));

        const { error: presencaError } = await supabase
          .from("presencas_culto")
          .insert(presencas)
          .select();

        if (presencaError) {
          console.error("Erro Supabase (presencas_culto):", presencaError);
          toast.error(`Erro ao registrar presença: ${presencaError.message || "desconhecido"}`);
          // Não lançar erro - a presença pode já existir
        }

        // Mensagem calorosa de boas-vindas
        const namesStr = childNames?.join(", ");
        toast.success(`Bem-vindo(a), ${namesStr}! 🎉`, {
          description: "Que alegria ter você aqui hoje!",
          duration: 6000,
        });
      }

      // Reset
      setSelectedChildren(new Set());
      setDrawerOpen(false);
      setScannedId(null);
      setIsScannerActive(true);
      setActiveCheckinsMap(new Map());
      setIsCheckoutMode(false);
    } catch (error: any) {
      console.error("Erro ao processar:", error);
      toast.error(error.message || "Erro ao processar operação");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setDrawerOpen(false);
    setScannedId(null);
    setSelectedChildren(new Set());
    setIsScannerActive(true);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* Scanner de QR Code */}
      {isScannerActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full max-w-2xl">
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) {
                  handleScan(result[0].rawValue);
                }
              }}
              onError={handleError}
              styles={{
                container: {
                  width: "100%",
                  height: "100%",
                },
                video: {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            />
          </div>

          {/* Overlay com instruções */}
          <div className="absolute inset-0 flex flex-col items-center justify-between pointer-events-none">
            <div className="w-full bg-gradient-to-b from-black/80 to-transparent p-6">
              <div className="flex items-center justify-between mb-4 pointer-events-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/kids/dashboard")}
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                <div className="flex-1" />
              </div>
              <h1 className="text-white text-2xl font-bold text-center">
                Kids Check-in
              </h1>
              <p className="text-white/80 text-center mt-2">
                Aponte a câmera para o QR Code do Passaporte
              </p>
            </div>

            {/* Frame de escaneamento */}
            <div className="relative w-72 h-72">
              <div className="absolute inset-0 border-4 border-white/30 rounded-3xl" />
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white rounded-br-3xl" />
            </div>

            <div className="w-full bg-gradient-to-t from-black/80 to-transparent p-6">
              <p className="text-white/60 text-sm text-center">
                {childrenLoading ? "Processando..." : "Aguardando escaneamento"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bloqueio quando não há culto hoje */}
      {!cultoLoading && !cultoHoje && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50 p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Nenhum culto aberto hoje</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {hasAccess("cultos", "criar_editar")
                  ? "Cadastre o culto do dia para liberar o check-in das crianças."
                  : "Peça a um organizador para abrir o culto do dia e liberar o check-in."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate("/kids/dashboard")}>Voltar</Button>
                {hasAccess("cultos", "criar_editar") ? (
                  <Button onClick={() => navigate("/cultos/eventos")}>Cadastrar culto</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Overlay */}
      {childrenLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
          <Card className="bg-white">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Carregando informações...
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Drawer de Seleção de Crianças */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="pb-4">
            <DrawerTitle className="text-xl sm:text-2xl flex items-center gap-2">
              <Baby className="w-6 h-6 text-primary" />
              {isCheckoutMode ? "Registrar Saída" : "Confirmar Entrada"}
            </DrawerTitle>
            <DrawerDescription className="text-sm sm:text-base">
              {isCheckoutMode
                ? "Selecione as crianças que estão saindo"
                : "Marque as crianças que estão presentes no culto"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]">
            {children && children.length > 0 ? (
              <div className="space-y-4">
                {children.map((child) => {
                  const age = calculateAge(child.data_nascimento);
                  const initials = child
                    .nome?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                  const isSelected = selectedChildren.has(child.id);
                  const isCheckedIn = activeCheckinsMap.has(child.id);

                  return (
                    <Card
                      key={child.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary border-2 bg-primary/5"
                          : "hover:shadow-md"
                      }`}
                      onClick={() => toggleChild(child.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleChild(child.id)}
                            className="w-6 h-6 mt-1 shrink-0"
                          />

                          <Avatar className="w-16 h-16 border-2 border-primary/20 shrink-0">
                            <AvatarImage
                              src={child.avatar_url || undefined}
                              alt={child.nome}
                            />
                            <AvatarFallback className="bg-orange-100 text-orange-600 font-semibold text-lg">
                              {initials || <Baby className="w-7 h-7" />}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Nome completo em linha única */}
                            <h3 className="font-bold text-base sm:text-lg text-foreground leading-tight">
                              {child.nome}
                            </h3>

                            {/* Badges de status e informações */}
                            <div className="flex flex-wrap items-center gap-2">
                              {isCheckedIn ? (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white">
                                  <LogIn className="w-3 h-3 mr-1" />
                                  Na Sala
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-600 border-gray-300">
                                  <LogOut className="w-3 h-3 mr-1" />
                                  Ausente
                                </Badge>
                              )}
                              
                              {age !== null && (
                                <Badge variant="secondary" className="text-xs">
                                  {age} {age === 1 ? "ano" : "anos"}
                                </Badge>
                              )}
                              
                              {child.sexo && (
                                <Badge variant="outline" className="text-xs">
                                  {child.sexo === "masculino" ? "♂ Menino" : "♀ Menina"}
                                </Badge>
                              )}
                            </div>

                            {/* Alergias em linha separada com destaque */}
                            {child.alergias && (
                              <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
                                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-destructive">Alergia:</p>
                                  <p className="text-sm text-destructive">{child.alergias}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                                <Check className="w-6 h-6 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Baby className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Nenhuma criança encontrada
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DrawerFooter className="gap-2">
            <Button
              onClick={handleCheckin}
              disabled={selectedChildren.size === 0 || isProcessing}
              className={`w-full gap-2 ${
                isCheckoutMode
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-green-500 hover:bg-green-600"
              }`}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : isCheckoutMode ? (
                <>
                  <LogOut className="w-5 h-5" />
                  Registrar Saída ({selectedChildren.size})
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Confirmar Entrada ({selectedChildren.size})
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
              className="w-full"
              size="lg"
            >
              <X className="w-5 h-5 mr-2" />
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
