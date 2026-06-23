/**
 * Conteúdo da Política de Privacidade — Igreja Carvalho
 *
 * Para atualizar o texto: edite as strings abaixo.
 * Cada entrada em `sections` vira uma seção com <h2> e parágrafos.
 * Use \n\n dentro de uma string para criar parágrafos separados.
 *
 * Substitua os marcadores entre colchetes com os dados reais da igreja:
 *   [NOME JURÍDICO]   → razão social no CNPJ
 *   [CNPJ]            → CNPJ da pessoa jurídica
 *   [ENDEREÇO]        → endereço completo
 *   [EMAIL DPO]       → e-mail do Encarregado (DPO) — pode ser o do pastor/secretaria
 */

export const PRIVACY_META = {
  lastUpdated: "2026-06-22",
  lastUpdatedLabel: "22 de junho de 2026",
  controller: "Igreja Carvalho",
  dpoEmail: "dpo@igrejacarvalho.com.br",
};

export interface PolicySection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const PRIVACY_SECTIONS: PolicySection[] = [
  {
    id: "apresentacao",
    title: "1. Quem somos",
    paragraphs: [
      "A Igreja Carvalho (Igreja Carvalho, CNPJ 60.103.122/0001-35, com sede em São José do Rio Preto, SP, na Avenida Gabriel Jorge Cury, 232) é a controladora dos dados pessoais tratados neste site e em nossos canais de atendimento.",
      "Esta Política descreve quais dados coletamos, por que, por quanto tempo os guardamos e quais são seus direitos como titular, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).",
    ],
  },
  {
    id: "dados-coletados",
    title: "2. Dados que coletamos e por quê",
    paragraphs: [
      "Formulário de Pedido de Oração: coletamos nome (opcional), mensagem do pedido e contato opcional (e-mail ou WhatsApp). A base legal é o consentimento do titular (art. 7º, II da LGPD). Pedidos marcados como “confidencial” são acessíveis somente ao pastor responsável.",
      "WhatsApp (via Make/n8n): quando você envia um pedido de oração pelo nosso número de WhatsApp, coletamos seu nome e número de telefone. A base legal é o legítimo interesse no ministério de intercessão (art. 10 da LGPD), dado que o contato é iniciado por você.",
      "Agenda e inscrições: ao se inscrever em um evento, coletamos nome, e-mail e informações do evento. A base legal é a execução do serviço solicitado (art. 7º, V).",
      "Formulário de contato e outros: dados informados voluntariamente por você. Base legal: consentimento (art. 7º, II).",
      "Dados técnicos: endereço IP, tipo de navegador e páginas visitadas, coletados automaticamente para segurança e desempenho (verificação anti-bot Turnstile). Não os associamos a identidades pessoais.",
    ],
  },
  {
    id: "cookies",
    title: "3. Cookies e tecnologias similares",
    paragraphs: [
      "Cookies essenciais: necessários para o funcionamento do site (sessão, segurança, verificação anti-bot Cloudflare Turnstile). Não requerem consentimento e não podem ser desativados.",
      "Cookies de terceiros (não essenciais): ao aceitar no banner de cookies, conteúdos de YouTube e Instagram são carregados. Esses serviços podem instalar seus próprios cookies conforme suas políticas de privacidade. Você pode recusar esses cookies — o conteúdo multimídia não será exibido, mas o site continuará funcional.",
      "Você pode alterar sua preferência a qualquer momento limpando os dados do site no seu navegador, ou pela opção “Gerenciar cookies” disponível no rodapé.",
    ],
  },
  {
    id: "retencao",
    title: "4. Por quanto tempo guardamos seus dados",
    paragraphs: [
      "Pedidos de oração: 12 meses a partir do envio. Após esse prazo, registros confidenciais são excluídos permanentemente; os demais são anonimizados (nome e contato removidos) para fins estatísticos do ministério.",
      "Inscrições em eventos: enquanto o evento for relevante para o ministério, ou até você solicitar a exclusão.",
      "Logs técnicos: até 90 dias, exclusivamente para fins de segurança.",
    ],
  },
  {
    id: "compartilhamento",
    title: "5. Com quem compartilhamos",
    paragraphs: [
      "Não vendemos nem cedemos seus dados pessoais a terceiros para fins comerciais.",
      "Compartilhamos apenas com: (a) nossa equipe interna de intercessão e liderança, conforme necessário ao ministério; (b) fornecedores de infraestrutura (Supabase/PostgreSQL para banco de dados, Cloudflare para segurança), que atuam como operadores e estão contratualmente obrigados a proteger seus dados; (c) autoridades públicas, quando exigido por lei.",
    ],
  },
  {
    id: "direitos",
    title: "6. Seus direitos (LGPD art. 18)",
    paragraphs: [
      "Você tem direito a: confirmar a existência de tratamento; acessar seus dados; corrigir dados incompletos ou inexatos; solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; revogar o consentimento a qualquer momento (o que não afeta a legalidade do tratamento anterior); obter informações sobre compartilhamento com terceiros; e se opor a tratamento baseado em outras hipóteses legais.",
      "Para exercer seus direitos, envie e-mail para [EMAIL DPO] com o assunto “LGPD — Direitos do Titular”. Responderemos em até 15 dias úteis.",
    ],
  },
  {
    id: "seguranca",
    title: "7. Segurança",
    paragraphs: [
      "Adotamos medidas técnicas e administrativas para proteger seus dados: controle de acesso por perfil (admin, pastor, intercessor), Row Level Security no banco de dados, comunicação criptografada (TLS), e verificação anti-bot nas entradas públicas.",
      "Pedidos confidenciais são visíveis somente ao pastor, independentemente de quem esteja designado como intercessor.",
    ],
  },
  {
    id: "encarregado",
    title: "8. Encarregado (DPO)",
    paragraphs: [
      "O Encarregado pelo tratamento de dados pessoais da Igreja Carvalho pode ser contatado pelo e-mail [EMAIL DPO]. É o ponto de contato para titulares e para a Autoridade Nacional de Proteção de Dados (ANPD).",
    ],
  },
  {
    id: "atualizacoes",
    title: "9. Atualizações desta Política",
    paragraphs: [
      "Esta Política pode ser atualizada para refletir mudanças legais ou em nossos serviços. A data da última atualização aparece no topo desta página. Mudanças significativas serão comunicadas pelo site ou pelo nosso canal de WhatsApp.",
    ],
  },
];
