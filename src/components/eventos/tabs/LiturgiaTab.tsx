import LiturgiaTabContent from "@/components/eventos/LiturgiaTabContent";

interface LiturgiaTabProps {
  eventoId: string;
}

export default function LiturgiaTab({ eventoId }: LiturgiaTabProps) {
  return <LiturgiaTabContent eventoId={eventoId} />;
}
