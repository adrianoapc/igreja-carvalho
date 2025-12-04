import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface RoomOccupancy {
  sala_id: string;
  room_name: string;
  capacity: number;
  current_count: number;
  occupancy_rate: number;
}

export function KidsRoomOccupancy() {
  const [rooms, setRooms] = useState<RoomOccupancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOccupancy();
  }, []);

  const fetchOccupancy = async () => {
    try {
      const { data, error } = await supabase
        .from("view_room_occupancy")
        .select("*");

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error("Error fetching room occupancy:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ocupação das Salas</CardTitle>
          <CardDescription>Capacidade em tempo real</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rooms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ocupação das Salas</CardTitle>
          <CardDescription>Capacidade em tempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhuma sala ativa no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ocupação das Salas</CardTitle>
        <CardDescription>Capacidade em tempo real</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rooms.map((room) => {
          const isHighOccupancy = room.occupancy_rate >= 80;
          
          return (
            <div key={room.sala_id} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">{room.room_name}</span>
                <span className={isHighOccupancy ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {room.current_count}/{room.capacity}
                </span>
              </div>
              <Progress 
                value={room.occupancy_rate}
                className={`h-2 ${isHighOccupancy ? "[&>div]:bg-destructive" : ""}`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
