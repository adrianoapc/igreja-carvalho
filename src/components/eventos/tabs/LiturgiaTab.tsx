import LiturgiaTabContent from "@/components/cultos/LiturgiaTabContent";

interface LiturgiaTabProps {
  eventoId: string;
}

export default function LiturgiaTab({ eventoId }: LiturgiaTabProps) {
  return <LiturgiaTabContent eventoId={eventoId} />;
}
