import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, CheckCircle, Clock, AlertCircle, Download } from "lucide-react";

interface InscricaoData {
  id: string;
  qr_token: string;
  status_pagamento: string;
  pessoa: {
    nome: string;
  } | null;
  evento: {
    titulo: string;
    data_evento: string;
    local: string | null;
    requer_pagamento: boolean;
  } | null;
}

export default function InscricaoPublica() {
  const { token } = useParams<{ token: string }>();

  const { data: inscricao, isLoading, error } = useQuery({
    queryKey: ["inscricao-publica", token],
    queryFn: async (): Promise<InscricaoData | null> => {
      if (!token) return null;

      const { data, error } = await supabase
        .from("inscricoes_eventos")
        .select(`
          id,
          qr_token,
          status_pagamento,
          pessoa:profiles!inscricoes_eventos_pessoa_id_fkey(nome),
          evento:eventos!inscricoes_eventos_evento_id_fkey(titulo, data_evento, local, requer_pagamento)
        `)
        .eq("qr_token", token)
        .maybeSingle();

      if (error) throw error;
      return data as InscricaoData | null;
    },
    enabled: !!token,
    staleTime: 30000,
  });

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `qrcode-inscricao-${token?.slice(0, 8) || "evento"}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-48 w-48 mx-auto bg-muted rounded-lg" />
              <div className="h-6 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !inscricao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Inscrição não encontrada</h1>
            <p className="text-muted-foreground">
              O link pode ter expirado ou a inscrição não existe.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPago = inscricao.status_pagamento === "pago" || inscricao.status_pagamento === "isento";
  const isPendente = inscricao.status_pagamento === "pendente";
  const isCancelado = inscricao.status_pagamento === "cancelado";

  const dataEvento = inscricao.evento?.data_evento
    ? format(new Date(inscricao.evento.data_evento), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : "Data não informada";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{inscricao.evento?.titulo || "Evento"}</CardTitle>
          <p className="text-sm text-muted-foreground">Comprovante de Inscrição</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            {isPago ? (
              <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Inscrição Confirmada</span>
              </div>
            ) : isPendente ? (
              <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-full">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Pagamento Pendente</span>
              </div>
            ) : isCancelado ? (
              <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-full">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Inscrição Cancelada</span>
              </div>
            ) : null}
          </div>

          {/* QR Code */}
          {!isCancelado && (
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={`${window.location.origin}/eventos/checkin/${inscricao.qr_token}`}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
            </div>
          )}

          {/* Informações */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Participante</p>
                <p className="font-medium">{inscricao.pessoa?.nome || "Não informado"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Data e Horário</p>
                <p className="font-medium capitalize">{dataEvento}</p>
              </div>
            </div>

            {inscricao.evento?.local && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="font-medium">{inscricao.evento.local}</p>
                </div>
              </div>
            )}
          </div>

          {/* Download Button */}
          {!isCancelado && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleDownloadQR}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar QR Code
            </Button>
          )}

          {/* Aviso de Pagamento */}
          {isPendente && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Atenção:</strong> Sua vaga está reservada por 24 horas.
                Efetue o pagamento para garantir sua participação.
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-center text-muted-foreground">
            Apresente este QR Code na entrada do evento
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
