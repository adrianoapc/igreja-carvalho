import { Seo } from "@/components/Seo";
import { ContatoSection } from "@/components/public/ContatoSection";

export function PublicContato() {
  return (
    <>
      <Seo
        title="Onde estamos — Igreja Carvalho"
        description="Endereço, horários de culto e contato da Igreja Carvalho em São José do Rio Preto/SP."
        url="https://igrejacarvalho.com.br/contato"
      />
      <ContatoSection />
    </>
  );
}
