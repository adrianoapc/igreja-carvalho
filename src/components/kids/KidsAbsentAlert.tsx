import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, MessageCircle } from "lucide-react";

interface AbsentKid {
  child_id: string;
  full_name: string;
  alergias: string | null;
  last_visit: string;
  days_absent: number;
  parent_name: string | null;
  parent_phone: string | null;
}

export function KidsAbsentAlert() {
  const [absentKids, setAbsentKids] = useState<AbsentKid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAbsentKids();
  }, []);

  const fetchAbsentKids = async () => {
    try {
      const { data, error } = await supabase
        .from("view_absent_kids")
        .select("*")
        .order("days_absent", { ascending: false });

      if (error) throw error;
      setAbsentKids(data || []);
    } catch (error) {
      console.error("Error fetching absent kids:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = (phone: string | null, childName: string) => {
    if (!phone) return;
    
    const cleanPhone = phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá! Sentimos sua falta no ministério infantil. ${childName} não nos visita há algum tempo. Gostaríamos de saber como vocês estão! 💙`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, "_blank");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Atenção Necessária
          </CardTitle>
          <CardDescription>Crianças ausentes há mais de 14 dias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (absentKids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Atenção Necessária
          </CardTitle>
          <CardDescription>Crianças ausentes há mais de 14 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma criança ausente no período. Ótimo! 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Atenção Necessária
        </CardTitle>
        <CardDescription>
          {absentKids.length} criança(s) ausente(s) há mais de 14 dias
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {absentKids.map((kid) => (
          <div 
            key={kid.child_id} 
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50"
          >
            <div className="space-y-1">
              <p className="font-medium">{kid.full_name}</p>
              <p className="text-xs text-muted-foreground">
                Última visita: {formatDate(kid.last_visit)} ({kid.days_absent} dias)
              </p>
              {kid.parent_name && (
                <p className="text-xs text-muted-foreground">
                  Responsável: {kid.parent_name}
                </p>
              )}
            </div>
            {kid.parent_phone && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 shrink-0"
                onClick={() => handleWhatsApp(kid.parent_phone, kid.full_name)}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
