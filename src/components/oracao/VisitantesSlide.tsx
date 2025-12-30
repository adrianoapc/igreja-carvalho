import { UserPlus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Visitante {
  id?: string;
  nome: string;
  estagio_funil?: string;
  data_primeira_visita?: string;
}

export function VisitantesSlide({ visitantes }: { visitantes: Visitante[] }) {
  if (!visitantes || visitantes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 animate-in slide-in-from-right duration-700">
        <div className="flex items-center gap-3 mb-8 text-blue-400">
          <div className="p-3 bg-blue-500/20 rounded-full">
            <UserPlus className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-widest">
            Vidas Preciosas
          </h2>
        </div>

        <div className="text-center">
          <p className="text-lg text-white/60">
            Nenhum visitante neste período
          </p>
          <p className="text-sm text-white/40 mt-2">
            Ore pela chegada de novas vidas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 animate-in slide-in-from-right duration-700">
      <div className="flex items-center gap-3 mb-8 text-blue-400">
        <div className="p-3 bg-blue-500/20 rounded-full">
          <UserPlus className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold uppercase tracking-widest">
          Vidas Preciosas
        </h2>
      </div>

      <div className="text-center mb-8">
        <p className="text-xl md:text-3xl font-serif text-white/90 leading-relaxed max-w-2xl mx-auto">
          "O Senhor acrescentava-lhes dia a dia os que iam sendo salvos."
        </p>
        <p className="text-sm text-white/50 mt-4">Atos 2:47</p>
      </div>

      <div className="grid gap-4 w-full max-w-lg max-h-[50vh] overflow-y-auto">
        {visitantes.map((v, idx) => (
          <Card
            key={v.id || idx}
            className="bg-white/5 border-white/10 p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {v.nome.charAt(0).toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-lg text-white truncate">
                  {v.nome}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wide">
                  {v.estagio_funil === "NOVO"
                    ? "🆕 Primeira Visita"
                    : "📋 Em Acompanhamento"}
                </p>
              </div>
            </div>
            {v.estagio_funil === "NOVO" && (
              <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse shrink-0 ml-2" />
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-white/30">
          Ore para que eles se sintam amados e criem raízes.
        </p>
        <p className="text-xs text-white/20">
          Total de visitantes:{" "}
          <span className="font-bold text-blue-400">{visitantes.length}</span>
        </p>
      </div>
    </div>
  );
}
