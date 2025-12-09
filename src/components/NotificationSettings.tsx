import { useEffect, useState } from "react";
import { Bell, BellOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationSettings() {
  const { pushEnabled, requestPushPermission } = useNotifications();
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Verificar suporte a notificações
    const supported = "Notification" in window;
    setNotificationSupported(supported);

    if (supported) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const handleEnablePushNotifications = async () => {
    await requestPushPermission();
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  };

  if (!notificationSupported) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            Notificações não suportadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-yellow-800">
            Seu navegador não suporta notificações push. Use um navegador moderno como Chrome, Firefox ou Safari.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas em tempo real sobre atividades do ministério Kids
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Status</p>
            <p className="text-sm text-gray-500 mt-1">
              {pushEnabled ? "Notificações ativadas" : "Notificações desativadas"}
            </p>
          </div>
          <Badge
            variant={pushEnabled ? "default" : "secondary"}
            className="gap-1"
          >
            {pushEnabled ? (
              <>
                <Bell className="h-3 w-3" /> Ativo
              </>
            ) : (
              <>
                <BellOff className="h-3 w-3" /> Inativo
              </>
            )}
          </Badge>
        </div>

        {/* Permissão */}
        <div className="border-t pt-4">
          <p className="font-medium text-sm mb-2">Permissão do navegador</p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-3">
              Status: <Badge variant="outline">{permissionStatus}</Badge>
            </p>

            {permissionStatus === "denied" && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                <p className="text-sm text-red-800">
                  Notificações foram bloqueadas no navegador. Verifique as configurações do seu navegador
                  para reativar permissões de notificação.
                </p>
              </div>
            )}

            {permissionStatus === "granted" && (
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                <p className="text-sm text-green-800">
                  ✅ Você está autorizado a receber notificações push.
                </p>
              </div>
            )}

            {permissionStatus === "default" && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-sm text-blue-800">
                  Clique no botão abaixo para autorizar notificações do navegador.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tipos de notificação */}
        <div className="border-t pt-4">
          <p className="font-medium text-sm mb-2">Você receberá notificações para:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 bg-blue-400 rounded-full" />
              📔 Diário de Classe (quando professor registra)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 bg-green-400 rounded-full" />
              ✅ Check-out confirmado (quando criança sai)
            </li>
          </ul>
        </div>

        {/* Botão de ação */}
        {permissionStatus !== "granted" && (
          <div className="border-t pt-4">
            <Button
              onClick={handleEnablePushNotifications}
              disabled={permissionStatus === "denied"}
              className="w-full"
              variant={permissionStatus === "denied" ? "secondary" : "default"}
            >
              {permissionStatus === "denied"
                ? "Notificações bloqueadas no navegador"
                : "Ativar Notificações Push"}
            </Button>
          </div>
        )}

        {/* Dica */}
        <div className="bg-gray-50 rounded p-3 border border-gray-200">
          <p className="text-xs text-gray-600">
            💡 <strong>Dica:</strong> Mantenha o app aberto em uma aba para receber notificações em tempo real.
            Você verá um aviso visual e sonoro quando algo importante acontecer.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
