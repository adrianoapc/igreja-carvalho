import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Construction, Lock, ArrowRight } from "lucide-react";
import logoCarvalho from "@/assets/logo-carvalho.png";

interface MaintenanceProps {
  message?: string | null;
}

export default function Maintenance({ message }: MaintenanceProps) {
  const navigate = useNavigate();

  const defaultMessage = 
    "Estamos realizando manutenção no sistema para melhorar sua experiência. " +
    "Voltaremos em breve!";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-0">
        <CardContent className="p-8 md:p-12">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src={logoCarvalho} 
              alt="Igreja Carvalho" 
              className="h-20 w-auto"
            />
          </div>

          {/* Ícone de Manutenção */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full"></div>
              <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-full">
                <Construction className="w-12 h-12 text-white animate-pulse" />
              </div>
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
            Sistema em Manutenção
          </h1>

          {/* Mensagem */}
          <p className="text-center text-slate-600 text-lg mb-8 leading-relaxed">
            {message || defaultMessage}
          </p>

          {/* Informações Adicionais */}
          <div className="bg-slate-50 rounded-lg p-6 mb-8 border border-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <Lock className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">
                  Acesso Temporariamente Restrito
                </h3>
                <p className="text-sm text-slate-600">
                  O sistema está passando por melhorias. Membros e visitantes 
                  podem continuar usando os formulários de cadastro.
                </p>
              </div>
            </div>
          </div>

          {/* Botão para Admin/Técnico */}
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="outline"
              size="lg"
              className="w-full group"
            >
              <Lock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Área Administrativa
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>

            <p className="text-xs text-center text-slate-500">
              Apenas administradores e técnicos podem acessar durante a manutenção
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-500">
              Em caso de urgência, entre em contato com a administração
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
