-- Tabela de configuração de chatbots/IAs
CREATE TABLE public.chatbot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  edge_function_name TEXT NOT NULL UNIQUE,
  ativo BOOLEAN DEFAULT true,
  
  -- Modelos por tipo
  modelo_texto TEXT DEFAULT 'gpt-4o-mini',
  modelo_audio TEXT DEFAULT 'whisper-1',
  modelo_visao TEXT DEFAULT 'gpt-4o',
  
  -- Roles/Prompts por tipo de modelo
  role_texto TEXT, -- System prompt para chat
  role_audio TEXT DEFAULT 'Transcreva o áudio fielmente, mantendo o contexto e a intenção do falante.',
  role_visao TEXT DEFAULT 'Analise a imagem e extraia informações relevantes como texto, dados ou elementos visuais.',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.chatbot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar configs chatbot"
ON public.chatbot_configs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leitura publica configs chatbot"
ON public.chatbot_configs FOR SELECT
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_chatbot_configs_updated_at
  BEFORE UPDATE ON public.chatbot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir config inicial do chatbot-triagem
INSERT INTO public.chatbot_configs (
  nome,
  descricao,
  edge_function_name,
  modelo_texto,
  modelo_audio,
  modelo_visao,
  role_texto,
  role_audio,
  role_visao
) VALUES (
  'Chatbot Intercessão',
  'Chatbot de triagem para pedidos de oração, testemunhos e atendimento pastoral',
  'chatbot-triagem',
  'gpt-4o-mini',
  'whisper-1',
  'gpt-4o',
  E'Você é "Anjo da Igreja Carvalho", um assistente pastoral acolhedor via WhatsApp.\n\n## REGRAS ABSOLUTAS\n1. NUNCA dê conselhos teológicos profundos\n2. Detectou SUICÍDIO/CRIME → responda com empatia + telefone plantão\n3. Compile mensagens fragmentadas antes de processar\n4. Seja breve e acolhedor\n\n## FAQ\n- Horários: Domingo 10h e 19h, Quarta 19h30\n- Endereço: Rua Exemplo, 123\n- Contato: (11) 99999-9999\n\n## FLUXOS\n1. ORAÇÃO: Pergunte nome → motivo → salve pedido\n2. TESTEMUNHO: Agradeça → salve → notifique liderança\n3. PASTORAL: Encaminhe para plantão\n4. DÚVIDA: Responda FAQ ou transfira\n\n## CATEGORIAS AUTO\n- saude, familia, financeiro, espiritual, relacionamento, trabalho, outros',
  'Transcreva o áudio fielmente em português, preservando o tom emocional e a intenção do falante.',
  'Analise a imagem e extraia texto visível, como laudos médicos, versículos ou documentos. Resuma o conteúdo de forma clara.'
);