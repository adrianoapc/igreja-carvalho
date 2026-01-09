import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, Video, FileText, ArrowRight, Plus, MonitorPlay } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import { motion } from "framer-motion";

export default function Midias() {
  const navigate = useNavigate();
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const [stats, setStats] = useState({
    totalMidias: 0,
    midiasApp: 0,
    midiasRedesSociais: 0,
    midiasTelao: 0,
    midiasSite: 0,
  });

  useEffect(() => {
    if (!filialLoading && igrejaId) {
      fetchStats();
    }
  }, [igrejaId, filialId, isAllFiliais, filialLoading]);

  const fetchStats = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("midias")
        .select("canal, ativo")
        .eq("igreja_id", igrejaId);
      
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data: midias } = await query;

      const total = midias?.length || 0;
      const app = midias?.filter(m => m.canal === "app" && m.ativo).length || 0;
      const redes = midias?.filter(m => m.canal === "redes_sociais" && m.ativo).length || 0;
      const telao = midias?.filter(m => m.canal === "telao" && m.ativo).length || 0;
      const site = midias?.filter(m => m.canal === "site" && m.ativo).length || 0;

      setStats({
        totalMidias: total,
        midiasApp: app,
        midiasRedesSociais: redes,
        midiasTelao: telao,
        midiasSite: site,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  };

  const modules = [
    {
      title: "Geral",
      description: "Visão geral e gerenciamento de todas as mídias",
      icon: Image,
      path: "/midias/geral",
      stats: [
        { label: "Total", value: stats.totalMidias, color: "text-primary" },
      ],
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "App",
      description: "Mídias exibidas no aplicativo da igreja",
      icon: MonitorPlay,
      path: "/midias/geral?canal=app",
      stats: [
        { label: "Ativas", value: stats.midiasApp, color: "text-blue-600" },
      ],
      color: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600",
    },
    {
      title: "Redes Sociais",
      description: "Conteúdo para Instagram, Facebook e outras redes",
      icon: Image,
      path: "/midias/geral?canal=redes_sociais",
      stats: [
        { label: "Ativas", value: stats.midiasRedesSociais, color: "text-purple-600" },
      ],
      color: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600",
    },
    {
      title: "Telão",
      description: "Avisos e mídias para projeção durante cultos",
      icon: MonitorPlay,
      path: "/midias/geral?canal=telao",
      stats: [
        { label: "Ativas", value: stats.midiasTelao, color: "text-green-600" },
      ],
      color: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
    },
    {
      title: "Site",
      description: "Imagens e vídeos para o site da igreja",
      icon: Video,
      path: "/midias/geral?canal=site",
      stats: [
        { label: "Ativas", value: stats.midiasSite, color: "text-orange-600" },
      ],
      color: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0 relative pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Mídias</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gestão completa de conteúdo visual e comunicação
          </p>
        </div>
        <Button 
          onClick={() => navigate("/midias/geral?novo=true")}
          className="hidden md:flex"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Mídia
        </Button>
      </div>

      {/* Módulos principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.path}
              className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
              onClick={() => navigate(module.path)}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-3 rounded-lg ${module.color} flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${module.iconColor}`} />
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
                <h3 className="font-semibold text-base md:text-lg mb-1">{module.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground mb-3">
                  {module.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {module.stats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{stat.label}:</span>
                      <Badge variant="outline" className={`text-xs ${stat.color}`}>
                        {stat.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tipos de Mídia */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Tipos de Mídia Suportados</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/20">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Imagens</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-purple-100 dark:bg-purple-900/20">
                <Video className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Vídeos</p>
                <p className="text-xs text-muted-foreground">MP4, WEBM, MOV</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Documentos</p>
                <p className="text-xs text-muted-foreground">PDF</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Flutuante Mobile */}
      <motion.div
        className="fixed bottom-20 right-4 md:hidden z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button 
          onClick={() => navigate("/midias/geral?novo=true")}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </motion.div>
    </div>
  );
}