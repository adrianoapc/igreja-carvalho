export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agenda_pastoral: {
        Row: {
          cor: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          pastor_id: string
          tipo: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          pastor_id: string
          tipo?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          pastor_id?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_pastoral_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_pastoral_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "agenda_pastoral_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "agenda_pastoral_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_pastoral_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_pastoral_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_pastoral_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "agenda_pastoral_pastor_id_fkey"
            columns: ["pastor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      alteracoes_perfil_pendentes: {
        Row: {
          aprovado_por: string | null
          campos_aprovados: Json | null
          created_at: string | null
          dados_antigos: Json
          dados_novos: Json
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          profile_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aprovado_por?: string | null
          campos_aprovados?: Json | null
          created_at?: string | null
          dados_antigos: Json
          dados_novos: Json
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          profile_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aprovado_por?: string | null
          campos_aprovados?: Json | null
          created_at?: string | null
          dados_antigos?: Json
          dados_novos?: Json
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          profile_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alteracoes_perfil_pendentes_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alteracoes_perfil_pendentes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alteracoes_perfil_pendentes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alteracoes_perfil_pendentes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "alteracoes_perfil_pendentes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      app_config: {
        Row: {
          allow_public_access: boolean | null
          created_at: string | null
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allow_public_access?: boolean | null
          created_at?: string | null
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allow_public_access?: boolean | null
          created_at?: string | null
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      app_permissions: {
        Row: {
          description: string | null
          id: number
          key: string
          module: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: number
          key: string
          module: string
          name: string
        }
        Update: {
          description?: string | null
          id?: number
          key?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      atendimentos_bot: {
        Row: {
          created_at: string | null
          filial_id: string | null
          historico_conversa: Json | null
          id: string
          igreja_id: string | null
          meta_dados: Json | null
          origem_canal: string | null
          pessoa_id: string | null
          status: Database["public"]["Enums"]["status_sessao_chat"] | null
          telefone: string
          ultima_mensagem_at: string | null
          updated_at: string | null
          visitante_id: string | null
        }
        Insert: {
          created_at?: string | null
          filial_id?: string | null
          historico_conversa?: Json | null
          id?: string
          igreja_id?: string | null
          meta_dados?: Json | null
          origem_canal?: string | null
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_sessao_chat"] | null
          telefone: string
          ultima_mensagem_at?: string | null
          updated_at?: string | null
          visitante_id?: string | null
        }
        Update: {
          created_at?: string | null
          filial_id?: string | null
          historico_conversa?: Json | null
          id?: string
          igreja_id?: string | null
          meta_dados?: Json | null
          origem_canal?: string | null
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_sessao_chat"] | null
          telefone?: string
          ultima_mensagem_at?: string | null
          updated_at?: string | null
          visitante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_bot_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_bot_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_bot_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_bot_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "atendimentos_bot_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "atendimentos_bot_visitante_id_fkey"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "visitantes_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_pastorais: {
        Row: {
          conteudo_original: string | null
          created_at: string | null
          data_agendamento: string | null
          filial_id: string | null
          gravidade: Database["public"]["Enums"]["gravidade_enum"] | null
          historico_evolucao: Json | null
          id: string
          igreja_id: string | null
          local_atendimento: string | null
          motivo_resumo: string | null
          observacoes_internas: string | null
          origem: string | null
          pastor_responsavel_id: string | null
          pessoa_id: string | null
          sessao_bot_id: string | null
          status: Database["public"]["Enums"]["status_atendimento_enum"] | null
          updated_at: string | null
          visitante_id: string | null
        }
        Insert: {
          conteudo_original?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          filial_id?: string | null
          gravidade?: Database["public"]["Enums"]["gravidade_enum"] | null
          historico_evolucao?: Json | null
          id?: string
          igreja_id?: string | null
          local_atendimento?: string | null
          motivo_resumo?: string | null
          observacoes_internas?: string | null
          origem?: string | null
          pastor_responsavel_id?: string | null
          pessoa_id?: string | null
          sessao_bot_id?: string | null
          status?: Database["public"]["Enums"]["status_atendimento_enum"] | null
          updated_at?: string | null
          visitante_id?: string | null
        }
        Update: {
          conteudo_original?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          filial_id?: string | null
          gravidade?: Database["public"]["Enums"]["gravidade_enum"] | null
          historico_evolucao?: Json | null
          id?: string
          igreja_id?: string | null
          local_atendimento?: string | null
          motivo_resumo?: string | null
          observacoes_internas?: string | null
          origem?: string | null
          pastor_responsavel_id?: string | null
          pessoa_id?: string | null
          sessao_bot_id?: string | null
          status?: Database["public"]["Enums"]["status_atendimento_enum"] | null
          updated_at?: string | null
          visitante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_pastorais_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_sessao_bot_id_fkey"
            columns: ["sessao_bot_id"]
            isOneToOne: false
            referencedRelation: "atendimentos_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_visitante_id_fkey"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "visitantes_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_public_endpoints: {
        Row: {
          action: string
          client_ip: string
          created_at: string | null
          endpoint_name: string
          error_message: string | null
          id: string
          request_metadata: Json | null
          success: boolean | null
        }
        Insert: {
          action: string
          client_ip: string
          created_at?: string | null
          endpoint_name: string
          error_message?: string | null
          id?: string
          request_metadata?: Json | null
          success?: boolean | null
        }
        Update: {
          action?: string
          client_ip?: string
          created_at?: string | null
          endpoint_name?: string
          error_message?: string | null
          id?: string
          request_metadata?: Json | null
          success?: boolean | null
        }
        Relationships: []
      }
      aulas: {
        Row: {
          created_at: string | null
          data_inicio: string
          duracao_minutos: number | null
          evento_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          jornada_id: string | null
          link_reuniao: string | null
          modalidade: string | null
          professor_id: string | null
          sala_id: string | null
          status: string | null
          tema: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_inicio: string
          duracao_minutos?: number | null
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id?: string | null
          link_reuniao?: string | null
          modalidade?: string | null
          professor_id?: string | null
          sala_id?: string | null
          status?: string | null
          tema?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_inicio?: string
          duracao_minutos?: number | null
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id?: string | null
          link_reuniao?: string | null
          modalidade?: string | null
          professor_id?: string | null
          sala_id?: string | null
          status?: string | null
          tema?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aulas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "aulas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "aulas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aulas_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "view_room_occupancy"
            referencedColumns: ["sala_id"]
          },
        ]
      }
      banners: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          image_url: string | null
          message: string
          scheduled_at: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          image_url?: string | null
          message: string
          scheduled_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          image_url?: string | null
          message?: string
          scheduled_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banners_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      bases_ministeriais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          responsavel_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          responsavel_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          responsavel_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bases_ministeriais_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bases_ministeriais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bases_ministeriais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bases_ministeriais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "bases_ministeriais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      blocked_ips: {
        Row: {
          blocked_at: string | null
          blocked_until: string | null
          created_by: string | null
          id: string
          ip_address: string
          reason: string
          violation_count: number | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address: string
          reason: string
          violation_count?: number | null
        }
        Update: {
          blocked_at?: string | null
          blocked_until?: string | null
          created_by?: string | null
          id?: string
          ip_address?: string
          reason?: string
          violation_count?: number | null
        }
        Relationships: []
      }
      cancoes_culto: {
        Row: {
          artista: string | null
          bpm: number | null
          cifra: string | null
          created_at: string
          duracao_minutos: number | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          letra: string | null
          link_spotify: string | null
          link_youtube: string | null
          ministro_id: string | null
          observacoes: string | null
          ordem: number
          solista_id: string | null
          titulo: string
          tom: string | null
          updated_at: string
        }
        Insert: {
          artista?: string | null
          bpm?: number | null
          cifra?: string | null
          created_at?: string
          duracao_minutos?: number | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          letra?: string | null
          link_spotify?: string | null
          link_youtube?: string | null
          ministro_id?: string | null
          observacoes?: string | null
          ordem: number
          solista_id?: string | null
          titulo: string
          tom?: string | null
          updated_at?: string
        }
        Update: {
          artista?: string | null
          bpm?: number | null
          cifra?: string | null
          created_at?: string
          duracao_minutos?: number | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          letra?: string | null
          link_spotify?: string | null
          link_youtube?: string | null
          ministro_id?: string | null
          observacoes?: string | null
          ordem?: number
          solista_id?: string | null
          titulo?: string
          tom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancoes_culto_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancoes_culto_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancoes_culto_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancoes_culto_ministro_id_fkey"
            columns: ["ministro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancoes_culto_ministro_id_fkey"
            columns: ["ministro_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "cancoes_culto_ministro_id_fkey"
            columns: ["ministro_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "cancoes_culto_solista_id_fkey"
            columns: ["solista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancoes_culto_solista_id_fkey"
            columns: ["solista_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "cancoes_culto_solista_id_fkey"
            columns: ["solista_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      candidatos_voluntario: {
        Row: {
          avaliado_por: string | null
          created_at: string | null
          data_avaliacao: string | null
          disponibilidade: string
          email_contato: string | null
          experiencia: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          ministerio: string
          nome_contato: string
          observacoes: string | null
          pessoa_id: string | null
          status: string
          telefone_contato: string | null
          trilha_requerida_id: string | null
          updated_at: string | null
        }
        Insert: {
          avaliado_por?: string | null
          created_at?: string | null
          data_avaliacao?: string | null
          disponibilidade: string
          email_contato?: string | null
          experiencia: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ministerio: string
          nome_contato: string
          observacoes?: string | null
          pessoa_id?: string | null
          status?: string
          telefone_contato?: string | null
          trilha_requerida_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avaliado_por?: string | null
          created_at?: string | null
          data_avaliacao?: string | null
          disponibilidade?: string
          email_contato?: string | null
          experiencia?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ministerio?: string
          nome_contato?: string
          observacoes?: string | null
          pessoa_id?: string | null
          status?: string
          telefone_contato?: string | null
          trilha_requerida_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_voluntario_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_trilha_requerida_id_fkey"
            columns: ["trilha_requerida_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatos_voluntario_historico: {
        Row: {
          acao: string
          candidato_id: string
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          realizado_por: string | null
          status_anterior: string | null
          status_novo: string | null
        }
        Insert: {
          acao: string
          candidato_id: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          realizado_por?: string | null
          status_anterior?: string | null
          status_novo?: string | null
        }
        Update: {
          acao?: string
          candidato_id?: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          realizado_por?: string | null
          status_anterior?: string | null
          status_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_voluntario_historico_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos_voluntario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_historico_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_historico_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_historico_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_historico_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "candidatos_voluntario_historico_realizado_por_fkey"
            columns: ["realizado_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          secao_dre: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          secao_dre?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          secao_dre?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_financeiras_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_times: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_times_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_times_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          base_ministerial_id: string | null
          created_at: string
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_ministerial_id?: string | null
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_ministerial_id?: string | null
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_base_ministerial_id_fkey"
            columns: ["base_ministerial_id"]
            isOneToOne: false
            referencedRelation: "bases_ministeriais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centros_custo_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centros_custo_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_configs: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          edge_function_name: string
          id: string
          modelo_audio: string | null
          modelo_texto: string | null
          modelo_visao: string | null
          nome: string
          role_audio: string | null
          role_texto: string | null
          role_visao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          edge_function_name: string
          id?: string
          modelo_audio?: string | null
          modelo_texto?: string | null
          modelo_visao?: string | null
          nome: string
          role_audio?: string | null
          role_texto?: string | null
          role_visao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          edge_function_name?: string
          id?: string
          modelo_audio?: string | null
          modelo_texto?: string | null
          modelo_visao?: string | null
          nome?: string
          role_audio?: string | null
          role_texto?: string | null
          role_visao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          metodo: string | null
          pessoa_id: string
          tipo_registro: string | null
          validado_por: string | null
        }
        Insert: {
          created_at?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          metodo?: string | null
          pessoa_id: string
          tipo_registro?: string | null
          validado_por?: string | null
        }
        Update: {
          created_at?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          metodo?: string | null
          pessoa_id?: string
          tipo_registro?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_culto_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_culto_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_culto_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "presencas_culto_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "presencas_culto_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cob_pix: {
        Row: {
          chave_pix: string
          conta_id: string | null
          created_at: string
          data_conclusao: string | null
          data_criacao: string
          data_expiracao: string | null
          descricao: string | null
          expiracao: number | null
          filial_id: string | null
          id: string
          igreja_id: string
          info_adicionais: Json | null
          payload_resposta: Json | null
          qr_brcode: string | null
          qr_location: string | null
          sessao_item_id: string | null
          status: string
          txid: string
          updated_at: string
          valor_original: number
        }
        Insert: {
          chave_pix: string
          conta_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          descricao?: string | null
          expiracao?: number | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          info_adicionais?: Json | null
          payload_resposta?: Json | null
          qr_brcode?: string | null
          qr_location?: string | null
          sessao_item_id?: string | null
          status?: string
          txid: string
          updated_at?: string
          valor_original: number
        }
        Update: {
          chave_pix?: string
          conta_id?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          descricao?: string | null
          expiracao?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          info_adicionais?: Json | null
          payload_resposta?: Json | null
          qr_brcode?: string | null
          qr_location?: string | null
          sessao_item_id?: string | null
          status?: string
          txid?: string
          updated_at?: string
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "cob_pix_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cob_pix_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cob_pix_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cob_pix_sessao_item_id_fkey"
            columns: ["sessao_item_id"]
            isOneToOne: false
            referencedRelation: "sessoes_itens_draft"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          ativo: boolean | null
          categoria_midia: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          evento_id: string | null
          exibir_app: boolean | null
          exibir_site: boolean | null
          exibir_telao: boolean | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          imagem_url: string | null
          link_acao: string | null
          midia_id: string | null
          nivel_urgencia: string | null
          ordem_telao: number | null
          tags: string[] | null
          tipo: Database["public"]["Enums"]["tipo_comunicado"]
          titulo: string
          updated_at: string | null
          url_arquivo_telao: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria_midia?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          evento_id?: string | null
          exibir_app?: boolean | null
          exibir_site?: boolean | null
          exibir_telao?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          imagem_url?: string | null
          link_acao?: string | null
          midia_id?: string | null
          nivel_urgencia?: string | null
          ordem_telao?: number | null
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["tipo_comunicado"]
          titulo: string
          updated_at?: string | null
          url_arquivo_telao?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria_midia?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          evento_id?: string | null
          exibir_app?: boolean | null
          exibir_site?: boolean | null
          exibir_telao?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          imagem_url?: string | null
          link_acao?: string | null
          midia_id?: string | null
          nivel_urgencia?: string | null
          ordem_telao?: number | null
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["tipo_comunicado"]
          titulo?: string
          updated_at?: string | null
          url_arquivo_telao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicados_midia_id_fkey"
            columns: ["midia_id"]
            isOneToOne: false
            referencedRelation: "midias"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacao_ml_feedback: {
        Row: {
          acao: string
          ajustes: Json
          conta_id: string | null
          created_at: string
          extrato_ids: string[]
          filial_id: string | null
          id: string
          igreja_id: string
          modelo_versao: string | null
          score: number | null
          sugestao_id: string | null
          tipo_match: string
          transacao_ids: string[]
          usuario_id: string | null
        }
        Insert: {
          acao: string
          ajustes?: Json
          conta_id?: string | null
          created_at?: string
          extrato_ids?: string[]
          filial_id?: string | null
          id?: string
          igreja_id: string
          modelo_versao?: string | null
          score?: number | null
          sugestao_id?: string | null
          tipo_match: string
          transacao_ids?: string[]
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          ajustes?: Json
          conta_id?: string | null
          created_at?: string
          extrato_ids?: string[]
          filial_id?: string | null
          id?: string
          igreja_id?: string
          modelo_versao?: string | null
          score?: number | null
          sugestao_id?: string | null
          tipo_match?: string
          transacao_ids?: string[]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_ml_feedback_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_sugestao_id_fkey"
            columns: ["sugestao_id"]
            isOneToOne: false
            referencedRelation: "conciliacao_ml_sugestoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      conciliacao_ml_sugestoes: {
        Row: {
          conta_id: string | null
          created_at: string
          extrato_ids: string[]
          features: Json
          filial_id: string | null
          id: string
          igreja_id: string
          modelo_versao: string | null
          origem: string
          score: number
          status: string
          tipo_match: string
          transacao_ids: string[]
          updated_at: string
        }
        Insert: {
          conta_id?: string | null
          created_at?: string
          extrato_ids?: string[]
          features?: Json
          filial_id?: string | null
          id?: string
          igreja_id: string
          modelo_versao?: string | null
          origem?: string
          score: number
          status?: string
          tipo_match: string
          transacao_ids?: string[]
          updated_at?: string
        }
        Update: {
          conta_id?: string | null
          created_at?: string
          extrato_ids?: string[]
          features?: Json
          filial_id?: string | null
          id?: string
          igreja_id?: string
          modelo_versao?: string | null
          origem?: string
          score?: number
          status?: string
          tipo_match?: string
          transacao_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_ml_sugestoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_sugestoes_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_sugestoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacoes_divisao: {
        Row: {
          conta_id: string | null
          created_at: string
          created_by: string | null
          extrato_id: string
          filial_id: string | null
          id: string
          igreja_id: string
          observacoes: string | null
          status: string
          updated_at: string
          valor_extrato: number
        }
        Insert: {
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          extrato_id: string
          filial_id?: string | null
          id?: string
          igreja_id: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_extrato: number
        }
        Update: {
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          extrato_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_extrato?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_divisao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacoes_divisao_transacoes: {
        Row: {
          conciliacao_divisao_id: string
          created_at: string
          id: string
          transacao_id: string
          valor: number
        }
        Insert: {
          conciliacao_divisao_id: string
          created_at?: string
          id?: string
          transacao_id: string
          valor: number
        }
        Update: {
          conciliacao_divisao_id?: string
          created_at?: string
          id?: string
          transacao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_conciliacao_divisao_id_fkey"
            columns: ["conciliacao_divisao_id"]
            isOneToOne: false
            referencedRelation: "conciliacoes_divisao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_divisao_transacoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      conciliacoes_lote: {
        Row: {
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          diferenca: number | null
          filial_id: string | null
          id: string
          igreja_id: string
          observacoes: string | null
          status: string
          transacao_id: string
          updated_at: string | null
          valor_extratos: number
          valor_transacao: number
        }
        Insert: {
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          diferenca?: number | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          observacoes?: string | null
          status?: string
          transacao_id: string
          updated_at?: string | null
          valor_extratos?: number
          valor_transacao: number
        }
        Update: {
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          diferenca?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          observacoes?: string | null
          status?: string
          transacao_id?: string
          updated_at?: string | null
          valor_extratos?: number
          valor_transacao?: number
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_lote_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      conciliacoes_lote_extratos: {
        Row: {
          conciliacao_lote_id: string
          created_at: string | null
          extrato_id: string
          id: string
        }
        Insert: {
          conciliacao_lote_id: string
          created_at?: string | null
          extrato_id: string
          id?: string
        }
        Update: {
          conciliacao_lote_id?: string
          created_at?: string | null
          extrato_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_lote_extratos_conciliacao_lote_id_fkey"
            columns: ["conciliacao_lote_id"]
            isOneToOne: false
            referencedRelation: "conciliacoes_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_extratos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: true
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_extratos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: true
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_extratos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: true
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_extratos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: true
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "conciliacoes_lote_extratos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: true
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["extrato_id"]
          },
        ]
      }
      configuracoes_igreja: {
        Row: {
          created_at: string | null
          id: string
          igreja_id: string | null
          logo_url: string | null
          nome_igreja: string
          subtitulo: string | null
          telefone_plantao_pastoral: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          igreja_id?: string | null
          logo_url?: string | null
          nome_igreja?: string
          subtitulo?: string | null
          telefone_plantao_pastoral?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          igreja_id?: string | null
          logo_url?: string | null
          nome_igreja?: string
          subtitulo?: string | null
          telefone_plantao_pastoral?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_igreja_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      contagens: {
        Row: {
          contador_id: string
          id: string
          ordem: number
          sessao_id: string
          submitted_at: string
          totais_por_tipo: Json
          total: number
        }
        Insert: {
          contador_id: string
          id?: string
          ordem: number
          sessao_id: string
          submitted_at?: string
          totais_por_tipo?: Json
          total?: number
        }
        Update: {
          contador_id?: string
          id?: string
          ordem?: number
          sessao_id?: string
          submitted_at?: string
          totais_por_tipo?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contagens_contador_id_fkey"
            columns: ["contador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contagens_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_contagem"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          cnpj_banco: string | null
          conta_numero: string | null
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          observacoes: string | null
          saldo_atual: number
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cnpj_banco?: string | null
          conta_numero?: string | null
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          observacoes?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cnpj_banco?: string | null
          conta_numero?: string | null
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          observacoes?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_config: {
        Row: {
          created_at: string | null
          enabled: boolean
          execution_count: number | null
          function_name: string
          id: string
          last_execution: string | null
          last_execution_status: string | null
          schedule_cron: string
          schedule_description: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          execution_count?: number | null
          function_name: string
          id?: string
          last_execution?: string | null
          last_execution_status?: string | null
          schedule_cron: string
          schedule_description: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          execution_count?: number | null
          function_name?: string
          id?: string
          last_execution?: string | null
          last_execution_status?: string | null
          schedule_cron?: string
          schedule_description?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      edge_function_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          function_name: string
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          checkin_realizado: boolean | null
          confirmado: boolean
          created_at: string
          data_confirmacao: string | null
          data_hora_fim: string | null
          data_hora_inicio: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          motivo_recusa: string | null
          observacoes: string | null
          pessoa_id: string
          posicao_id: string | null
          status_confirmacao: string | null
          time_id: string | null
          ultimo_aviso_em: string | null
          updated_at: string
        }
        Insert: {
          checkin_realizado?: boolean | null
          confirmado?: boolean
          created_at?: string
          data_confirmacao?: string | null
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          motivo_recusa?: string | null
          observacoes?: string | null
          pessoa_id: string
          posicao_id?: string | null
          status_confirmacao?: string | null
          time_id?: string | null
          ultimo_aviso_em?: string | null
          updated_at?: string
        }
        Update: {
          checkin_realizado?: boolean | null
          confirmado?: boolean
          created_at?: string
          data_confirmacao?: string | null
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          motivo_recusa?: string | null
          observacoes?: string | null
          pessoa_id?: string
          posicao_id?: string | null
          status_confirmacao?: string | null
          time_id?: string | null
          ultimo_aviso_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "escalas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "escalas_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicoes_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_template: {
        Row: {
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          pessoa_id: string | null
          posicao_id: string | null
          template_id: string
          time_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          pessoa_id?: string | null
          posicao_id?: string | null
          template_id: string
          time_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          pessoa_id?: string | null
          posicao_id?: string | null
          template_id?: string
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_template_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_template_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_template_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_template_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "escalas_template_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "escalas_template_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicoes_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_template_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_culto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_template_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_jornada: {
        Row: {
          aula_vinculada_id: string | null
          check_automatico: boolean | null
          conteudo_texto: string | null
          conteudo_tipo: string | null
          conteudo_url: string | null
          created_at: string | null
          duracao_estimada_minutos: number | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          jornada_id: string
          ordem: number
          quiz_config: Json | null
          tipo_conteudo: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          aula_vinculada_id?: string | null
          check_automatico?: boolean | null
          conteudo_texto?: string | null
          conteudo_tipo?: string | null
          conteudo_url?: string | null
          created_at?: string | null
          duracao_estimada_minutos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id: string
          ordem: number
          quiz_config?: Json | null
          tipo_conteudo?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          aula_vinculada_id?: string | null
          check_automatico?: boolean | null
          conteudo_texto?: string | null
          conteudo_tipo?: string | null
          conteudo_url?: string | null
          created_at?: string | null
          duracao_estimada_minutos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id?: string
          ordem?: number
          quiz_config?: Json | null
          tipo_conteudo?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_jornada_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_jornada_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_jornada_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_lista_espera: {
        Row: {
          contatado_em: string | null
          created_at: string | null
          email: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string
          nome: string
          observacoes: string | null
          pessoa_id: string | null
          posicao_fila: number
          status: string | null
          telefone: string
          visitante_lead_id: string | null
        }
        Insert: {
          contatado_em?: string | null
          created_at?: string | null
          email?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id: string
          nome: string
          observacoes?: string | null
          pessoa_id?: string | null
          posicao_fila?: number
          status?: string | null
          telefone: string
          visitante_lead_id?: string | null
        }
        Update: {
          contatado_em?: string | null
          created_at?: string | null
          email?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string
          nome?: string
          observacoes?: string | null
          pessoa_id?: string | null
          posicao_fila?: number
          status?: string | null
          telefone?: string
          visitante_lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_lista_espera_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lista_espera_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lista_espera_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lista_espera_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lista_espera_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "evento_lista_espera_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "evento_lista_espera_visitante_lead_id_fkey"
            columns: ["visitante_lead_id"]
            isOneToOne: false
            referencedRelation: "visitantes_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_lotes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          ordem: number | null
          updated_at: string | null
          vagas_limite: number | null
          vagas_utilizadas: number | null
          valor: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          ordem?: number | null
          updated_at?: string | null
          vagas_limite?: number | null
          vagas_utilizadas?: number | null
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          ordem?: number | null
          updated_at?: string | null
          vagas_limite?: number | null
          vagas_utilizadas?: number | null
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_lotes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lotes_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_lotes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_subtipos: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          tipo_pai: Database["public"]["Enums"]["evento_tipo"]
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          tipo_pai: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          tipo_pai?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_subtipos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_subtipos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          categoria_financeira_id: string | null
          conta_financeira_id: string | null
          created_at: string
          created_by: string | null
          data_evento: string
          descricao: string | null
          duracao_minutos: number | null
          endereco: string | null
          exibir_preletor: boolean
          exigir_documento_checkin: boolean | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          inscricoes_abertas_ate: string | null
          local: string | null
          mostrar_posicao_fila: boolean | null
          observacoes: string | null
          pregador: string | null
          requer_inscricao: boolean | null
          requer_pagamento: boolean | null
          status: string
          subtipo_id: string | null
          tem_oferta: boolean
          tema: string | null
          tipo: string
          titulo: string
          updated_at: string
          vagas_limite: number | null
          valor_inscricao: number | null
        }
        Insert: {
          categoria_financeira_id?: string | null
          conta_financeira_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evento: string
          descricao?: string | null
          duracao_minutos?: number | null
          endereco?: string | null
          exibir_preletor?: boolean
          exigir_documento_checkin?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          inscricoes_abertas_ate?: string | null
          local?: string | null
          mostrar_posicao_fila?: boolean | null
          observacoes?: string | null
          pregador?: string | null
          requer_inscricao?: boolean | null
          requer_pagamento?: boolean | null
          status?: string
          subtipo_id?: string | null
          tem_oferta?: boolean
          tema?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          vagas_limite?: number | null
          valor_inscricao?: number | null
        }
        Update: {
          categoria_financeira_id?: string | null
          conta_financeira_id?: string | null
          created_at?: string
          created_by?: string | null
          data_evento?: string
          descricao?: string | null
          duracao_minutos?: number | null
          endereco?: string | null
          exibir_preletor?: boolean
          exigir_documento_checkin?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          inscricoes_abertas_ate?: string | null
          local?: string | null
          mostrar_posicao_fila?: boolean | null
          observacoes?: string | null
          pregador?: string | null
          requer_inscricao?: boolean | null
          requer_pagamento?: boolean | null
          status?: string
          subtipo_id?: string | null
          tem_oferta?: boolean
          tema?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          vagas_limite?: number | null
          valor_inscricao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_conta_financeira_id_fkey"
            columns: ["conta_financeira_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_subtipo_id_fkey"
            columns: ["subtipo_id"]
            isOneToOne: false
            referencedRelation: "evento_subtipos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_convites: {
        Row: {
          created_at: string
          enviado_em: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          motivo_recusa: string | null
          pessoa_id: string
          status: string
          updated_at: string
          visualizado_em: string | null
        }
        Insert: {
          created_at?: string
          enviado_em?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          motivo_recusa?: string | null
          pessoa_id: string
          status?: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Update: {
          created_at?: string
          enviado_em?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          motivo_recusa?: string | null
          pessoa_id?: string
          status?: string
          updated_at?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_convites_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_convites_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_convites_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "eventos_convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      extratos_bancarios: {
        Row: {
          conta_id: string
          created_at: string | null
          data_transacao: string
          descricao: string
          external_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          import_job_id: string | null
          numero_documento: string | null
          origem: string | null
          reconciliado: boolean | null
          saldo: number | null
          tipo: string
          transacao_vinculada_id: string | null
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string | null
          data_transacao: string
          descricao: string
          external_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          import_job_id?: string | null
          numero_documento?: string | null
          origem?: string | null
          reconciliado?: boolean | null
          saldo?: number | null
          tipo: string
          transacao_vinculada_id?: string | null
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string | null
          data_transacao?: string
          descricao?: string
          external_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          import_job_id?: string | null
          numero_documento?: string | null
          origem?: string | null
          reconciliado?: boolean | null
          saldo?: number | null
          tipo?: string
          transacao_vinculada_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          created_at: string
          familiar_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome_familiar: string | null
          pessoa_id: string
          tipo_parentesco: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          familiar_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome_familiar?: string | null
          pessoa_id: string
          tipo_parentesco: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          familiar_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome_familiar?: string | null
          pessoa_id?: string
          tipo_parentesco?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familias_familiar_id_fkey"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_familiar_id_fkey"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "familias_familiar_id_fkey"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "familias_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "familias_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      filiais: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          igreja_id: string
          is_sede: boolean | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          igreja_id: string
          is_sede?: boolean | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          igreja_id?: string
          is_sede?: boolean | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filiais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_config: {
        Row: {
          blind_compare_level: string
          blind_count_mode: string
          blind_lock_totals: boolean
          blind_min_counters: number
          blind_tolerance_value: number
          conciliacao_janela_horas: number
          filial_id: string | null
          formas_digitais_ids: string[] | null
          formas_fisicas_ids: string[] | null
          id: string
          igreja_id: string
          integracao_banco_enabled: boolean
          integracao_gateway_enabled: boolean
          integracao_pix_enabled: boolean
          mapeamentos_transferencia: Json | null
          mapping_default_conta_por_forma: Json
          periodos: string[] | null
          sync_strategy: string
          tipos_permitidos_digital: string[] | null
          tipos_permitidos_fisico: string[] | null
          updated_at: string
          valor_zero_policy: string | null
        }
        Insert: {
          blind_compare_level?: string
          blind_count_mode?: string
          blind_lock_totals?: boolean
          blind_min_counters?: number
          blind_tolerance_value?: number
          conciliacao_janela_horas?: number
          filial_id?: string | null
          formas_digitais_ids?: string[] | null
          formas_fisicas_ids?: string[] | null
          id?: string
          igreja_id: string
          integracao_banco_enabled?: boolean
          integracao_gateway_enabled?: boolean
          integracao_pix_enabled?: boolean
          mapeamentos_transferencia?: Json | null
          mapping_default_conta_por_forma?: Json
          periodos?: string[] | null
          sync_strategy?: string
          tipos_permitidos_digital?: string[] | null
          tipos_permitidos_fisico?: string[] | null
          updated_at?: string
          valor_zero_policy?: string | null
        }
        Update: {
          blind_compare_level?: string
          blind_count_mode?: string
          blind_lock_totals?: boolean
          blind_min_counters?: number
          blind_tolerance_value?: number
          conciliacao_janela_horas?: number
          filial_id?: string | null
          formas_digitais_ids?: string[] | null
          formas_fisicas_ids?: string[] | null
          id?: string
          igreja_id?: string
          integracao_banco_enabled?: boolean
          integracao_gateway_enabled?: boolean
          integracao_pix_enabled?: boolean
          mapeamentos_transferencia?: Json | null
          mapping_default_conta_por_forma?: Json
          periodos?: string[] | null
          sync_strategy?: string
          tipos_permitidos_digital?: string[] | null
          tipos_permitidos_fisico?: string[] | null
          updated_at?: string
          valor_zero_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_config_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_config_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_pagamento_contas: {
        Row: {
          conta_id: string
          criado_em: string | null
          filial_id: string | null
          forma_pagamento_id: string
          id: string
          igreja_id: string
          prioridade: number | null
        }
        Insert: {
          conta_id: string
          criado_em?: string | null
          filial_id?: string | null
          forma_pagamento_id: string
          id?: string
          igreja_id: string
          prioridade?: number | null
        }
        Update: {
          conta_id?: string
          criado_em?: string | null
          filial_id?: string | null
          forma_pagamento_id?: string
          id?: string
          igreja_id?: string
          prioridade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forma_pagamento_contas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_pagamento_contas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_pagamento_contas_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forma_pagamento_contas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          filial_id: string | null
          gera_pago: boolean | null
          id: string
          igreja_id: string | null
          is_digital: boolean
          nome: string
          taxa_administrativa: number | null
          taxa_administrativa_fixa: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          filial_id?: string | null
          gera_pago?: boolean | null
          id?: string
          igreja_id?: string | null
          is_digital?: boolean
          nome: string
          taxa_administrativa?: number | null
          taxa_administrativa_fixa?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          filial_id?: string | null
          gera_pago?: boolean | null
          id?: string
          igreja_id?: string | null
          is_digital?: boolean
          nome?: string
          taxa_administrativa?: number | null
          taxa_administrativa_fixa?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formas_pagamento_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo_pessoa: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes_igreja: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcoes_igreja_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcoes_igreja_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      igrejas: {
        Row: {
          admin_responsavel_id: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome: string
          observacoes: string | null
          status: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          admin_responsavel_id?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_responsavel_id?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_job_items: {
        Row: {
          created_at: string
          error_reason: string | null
          id: string
          job_id: string
          row_index: number
          status: string
          transacao_id: string | null
        }
        Insert: {
          created_at?: string
          error_reason?: string | null
          id?: string
          job_id: string
          row_index: number
          status?: string
          transacao_id?: string | null
        }
        Update: {
          created_at?: string
          error_reason?: string | null
          id?: string
          job_id?: string
          row_index?: number
          status?: string
          transacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "import_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_name: string
          filial_id: string
          id: string
          igreja_id: string
          imported_rows: number
          rejected_rows: number
          started_at: string | null
          status: string
          tipo: string
          total_rows: number
          undone_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name: string
          filial_id: string
          id?: string
          igreja_id: string
          imported_rows?: number
          rejected_rows?: number
          started_at?: string | null
          status?: string
          tipo: string
          total_rows?: number
          undone_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          filial_id?: string
          id?: string
          igreja_id?: string
          imported_rows?: number
          rejected_rows?: number
          started_at?: string | null
          status?: string
          tipo?: string
          total_rows?: number
          undone_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      import_presets: {
        Row: {
          created_at: string
          description: string | null
          filial_id: string
          id: string
          igreja_id: string
          mapping: Json
          name: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filial_id: string
          id?: string
          igreja_id: string
          mapping: Json
          name: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filial_id?: string
          id?: string
          igreja_id?: string
          mapping?: Json
          name?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_presets_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_presets_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      inscricoes_eventos: {
        Row: {
          cancelado_em: string | null
          checkin_validado_em: string | null
          checkin_validado_por: string | null
          created_at: string | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          lembrete_pagamento_em: string | null
          lote_id: string | null
          observacoes: string | null
          pessoa_id: string
          qr_token: string | null
          responsavel_inscricao_id: string | null
          status_pagamento: string
          transacao_id: string | null
          updated_at: string | null
          valor_pago: number | null
        }
        Insert: {
          cancelado_em?: string | null
          checkin_validado_em?: string | null
          checkin_validado_por?: string | null
          created_at?: string | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lembrete_pagamento_em?: string | null
          lote_id?: string | null
          observacoes?: string | null
          pessoa_id: string
          qr_token?: string | null
          responsavel_inscricao_id?: string | null
          status_pagamento?: string
          transacao_id?: string | null
          updated_at?: string | null
          valor_pago?: number | null
        }
        Update: {
          cancelado_em?: string | null
          checkin_validado_em?: string | null
          checkin_validado_por?: string | null
          created_at?: string | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lembrete_pagamento_em?: string | null
          lote_id?: string | null
          observacoes?: string | null
          pessoa_id?: string
          qr_token?: string | null
          responsavel_inscricao_id?: string | null
          status_pagamento?: string
          transacao_id?: string | null
          updated_at?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "evento_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_responsavel_inscricao_id_fkey"
            columns: ["responsavel_inscricao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_responsavel_inscricao_id_fkey"
            columns: ["responsavel_inscricao_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_responsavel_inscricao_id_fkey"
            columns: ["responsavel_inscricao_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      inscricoes_jornada: {
        Row: {
          concluido: boolean | null
          created_at: string | null
          data_entrada: string | null
          data_mudanca_fase: string | null
          etapa_atual_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          jornada_id: string
          pessoa_id: string
          responsavel_id: string | null
          status_pagamento: string | null
          transacao_id: string | null
          updated_at: string | null
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_mudanca_fase?: string | null
          etapa_atual_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id: string
          pessoa_id: string
          responsavel_id?: string | null
          status_pagamento?: string | null
          transacao_id?: string | null
          updated_at?: string | null
        }
        Update: {
          concluido?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_mudanca_fase?: string | null
          etapa_atual_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          jornada_id?: string
          pessoa_id?: string
          responsavel_id?: string | null
          status_pagamento?: string | null
          transacao_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_jornada_etapa_atual_id_fkey"
            columns: ["etapa_atual_id"]
            isOneToOne: false
            referencedRelation: "etapas_jornada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "inscricoes_jornada_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      integracao_voluntario: {
        Row: {
          candidato_id: string
          created_at: string | null
          data_conclusao_esperada: string | null
          data_jornada_concluida: string | null
          data_jornada_iniciada: string | null
          data_resultado_teste: string | null
          data_teste_agendada: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          jornada_id: string | null
          mentor_id: string | null
          percentual_jornada: number | null
          pontuacao_teste: number | null
          resultado_teste: string | null
          status: string
          teste_id: string | null
          updated_at: string | null
        }
        Insert: {
          candidato_id: string
          created_at?: string | null
          data_conclusao_esperada?: string | null
          data_jornada_concluida?: string | null
          data_jornada_iniciada?: string | null
          data_resultado_teste?: string | null
          data_teste_agendada?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          jornada_id?: string | null
          mentor_id?: string | null
          percentual_jornada?: number | null
          pontuacao_teste?: number | null
          resultado_teste?: string | null
          status?: string
          teste_id?: string | null
          updated_at?: string | null
        }
        Update: {
          candidato_id?: string
          created_at?: string | null
          data_conclusao_esperada?: string | null
          data_jornada_concluida?: string | null
          data_jornada_iniciada?: string | null
          data_resultado_teste?: string | null
          data_teste_agendada?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          jornada_id?: string | null
          mentor_id?: string | null
          percentual_jornada?: number | null
          pontuacao_teste?: number | null
          resultado_teste?: string | null
          status?: string
          teste_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracao_voluntario_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos_voluntario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracao_voluntario_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracao_voluntario_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracao_voluntario_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracao_voluntario_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "integracao_voluntario_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "integracao_voluntario_teste_id_fkey"
            columns: ["teste_id"]
            isOneToOne: false
            referencedRelation: "testes_ministerio"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_financeiras: {
        Row: {
          cnpj: string
          config: Json
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string
          provedor: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          config?: Json
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id: string
          provedor: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          config?: Json
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string
          provedor?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_financeiras_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_financeiras_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_financeiras_secrets: {
        Row: {
          application_key: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string
          id: string
          integracao_id: string
          pfx_blob: string | null
          pfx_password: string | null
        }
        Insert: {
          application_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          integracao_id: string
          pfx_blob?: string | null
          pfx_password?: string | null
        }
        Update: {
          application_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          integracao_id?: string
          pfx_blob?: string | null
          pfx_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_financeiras_secrets_integracao_id_fkey"
            columns: ["integracao_id"]
            isOneToOne: false
            referencedRelation: "integracoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      intercessores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          max_pedidos: number | null
          nome: string
          status_disponibilidade:
            | Database["public"]["Enums"]["status_intercessor"]
            | null
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          max_pedidos?: number | null
          nome: string
          status_disponibilidade?:
            | Database["public"]["Enums"]["status_intercessor"]
            | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          max_pedidos?: number | null
          nome?: string
          status_disponibilidade?:
            | Database["public"]["Enums"]["status_intercessor"]
            | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intercessores_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercessores_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_reembolso: {
        Row: {
          base_ministerial_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string | null
          data_item: string
          descricao: string
          filial_id: string | null
          fornecedor_id: string | null
          foto_url: string | null
          id: string
          igreja_id: string | null
          solicitacao_id: string
          subcategoria_id: string | null
          valor: number
        }
        Insert: {
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_item: string
          descricao: string
          filial_id?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          igreja_id?: string | null
          solicitacao_id: string
          subcategoria_id?: string | null
          valor: number
        }
        Update: {
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string | null
          data_item?: string
          descricao?: string
          filial_id?: string | null
          fornecedor_id?: string | null
          foto_url?: string | null
          id?: string
          igreja_id?: string | null
          solicitacao_id?: string
          subcategoria_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_reembolso_base_ministerial_id_fkey"
            columns: ["base_ministerial_id"]
            isOneToOne: false
            referencedRelation: "bases_ministeriais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_reembolso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "view_solicitacoes_reembolso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reembolso_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_template_culto: {
        Row: {
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          midias_ids: string[] | null
          ordem: number
          responsavel_externo: string | null
          template_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midias_ids?: string[] | null
          ordem: number
          responsavel_externo?: string | null
          template_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midias_ids?: string[] | null
          ordem?: number
          responsavel_externo?: string | null
          template_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_template_culto_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_template_culto_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_template_culto_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_culto"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          ativo: boolean | null
          cor_tema: string | null
          created_at: string | null
          descricao: string | null
          exibir_portal: boolean | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          requer_pagamento: boolean | null
          tipo_jornada: string | null
          titulo: string
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean | null
          cor_tema?: string | null
          created_at?: string | null
          descricao?: string | null
          exibir_portal?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          requer_pagamento?: boolean | null
          tipo_jornada?: string | null
          titulo: string
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean | null
          cor_tema?: string | null
          created_at?: string | null
          descricao?: string | null
          exibir_portal?: boolean | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          requer_pagamento?: boolean | null
          tipo_jornada?: string | null
          titulo?: string
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      kids_checkins: {
        Row: {
          checkin_at: string | null
          checkin_por: string | null
          checkout_at: string | null
          checkout_por: string | null
          created_at: string | null
          crianca_id: string
          evento_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          responsavel_id: string
          updated_at: string | null
        }
        Insert: {
          checkin_at?: string | null
          checkin_por?: string | null
          checkout_at?: string | null
          checkout_por?: string | null
          created_at?: string | null
          crianca_id: string
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          responsavel_id: string
          updated_at?: string | null
        }
        Update: {
          checkin_at?: string | null
          checkin_por?: string | null
          checkout_at?: string | null
          checkout_por?: string | null
          created_at?: string | null
          crianca_id?: string
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          responsavel_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_checkins_checkout_por_fkey"
            columns: ["checkout_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_checkout_por_fkey"
            columns: ["checkout_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_checkout_por_fkey"
            columns: ["checkout_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_checkins_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      kids_diario: {
        Row: {
          comportamento_tags: string[] | null
          created_at: string | null
          crianca_id: string
          culto_id: string | null
          data: string
          filial_id: string | null
          humor: string | null
          id: string
          igreja_id: string | null
          necessidades_tags: string[] | null
          observacoes: string | null
          professor_id: string
          updated_at: string | null
        }
        Insert: {
          comportamento_tags?: string[] | null
          created_at?: string | null
          crianca_id: string
          culto_id?: string | null
          data?: string
          filial_id?: string | null
          humor?: string | null
          id?: string
          igreja_id?: string | null
          necessidades_tags?: string[] | null
          observacoes?: string | null
          professor_id: string
          updated_at?: string | null
        }
        Update: {
          comportamento_tags?: string[] | null
          created_at?: string | null
          crianca_id?: string
          culto_id?: string | null
          data?: string
          filial_id?: string | null
          humor?: string | null
          id?: string
          igreja_id?: string | null
          necessidades_tags?: string[] | null
          observacoes?: string | null
          professor_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_diario_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      liturgia_recursos: {
        Row: {
          created_at: string | null
          duracao_segundos: number | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          liturgia_item_id: string
          midia_id: string
          ordem: number | null
        }
        Insert: {
          created_at?: string | null
          duracao_segundos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          liturgia_item_id: string
          midia_id: string
          ordem?: number | null
        }
        Update: {
          created_at?: string | null
          duracao_segundos?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          liturgia_item_id?: string
          midia_id?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liturgia_recursos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgia_recursos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgia_recursos_liturgia_item_id_fkey"
            columns: ["liturgia_item_id"]
            isOneToOne: false
            referencedRelation: "liturgias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgia_recursos_midia_id_fkey"
            columns: ["midia_id"]
            isOneToOne: false
            referencedRelation: "midias"
            referencedColumns: ["id"]
          },
        ]
      }
      liturgia_templates: {
        Row: {
          created_at: string | null
          descricao: string | null
          estrutura_json: Json | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          estrutura_json?: Json | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          estrutura_json?: Json | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liturgia_templates_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgia_templates_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      liturgias: {
        Row: {
          bloqueio_progresso: boolean
          conteudo_config: Json
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          evento_id: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          midias_ids: string[] | null
          ordem: number
          permite_multiplo: boolean
          responsavel_externo: string | null
          responsavel_id: string | null
          tipo: string
          tipo_conteudo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          bloqueio_progresso?: boolean
          conteudo_config?: Json
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          evento_id: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midias_ids?: string[] | null
          ordem: number
          permite_multiplo?: boolean
          responsavel_externo?: string | null
          responsavel_id?: string | null
          tipo: string
          tipo_conteudo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          bloqueio_progresso?: boolean
          conteudo_config?: Json
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          evento_id?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midias_ids?: string[] | null
          ordem?: number
          permite_multiplo?: boolean
          responsavel_externo?: string | null
          responsavel_id?: string | null
          tipo?: string
          tipo_conteudo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liturgias_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgias_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "liturgias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      logs_auditoria_chat: {
        Row: {
          ator: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          ip_origem: string | null
          payload_raw: Json
          sessao_id: string | null
          timestamp_exato: string | null
          tipo_evento: string | null
        }
        Insert: {
          ator: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ip_origem?: string | null
          payload_raw: Json
          sessao_id?: string | null
          timestamp_exato?: string | null
          tipo_evento?: string | null
        }
        Update: {
          ator?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ip_origem?: string | null
          payload_raw?: Json
          sessao_id?: string | null
          timestamp_exato?: string | null
          tipo_evento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_chat_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_chat_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_auditoria_chat_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "atendimentos_bot"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_replicacao_cadastros: {
        Row: {
          created_at: string | null
          filiais_destino_ids: string[]
          filial_origem_id: string
          id: string
          igreja_id: string
          overwrite: boolean | null
          resultado: Json
          tabelas: string[]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filiais_destino_ids: string[]
          filial_origem_id: string
          id?: string
          igreja_id: string
          overwrite?: boolean | null
          resultado: Json
          tabelas: string[]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filiais_destino_ids?: string[]
          filial_origem_id?: string
          id?: string
          igreja_id?: string
          overwrite?: boolean | null
          resultado?: Json
          tabelas?: string[]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_replicacao_cadastros_filial_origem_id_fkey"
            columns: ["filial_origem_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_replicacao_cadastros_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      membro_funcoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          filial_id: string | null
          funcao_id: string
          id: string
          igreja_id: string | null
          membro_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          filial_id?: string | null
          funcao_id: string
          id?: string
          igreja_id?: string | null
          membro_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          filial_id?: string | null
          funcao_id?: string
          id?: string
          igreja_id?: string | null
          membro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membro_funcoes_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_funcoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes_igreja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_funcoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_funcoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_funcoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "membro_funcoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      membros_time: {
        Row: {
          ativo: boolean
          created_at: string
          data_entrada: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          pessoa_id: string
          posicao_id: string | null
          time_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          pessoa_id: string
          posicao_id?: string | null
          time_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          pessoa_id?: string
          posicao_id?: string | null
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_time_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_time_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_time_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_time_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "membros_time_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "membros_time_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicoes_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_time_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      midia_tags: {
        Row: {
          created_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          midia_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midia_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          midia_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "midia_tags_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midia_tags_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midia_tags_midia_id_fkey"
            columns: ["midia_id"]
            isOneToOne: false
            referencedRelation: "midias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midia_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_midias"
            referencedColumns: ["id"]
          },
        ]
      }
      midias: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          created_by: string | null
          culto_id: string | null
          descricao: string | null
          expires_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          ordem: number
          scheduled_at: string | null
          tags: string[] | null
          tipo: string
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          created_by?: string | null
          culto_id?: string | null
          descricao?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number
          scheduled_at?: string | null
          tags?: string[] | null
          tipo: string
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          created_by?: string | null
          culto_id?: string | null
          descricao?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number
          scheduled_at?: string | null
          tags?: string[] | null
          tipo?: string
          titulo?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "midias_culto_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          id: string
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          access_level: Database["public"]["Enums"]["access_level"]
          id?: string
          module_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          id?: string
          module_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      notificacao_eventos: {
        Row: {
          categoria: string
          created_at: string | null
          nome: string
          provider_preferencial: string | null
          slug: string
          template_meta: string | null
          variaveis: string[] | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          nome: string
          provider_preferencial?: string | null
          slug: string
          template_meta?: string | null
          variaveis?: string[] | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          nome?: string
          provider_preferencial?: string | null
          slug?: string
          template_meta?: string | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
      notificacao_regras: {
        Row: {
          ativo: boolean | null
          canais: Json | null
          created_at: string | null
          evento_slug: string | null
          id: string
          role_alvo: string | null
          user_id_especifico: string | null
        }
        Insert: {
          ativo?: boolean | null
          canais?: Json | null
          created_at?: string | null
          evento_slug?: string | null
          id?: string
          role_alvo?: string | null
          user_id_especifico?: string | null
        }
        Update: {
          ativo?: boolean | null
          canais?: Json | null
          created_at?: string | null
          evento_slug?: string | null
          id?: string
          role_alvo?: string | null
          user_id_especifico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_regras_evento_slug_fkey"
            columns: ["evento_slug"]
            isOneToOne: false
            referencedRelation: "notificacao_eventos"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notificacao_regras_user_id_especifico_fkey"
            columns: ["user_id_especifico"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_regras_user_id_especifico_fkey"
            columns: ["user_id_especifico"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "notificacao_regras_user_id_especifico_fkey"
            columns: ["user_id_especifico"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "notifications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      onboarding_requests: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          email: string
          estado: string | null
          id: string
          igreja_id: string | null
          nome_igreja: string
          nome_responsavel: string
          observacoes: string | null
          processado_em: string | null
          processado_por: string | null
          status: string
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email: string
          estado?: string | null
          id?: string
          igreja_id?: string | null
          nome_igreja: string
          nome_responsavel: string
          observacoes?: string | null
          processado_em?: string | null
          processado_por?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string
          estado?: string | null
          id?: string
          igreja_id?: string | null
          nome_igreja?: string
          nome_responsavel?: string
          observacoes?: string | null
          processado_em?: string | null
          processado_por?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_requests_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_oracao: {
        Row: {
          analise_ia_gravidade: string | null
          analise_ia_motivo: string | null
          analise_ia_resposta: string | null
          analise_ia_titulo: string | null
          anonimo: boolean | null
          classificacao: string | null
          created_at: string | null
          data_alocacao: string | null
          data_criacao: string | null
          data_resposta: string | null
          email_solicitante: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          intercessor_id: string | null
          membro_id: string | null
          nome_solicitante: string | null
          observacoes_intercessor: string | null
          origem: string | null
          pedido: string
          pessoa_id: string | null
          status: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante: string | null
          texto_na_integra: string | null
          tipo: Database["public"]["Enums"]["tipo_pedido"]
          updated_at: string | null
          visitante_id: string | null
        }
        Insert: {
          analise_ia_gravidade?: string | null
          analise_ia_motivo?: string | null
          analise_ia_resposta?: string | null
          analise_ia_titulo?: string | null
          anonimo?: boolean | null
          classificacao?: string | null
          created_at?: string | null
          data_alocacao?: string | null
          data_criacao?: string | null
          data_resposta?: string | null
          email_solicitante?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          intercessor_id?: string | null
          membro_id?: string | null
          nome_solicitante?: string | null
          observacoes_intercessor?: string | null
          origem?: string | null
          pedido: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante?: string | null
          texto_na_integra?: string | null
          tipo?: Database["public"]["Enums"]["tipo_pedido"]
          updated_at?: string | null
          visitante_id?: string | null
        }
        Update: {
          analise_ia_gravidade?: string | null
          analise_ia_motivo?: string | null
          analise_ia_resposta?: string | null
          analise_ia_titulo?: string | null
          anonimo?: boolean | null
          classificacao?: string | null
          created_at?: string | null
          data_alocacao?: string | null
          data_criacao?: string | null
          data_resposta?: string | null
          email_solicitante?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          intercessor_id?: string | null
          membro_id?: string | null
          nome_solicitante?: string | null
          observacoes_intercessor?: string | null
          origem?: string | null
          pedido?: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante?: string | null
          texto_na_integra?: string | null
          tipo?: Database["public"]["Enums"]["tipo_pedido"]
          updated_at?: string | null
          visitante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_oracao_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_oracao_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_oracao_intercessor_id_fkey"
            columns: ["intercessor_id"]
            isOneToOne: false
            referencedRelation: "intercessores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_oracao_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pedidos_oracao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_oracao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "pedidos_oracao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "pedidos_oracao_visitante_id_fkey"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "visitantes_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_recebimentos: {
        Row: {
          conta_id: string | null
          created_at: string
          data_pix: string
          descricao: string | null
          extrato_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          payload: Json
          pix_id: string
          sessao_item_id: string | null
          status: string
          transacao_id: string | null
          valor: number
        }
        Insert: {
          conta_id?: string | null
          created_at?: string
          data_pix: string
          descricao?: string | null
          extrato_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          payload?: Json
          pix_id: string
          sessao_item_id?: string | null
          status?: string
          transacao_id?: string | null
          valor: number
        }
        Update: {
          conta_id?: string | null
          created_at?: string
          data_pix?: string
          descricao?: string | null
          extrato_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          payload?: Json
          pix_id?: string
          sessao_item_id?: string | null
          status?: string
          transacao_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_recebimentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_sessao_item_id_fkey"
            columns: ["sessao_item_id"]
            isOneToOne: false
            referencedRelation: "sessoes_itens_draft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_recebimentos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      pix_webhook_temp: {
        Row: {
          banco_id: string | null
          cob_pix_id: string | null
          created_at: string
          data_pix: string
          data_recebimento: string
          descricao: string | null
          erro_mensagem: string | null
          id: string
          igreja_id: string
          oferta_id: string | null
          pagador_cpf_cnpj: string | null
          pagador_nome: string | null
          pix_id: string
          processado_em: string | null
          status: string
          transacao_id: string | null
          txid: string | null
          updated_at: string
          valor: number
          webhook_payload: Json | null
        }
        Insert: {
          banco_id?: string | null
          cob_pix_id?: string | null
          created_at?: string
          data_pix: string
          data_recebimento?: string
          descricao?: string | null
          erro_mensagem?: string | null
          id?: string
          igreja_id: string
          oferta_id?: string | null
          pagador_cpf_cnpj?: string | null
          pagador_nome?: string | null
          pix_id: string
          processado_em?: string | null
          status?: string
          transacao_id?: string | null
          txid?: string | null
          updated_at?: string
          valor: number
          webhook_payload?: Json | null
        }
        Update: {
          banco_id?: string | null
          cob_pix_id?: string | null
          created_at?: string
          data_pix?: string
          data_recebimento?: string
          descricao?: string | null
          erro_mensagem?: string | null
          id?: string
          igreja_id?: string
          oferta_id?: string | null
          pagador_cpf_cnpj?: string | null
          pagador_nome?: string | null
          pix_id?: string
          processado_em?: string | null
          status?: string
          transacao_id?: string | null
          txid?: string | null
          updated_at?: string
          valor?: number
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pix_webhook_temp_cob_pix_id_fkey"
            columns: ["cob_pix_id"]
            isOneToOne: false
            referencedRelation: "cob_pix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "pix_webhook_temp_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      posicoes_time: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          time_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          time_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posicoes_time_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posicoes_time_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posicoes_time_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas_aula: {
        Row: {
          aluno_id: string | null
          attendance_mode: string | null
          aula_id: string | null
          checkin_at: string | null
          checkout_at: string | null
          created_at: string | null
          etapa_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes_seguranca: string | null
          responsavel_checkout_id: string | null
          status: string | null
        }
        Insert: {
          aluno_id?: string | null
          attendance_mode?: string | null
          aula_id?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string | null
          etapa_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes_seguranca?: string | null
          responsavel_checkout_id?: string | null
          status?: string | null
        }
        Update: {
          aluno_id?: string | null
          attendance_mode?: string | null
          aula_id?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string | null
          etapa_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes_seguranca?: string | null
          responsavel_checkout_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aula_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "presencas_aula_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "presencas_aula_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_jornada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_responsavel_checkout_id_fkey"
            columns: ["responsavel_checkout_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_aula_responsavel_checkout_id_fkey"
            columns: ["responsavel_checkout_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "presencas_aula_responsavel_checkout_id_fkey"
            columns: ["responsavel_checkout_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      profiles: {
        Row: {
          aceitou_jesus: boolean | null
          alergias: string | null
          autorizado_bot_financeiro: boolean | null
          avatar_url: string | null
          bairro: string | null
          batizado: boolean | null
          cadastrado_por: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          data_batismo: string | null
          data_cadastro_membro: string | null
          data_casamento: string | null
          data_conversao: string | null
          data_entrada: string | null
          data_nascimento: string | null
          data_primeira_visita: string | null
          data_ultima_visita: string | null
          deseja_contato: boolean | null
          deve_trocar_senha: boolean | null
          disponibilidade_agenda: Json | null
          e_lider: boolean | null
          e_pastor: boolean | null
          email: string | null
          endereco: string | null
          entrevistado_por: string | null
          entrou_por: string | null
          escolaridade: string | null
          estado: string | null
          estado_civil: string | null
          familia_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nacionalidade: string | null
          naturalidade: string | null
          necessidades_especiais: string | null
          nome: string
          numero_visitas: number
          observacoes: string | null
          profissao: string | null
          recebeu_brinde: boolean | null
          responsavel_legal: boolean | null
          rg: string | null
          sexo: string | null
          status: Database["public"]["Enums"]["user_status"]
          status_igreja: string | null
          telefone: string | null
          tipo_sanguineo: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aceitou_jesus?: boolean | null
          alergias?: string | null
          autorizado_bot_financeiro?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          batizado?: boolean | null
          cadastrado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_batismo?: string | null
          data_cadastro_membro?: string | null
          data_casamento?: string | null
          data_conversao?: string | null
          data_entrada?: string | null
          data_nascimento?: string | null
          data_primeira_visita?: string | null
          data_ultima_visita?: string | null
          deseja_contato?: boolean | null
          deve_trocar_senha?: boolean | null
          disponibilidade_agenda?: Json | null
          e_lider?: boolean | null
          e_pastor?: boolean | null
          email?: string | null
          endereco?: string | null
          entrevistado_por?: string | null
          entrou_por?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          familia_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          necessidades_especiais?: string | null
          nome: string
          numero_visitas?: number
          observacoes?: string | null
          profissao?: string | null
          recebeu_brinde?: boolean | null
          responsavel_legal?: boolean | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_igreja?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aceitou_jesus?: boolean | null
          alergias?: string | null
          autorizado_bot_financeiro?: boolean | null
          avatar_url?: string | null
          bairro?: string | null
          batizado?: boolean | null
          cadastrado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          data_batismo?: string | null
          data_cadastro_membro?: string | null
          data_casamento?: string | null
          data_conversao?: string | null
          data_entrada?: string | null
          data_nascimento?: string | null
          data_primeira_visita?: string | null
          data_ultima_visita?: string | null
          deseja_contato?: boolean | null
          deve_trocar_senha?: boolean | null
          disponibilidade_agenda?: Json | null
          e_lider?: boolean | null
          e_pastor?: boolean | null
          email?: string | null
          endereco?: string | null
          entrevistado_por?: string | null
          entrou_por?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          familia_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          necessidades_especiais?: string | null
          nome?: string
          numero_visitas?: number
          observacoes?: string | null
          profissao?: string | null
          recebeu_brinde?: boolean | null
          responsavel_legal?: boolean | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_igreja?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          lider_id: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lider_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lider_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "projetos_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      reclass_job_items: {
        Row: {
          antes: Json | null
          created_at: string
          depois: Json | null
          error_reason: string | null
          id: string
          job_id: string
          status: string
          transacao_id: string | null
        }
        Insert: {
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          error_reason?: string | null
          id?: string
          job_id: string
          status?: string
          transacao_id?: string | null
        }
        Update: {
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          error_reason?: string | null
          id?: string
          job_id?: string
          status?: string
          transacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reclass_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "reclass_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reclass_job_items_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      reclass_jobs: {
        Row: {
          campos_alterados: Json | null
          completed_at: string | null
          created_at: string
          error_reason: string | null
          filial_id: string | null
          filtros_aplicados: Json | null
          id: string
          igreja_id: string
          status: string
          tipo: string
          total_linhas: number
          user_id: string
        }
        Insert: {
          campos_alterados?: Json | null
          completed_at?: string | null
          created_at?: string
          error_reason?: string | null
          filial_id?: string | null
          filtros_aplicados?: Json | null
          id?: string
          igreja_id: string
          status?: string
          tipo: string
          total_linhas?: number
          user_id: string
        }
        Update: {
          campos_alterados?: Json | null
          completed_at?: string | null
          created_at?: string
          error_reason?: string | null
          filial_id?: string | null
          filtros_aplicados?: Json | null
          id?: string
          igreja_id?: string
          status?: string
          tipo?: string
          total_linhas?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclass_jobs_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclass_jobs_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliacao_audit_logs: {
        Row: {
          conciliacao_lote_id: string | null
          conta_id: string | null
          created_at: string
          diferenca: number | null
          extrato_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          score: number | null
          tipo_reconciliacao: string
          transacao_id: string | null
          usuario_id: string | null
          valor_extrato: number | null
          valor_transacao: number | null
        }
        Insert: {
          conciliacao_lote_id?: string | null
          conta_id?: string | null
          created_at?: string
          diferenca?: number | null
          extrato_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          score?: number | null
          tipo_reconciliacao: string
          transacao_id?: string | null
          usuario_id?: string | null
          valor_extrato?: number | null
          valor_transacao?: number | null
        }
        Update: {
          conciliacao_lote_id?: string | null
          conta_id?: string | null
          created_at?: string
          diferenca?: number | null
          extrato_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          score?: number | null
          tipo_reconciliacao?: string
          transacao_id?: string | null
          usuario_id?: string | null
          valor_extrato?: number | null
          valor_transacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliacao_audit_logs_conciliacao_lote_id_fkey"
            columns: ["conciliacao_lote_id"]
            isOneToOne: false
            referencedRelation: "conciliacoes_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["extrato_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      respostas_quiz: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          etapa_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          inscricao_id: string | null
          nota_obtida: number | null
          respostas: Json
          tentativa_numero: number | null
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          etapa_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          inscricao_id?: string | null
          nota_obtida?: number | null
          respostas: Json
          tentativa_numero?: number | null
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          etapa_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          inscricao_id?: string | null
          nota_obtida?: number | null
          respostas?: Json
          tentativa_numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_quiz_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_jornada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_quiz_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_quiz_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_quiz_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes_jornada"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_teste: {
        Row: {
          avaliado_por: string | null
          candidato_id: string
          created_at: string | null
          feedback: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          integracao_id: string
          pontuacao_total: number | null
          resposta_json: Json | null
          resultado: string
          teste_id: string
          updated_at: string | null
        }
        Insert: {
          avaliado_por?: string | null
          candidato_id: string
          created_at?: string | null
          feedback?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          integracao_id: string
          pontuacao_total?: number | null
          resposta_json?: Json | null
          resultado: string
          teste_id: string
          updated_at?: string | null
        }
        Update: {
          avaliado_por?: string | null
          candidato_id?: string
          created_at?: string | null
          feedback?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          integracao_id?: string
          pontuacao_total?: number | null
          resposta_json?: Json | null
          resultado?: string
          teste_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resultados_teste_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_teste_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "resultados_teste_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "resultados_teste_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "candidatos_voluntario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_teste_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_teste_integracao_id_fkey"
            columns: ["integracao_id"]
            isOneToOne: false
            referencedRelation: "integracao_voluntario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_teste_teste_id_fkey"
            columns: ["teste_id"]
            isOneToOne: false
            referencedRelation: "testes_ministerio"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: number
          role_id: number
        }
        Insert: {
          permission_id: number
          role_id: number
        }
        Update: {
          permission_id?: number
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "app_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          new_row: Json | null
          old_row: Json | null
          permission_id: number
          request_id: string | null
          role_id: number
          source: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          permission_id: number
          request_id?: string | null
          role_id: number
          source?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          permission_id?: number
          request_id?: string | null
          role_id?: number
          source?: string | null
        }
        Relationships: []
      }
      salas: {
        Row: {
          ativo: boolean | null
          capacidade: number | null
          created_at: string | null
          filial_id: string | null
          id: string
          idade_max: number | null
          idade_min: number | null
          igreja_id: string | null
          nome: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          capacidade?: number | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          idade_max?: number | null
          idade_min?: number | null
          igreja_id?: string | null
          nome: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          capacidade?: number | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          idade_max?: number | null
          idade_min?: number | null
          igreja_id?: string | null
          nome?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      sentimentos_membros: {
        Row: {
          analise_ia_gravidade: string | null
          analise_ia_motivo: string | null
          analise_ia_resposta: string | null
          analise_ia_titulo: string | null
          created_at: string
          data_registro: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          mensagem: string | null
          pessoa_id: string
          sentimento: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at: string
        }
        Insert: {
          analise_ia_gravidade?: string | null
          analise_ia_motivo?: string | null
          analise_ia_resposta?: string | null
          analise_ia_titulo?: string | null
          created_at?: string
          data_registro?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          mensagem?: string | null
          pessoa_id: string
          sentimento: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at?: string
        }
        Update: {
          analise_ia_gravidade?: string | null
          analise_ia_motivo?: string | null
          analise_ia_resposta?: string | null
          analise_ia_titulo?: string | null
          created_at?: string
          data_registro?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          mensagem?: string | null
          pessoa_id?: string
          sentimento?: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentimentos_membros_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentimentos_membros_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentimentos_membros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentimentos_membros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "sentimentos_membros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      sessoes_contagem: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          blind_compare_level: string
          blind_count_mode: string
          blind_lock_totals: boolean
          blind_min_counters: number
          blind_tolerance_value: number
          conferentes: Json
          created_at: string
          created_by: string | null
          data_culto: string
          data_fechamento: string | null
          evento_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          periodo: string
          provider_tipo: string | null
          rejection_at: string | null
          rejection_by: string | null
          rejection_reason_code: string | null
          rejection_reason_note: string | null
          secret_hint: string | null
          status: string
          sync_strategy: string | null
          updated_at: string
          variance_by_tipo: Json | null
          variance_value: number | null
          webhook_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          blind_compare_level: string
          blind_count_mode: string
          blind_lock_totals: boolean
          blind_min_counters: number
          blind_tolerance_value: number
          conferentes?: Json
          created_at?: string
          created_by?: string | null
          data_culto: string
          data_fechamento?: string | null
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          periodo: string
          provider_tipo?: string | null
          rejection_at?: string | null
          rejection_by?: string | null
          rejection_reason_code?: string | null
          rejection_reason_note?: string | null
          secret_hint?: string | null
          status?: string
          sync_strategy?: string | null
          updated_at?: string
          variance_by_tipo?: Json | null
          variance_value?: number | null
          webhook_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          blind_compare_level?: string
          blind_count_mode?: string
          blind_lock_totals?: boolean
          blind_min_counters?: number
          blind_tolerance_value?: number
          conferentes?: Json
          created_at?: string
          created_by?: string | null
          data_culto?: string
          data_fechamento?: string | null
          evento_id?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          periodo?: string
          provider_tipo?: string | null
          rejection_at?: string | null
          rejection_by?: string | null
          rejection_reason_code?: string | null
          rejection_reason_note?: string | null
          secret_hint?: string | null
          status?: string
          sync_strategy?: string | null
          updated_at?: string
          variance_by_tipo?: Json | null
          variance_value?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_contagem_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sessoes_contagem_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sessoes_contagem_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_contagem_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_contagem_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_contagem_rejection_by_fkey"
            columns: ["rejection_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sessoes_itens_draft: {
        Row: {
          categoria_id: string | null
          conta_id: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          filial_id: string | null
          forma_pagamento_id: string | null
          id: string
          igreja_id: string
          is_digital: boolean
          origem_registro: string
          pessoa_id: string | null
          read_only: boolean
          sessao_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          filial_id?: string | null
          forma_pagamento_id?: string | null
          id?: string
          igreja_id: string
          is_digital?: boolean
          origem_registro?: string
          pessoa_id?: string | null
          read_only?: boolean
          sessao_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria_id?: string | null
          conta_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          filial_id?: string | null
          forma_pagamento_id?: string | null
          id?: string
          igreja_id?: string
          is_digital?: boolean
          origem_registro?: string
          pessoa_id?: string | null
          read_only?: boolean
          sessao_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_itens_draft_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "sessoes_itens_draft_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_contagem"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          is_all_filiais: boolean
          slug: string
          target_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          is_all_filiais?: boolean
          slug: string
          target_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          is_all_filiais?: boolean
          slug?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_links_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_links_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_reembolso: {
        Row: {
          comprovante_pagamento_url: string | null
          created_at: string | null
          dados_bancarios: string | null
          data_pagamento: string | null
          data_solicitacao: string
          data_vencimento: string | null
          filial_id: string | null
          forma_pagamento_preferida: string | null
          id: string
          igreja_id: string | null
          observacoes: string | null
          solicitante_id: string
          status: string
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          comprovante_pagamento_url?: string | null
          created_at?: string | null
          dados_bancarios?: string | null
          data_pagamento?: string | null
          data_solicitacao?: string
          data_vencimento?: string | null
          filial_id?: string | null
          forma_pagamento_preferida?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          solicitante_id: string
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          comprovante_pagamento_url?: string | null
          created_at?: string | null
          dados_bancarios?: string | null
          data_pagamento?: string | null
          data_solicitacao?: string
          data_vencimento?: string | null
          filial_id?: string | null
          forma_pagamento_preferida?: string | null
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          solicitante_id?: string
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_reembolso_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      subcategorias_financeiras: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategorias_financeiras_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategorias_financeiras_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      tags_midias: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_midias_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_midias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data_vencimento: string | null
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          prioridade: string | null
          projeto_id: string
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          prioridade?: string | null
          projeto_id: string
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          prioridade?: string | null
          projeto_id?: string
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "tarefas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      templates_culto: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          duracao_padrao: number | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          incluir_escalas: boolean | null
          local_padrao: string | null
          nome: string
          observacoes_padrao: string | null
          pregador_padrao: string | null
          tema_padrao: string | null
          tipo_culto: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_padrao?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          incluir_escalas?: boolean | null
          local_padrao?: string | null
          nome: string
          observacoes_padrao?: string | null
          pregador_padrao?: string | null
          tema_padrao?: string | null
          tipo_culto?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_padrao?: number | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          incluir_escalas?: boolean | null
          local_padrao?: string | null
          nome?: string
          observacoes_padrao?: string | null
          pregador_padrao?: string | null
          tema_padrao?: string | null
          tipo_culto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_culto_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_culto_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_metricas: {
        Row: {
          created_at: string | null
          data_referencia: string
          id: string
          igreja_id: string
          latencia_media_ms: number | null
          membros_ativos: number | null
          storage_bytes: number | null
          total_chamadas_api: number | null
          total_checkins: number | null
          total_erros_api: number | null
          total_eventos: number | null
          total_membros: number | null
          total_midias: number | null
          total_pedidos_oracao: number | null
          total_transacoes: number | null
          updated_at: string | null
          valor_transacoes: number | null
        }
        Insert: {
          created_at?: string | null
          data_referencia: string
          id?: string
          igreja_id: string
          latencia_media_ms?: number | null
          membros_ativos?: number | null
          storage_bytes?: number | null
          total_chamadas_api?: number | null
          total_checkins?: number | null
          total_erros_api?: number | null
          total_eventos?: number | null
          total_membros?: number | null
          total_midias?: number | null
          total_pedidos_oracao?: number | null
          total_transacoes?: number | null
          updated_at?: string | null
          valor_transacoes?: number | null
        }
        Update: {
          created_at?: string | null
          data_referencia?: string
          id?: string
          igreja_id?: string
          latencia_media_ms?: number | null
          membros_ativos?: number | null
          storage_bytes?: number | null
          total_chamadas_api?: number | null
          total_checkins?: number | null
          total_erros_api?: number | null
          total_eventos?: number | null
          total_membros?: number | null
          total_midias?: number | null
          total_pedidos_oracao?: number | null
          total_transacoes?: number | null
          updated_at?: string | null
          valor_transacoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_metricas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      testemunhos: {
        Row: {
          anonimo: boolean | null
          autor_id: string | null
          categoria: Database["public"]["Enums"]["categoria_testemunho"]
          created_at: string
          data_publicacao: string | null
          email_externo: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          mensagem: string
          nome_externo: string | null
          pessoa_id: string | null
          publicar: boolean
          status: Database["public"]["Enums"]["status_testemunho"]
          telefone_externo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          anonimo?: boolean | null
          autor_id?: string | null
          categoria?: Database["public"]["Enums"]["categoria_testemunho"]
          created_at?: string
          data_publicacao?: string | null
          email_externo?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          mensagem: string
          nome_externo?: string | null
          pessoa_id?: string | null
          publicar?: boolean
          status?: Database["public"]["Enums"]["status_testemunho"]
          telefone_externo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          anonimo?: boolean | null
          autor_id?: string | null
          categoria?: Database["public"]["Enums"]["categoria_testemunho"]
          created_at?: string
          data_publicacao?: string | null
          email_externo?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          mensagem?: string
          nome_externo?: string | null
          pessoa_id?: string | null
          publicar?: boolean
          status?: Database["public"]["Enums"]["status_testemunho"]
          telefone_externo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testemunhos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testemunhos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "testemunhos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "testemunhos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testemunhos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testemunhos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testemunhos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "testemunhos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      testes_ministerio: {
        Row: {
          ativo: boolean | null
          conteudo_json: Json | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          pontuacao_minima_aprovacao: number | null
          time_id: string
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          conteudo_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id: string
          pontuacao_minima_aprovacao?: number | null
          time_id: string
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          conteudo_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string
          pontuacao_minima_aprovacao?: number | null
          time_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testes_ministerio_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testes_ministerio_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "testes_ministerio_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "testes_ministerio_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testes_ministerio_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times"
            referencedColumns: ["id"]
          },
        ]
      }
      times: {
        Row: {
          ativo: boolean
          categoria: string
          cor: string | null
          created_at: string
          descricao: string | null
          dificuldade: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          lider_id: string | null
          nome: string
          sublider_id: string | null
          updated_at: string
          vagas_necessarias: number | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dificuldade?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lider_id?: string | null
          nome: string
          sublider_id?: string | null
          updated_at?: string
          vagas_necessarias?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          dificuldade?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          lider_id?: string | null
          nome?: string
          sublider_id?: string | null
          updated_at?: string
          vagas_necessarias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "times_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "times_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "times_sublider_id_fkey"
            columns: ["sublider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_sublider_id_fkey"
            columns: ["sublider_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "times_sublider_id_fkey"
            columns: ["sublider_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      transacoes_financeiras: {
        Row: {
          anexo_url: string | null
          base_ministerial_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          conferido_manual: boolean
          conta_id: string
          created_at: string
          data_competencia: string | null
          data_fim_recorrencia: string | null
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          descricao: string
          filial_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          igreja_id: string | null
          juros: number | null
          lancado_por: string | null
          multas: number | null
          numero_parcela: number | null
          observacoes: string | null
          origem_registro: string
          pessoa_id: string | null
          recorrencia: string | null
          sessao_id: string | null
          solicitacao_reembolso_id: string | null
          status: string
          subcategoria_id: string | null
          taxas_administrativas: number | null
          tipo: string
          tipo_lancamento: string
          total_parcelas: number | null
          transferencia_id: string | null
          updated_at: string
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          anexo_url?: string | null
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conferido_manual?: boolean
          conta_id: string
          created_at?: string
          data_competencia?: string | null
          data_fim_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          descricao: string
          filial_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          igreja_id?: string | null
          juros?: number | null
          lancado_por?: string | null
          multas?: number | null
          numero_parcela?: number | null
          observacoes?: string | null
          origem_registro?: string
          pessoa_id?: string | null
          recorrencia?: string | null
          sessao_id?: string | null
          solicitacao_reembolso_id?: string | null
          status?: string
          subcategoria_id?: string | null
          taxas_administrativas?: number | null
          tipo: string
          tipo_lancamento: string
          total_parcelas?: number | null
          transferencia_id?: string | null
          updated_at?: string
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          anexo_url?: string | null
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conferido_manual?: boolean
          conta_id?: string
          created_at?: string
          data_competencia?: string | null
          data_fim_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          descricao?: string
          filial_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          igreja_id?: string | null
          juros?: number | null
          lancado_por?: string | null
          multas?: number | null
          numero_parcela?: number | null
          observacoes?: string | null
          origem_registro?: string
          pessoa_id?: string | null
          recorrencia?: string | null
          sessao_id?: string | null
          solicitacao_reembolso_id?: string | null
          status?: string
          subcategoria_id?: string | null
          taxas_administrativas?: number | null
          tipo?: string
          tipo_lancamento?: string
          total_parcelas?: number | null
          transferencia_id?: string | null
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_base_ministerial_id_fkey"
            columns: ["base_ministerial_id"]
            isOneToOne: false
            referencedRelation: "bases_ministeriais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_lancado_por_fkey"
            columns: ["lancado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_contagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_solicitacao_reembolso_id_fkey"
            columns: ["solicitacao_reembolso_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_reembolso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_solicitacao_reembolso_id_fkey"
            columns: ["solicitacao_reembolso_id"]
            isOneToOne: false
            referencedRelation: "view_solicitacoes_reembolso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_contas: {
        Row: {
          anexo_url: string | null
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          criado_por: string | null
          data_competencia: string
          data_transferencia: string
          filial_id: string | null
          id: string
          igreja_id: string
          observacoes: string | null
          sessao_id: string | null
          status: string
          transacao_entrada_id: string | null
          transacao_saida_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          anexo_url?: string | null
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          criado_por?: string | null
          data_competencia?: string
          data_transferencia?: string
          filial_id?: string | null
          id?: string
          igreja_id: string
          observacoes?: string | null
          sessao_id?: string | null
          status?: string
          transacao_entrada_id?: string | null
          transacao_saida_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          anexo_url?: string | null
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          criado_por?: string | null
          data_competencia?: string
          data_transferencia?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string
          observacoes?: string | null
          sessao_id?: string | null
          status?: string
          transacao_entrada_id?: string | null
          transacao_saida_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_contas_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "atendimentos_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_entrada_id_fkey"
            columns: ["transacao_entrada_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "mv_conciliacao_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "transacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_candidatos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_exemplos_positivos"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "view_conciliacao_ml_export_dataset"
            referencedColumns: ["transacao_id"]
          },
          {
            foreignKeyName: "transferencias_contas_transacao_saida_id_fkey"
            columns: ["transacao_saida_id"]
            isOneToOne: false
            referencedRelation: "view_movimento_contabil"
            referencedColumns: ["transacao_id"]
          },
        ]
      }
      user_app_roles: {
        Row: {
          role_id: number
          user_id: string
        }
        Insert: {
          role_id: number
          user_id: string
        }
        Update: {
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_app_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_filial_access: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          filial_id: string
          granted_by: string | null
          id: string
          igreja_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          filial_id: string
          granted_by?: string | null
          id?: string
          igreja_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          filial_id?: string
          granted_by?: string | null
          id?: string
          igreja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_filial_access_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_filial_access_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          igreja_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          igreja_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          igreja_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitante_contatos: {
        Row: {
          created_at: string | null
          data_contato: string
          filial_id: string | null
          id: string
          igreja_id: string | null
          membro_responsavel_id: string
          observacoes: string | null
          status: string | null
          tipo_contato: string | null
          updated_at: string | null
          visitante_id: string
        }
        Insert: {
          created_at?: string | null
          data_contato: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          membro_responsavel_id: string
          observacoes?: string | null
          status?: string | null
          tipo_contato?: string | null
          updated_at?: string | null
          visitante_id: string
        }
        Update: {
          created_at?: string | null
          data_contato?: string
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          membro_responsavel_id?: string
          observacoes?: string | null
          status?: string | null
          tipo_contato?: string | null
          updated_at?: string | null
          visitante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_membro_responsavel"
            columns: ["membro_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_visitante"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visitante"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "fk_visitante"
            columns: ["visitante_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "visitante_contatos_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitante_contatos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitantes_leads: {
        Row: {
          created_at: string | null
          data_ultimo_contato: string | null
          email: string | null
          estagio_funil: string | null
          filial_id: string | null
          id: string
          igreja_id: string | null
          nome: string | null
          observacoes: string | null
          origem: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          estagio_funil?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          estagio_funil?: string | null
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitantes_leads_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitantes_leads_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          enabled: boolean
          filial_id: string | null
          id: string
          igreja_id: string | null
          secret: string | null
          secret_encrypted: string | null
          secret_hint: string | null
          tipo: string
          updated_at: string | null
          url: string | null
          whatsapp_numero_id: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          secret?: string | null
          secret_encrypted?: string | null
          secret_hint?: string | null
          tipo: string
          updated_at?: string | null
          url?: string | null
          whatsapp_numero_id?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          secret?: string | null
          secret_encrypted?: string | null
          secret_hint?: string | null
          tipo?: string
          updated_at?: string | null
          url?: string | null
          whatsapp_numero_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_whatsapp_numero_id_fkey"
            columns: ["whatsapp_numero_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_numeros"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_numeros: {
        Row: {
          created_at: string | null
          display_phone_number: string | null
          enabled: boolean
          filial_id: string | null
          id: string
          igreja_id: string | null
          phone_number_id: string | null
          provider: string
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_phone_number?: string | null
          enabled?: boolean
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          phone_number_id?: string | null
          provider?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_phone_number?: string | null
          enabled?: boolean
          filial_id?: string | null
          id?: string
          igreja_id?: string | null
          phone_number_id?: string | null
          provider?: string
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_numeros_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_numeros_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_conciliacao_dataset: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          conta_id: string | null
          diferenca_dias: number | null
          diferenca_valor: number | null
          extrato_created_at: string | null
          extrato_data: string | null
          extrato_descricao: string | null
          extrato_id: string | null
          extrato_tipo: string | null
          extrato_valor: number | null
          filial_id: string | null
          fornecedor_id: string | null
          igreja_id: string | null
          label: number | null
          match_tipo: number | null
          pessoa_id: string | null
          reconciliado: boolean | null
          similaridade_data: number | null
          similaridade_descricao: number | null
          similaridade_valor: number | null
          subcategoria_id: string | null
          transacao_created_at: string | null
          transacao_data: string | null
          transacao_descricao: string | null
          transacao_id: string | null
          transacao_tipo: string | null
          transacao_valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      view_absent_kids: {
        Row: {
          alergias: string | null
          child_id: string | null
          data_nascimento: string | null
          days_absent: number | null
          full_name: string | null
          last_visit: string | null
          parent_name: string | null
          parent_phone: string | null
        }
        Relationships: []
      }
      view_agenda_secretaria: {
        Row: {
          conteudo: string | null
          created_at: string | null
          data_agendamento: string | null
          id: string | null
          local_atendimento: string | null
          pastor_nome: string | null
          pastor_responsavel_id: string | null
          pessoa_nome: string | null
          status: Database["public"]["Enums"]["status_atendimento_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "atendimentos_pastorais_pastor_responsavel_id_fkey"
            columns: ["pastor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      view_conciliacao_candidatos: {
        Row: {
          categoria_id: string | null
          conta_id: string | null
          diferenca_dias: number | null
          diferenca_valor: number | null
          extrato_id: string | null
          extrato_valor: number | null
          filial_id: string | null
          igreja_id: string | null
          match_tipo: number | null
          score_heuristico: number | null
          similaridade_data: number | null
          similaridade_descricao: number | null
          similaridade_valor: number | null
          subcategoria_id: string | null
          transacao_id: string | null
          transacao_valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      view_conciliacao_exemplos_positivos: {
        Row: {
          categoria_id: string | null
          conta_id: string | null
          diferenca_dias: number | null
          diferenca_valor: number | null
          extrato_id: string | null
          extrato_valor: number | null
          filial_id: string | null
          igreja_id: string | null
          match_tipo: number | null
          similaridade_data: number | null
          similaridade_descricao: number | null
          similaridade_valor: number | null
          subcategoria_id: string | null
          transacao_id: string | null
          transacao_valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_financeiras_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      view_conciliacao_ml_dashboard: {
        Row: {
          conta_id: string | null
          conta_nome: string | null
          extratos_nao_conciliados: number | null
          feedback_30dias: number | null
          feedback_7dias: number | null
          filial_id: string | null
          igreja_id: string | null
          percentual_alta_confianca: number | null
          score_medio_aceitas_30d: number | null
          sugestoes_alto_score: number | null
          sugestoes_baixo_score: number | null
          sugestoes_medio_score: number | null
          sugestoes_pendentes: number | null
          valor_pendente: number | null
        }
        Relationships: []
      }
      view_conciliacao_ml_export_dataset: {
        Row: {
          categoria_nome: string | null
          conta_id: string | null
          diferenca_dias: number | null
          diferenca_valor: number | null
          extrato_id: string | null
          extrato_tipo: string | null
          extrato_valor: number | null
          igreja_id: string | null
          label: number | null
          match_tipo: number | null
          similaridade_data: number | null
          similaridade_descricao: number | null
          similaridade_valor: number | null
          subcategoria_nome: string | null
          transacao_id: string | null
          transacao_tipo: string | null
          transacao_valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_conciliacao_ml_features_stats: {
        Row: {
          acao: string | null
          diferenca_dias_media: number | null
          diferenca_valor_media: number | null
          igreja_id: string | null
          match_tipo_count: number | null
          quantidade: number | null
          score_medio: number | null
          tipo_match: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_ml_feedback_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_conciliacao_ml_metricas: {
        Row: {
          aceitas: number | null
          ajustadas: number | null
          conta_id: string | null
          filial_id: string | null
          igreja_id: string | null
          modelo_versao: string | null
          periodo: string | null
          rejeitadas: number | null
          score_medio_aceitas: number | null
          score_medio_geral: number | null
          score_medio_rejeitadas: number | null
          taxa_aceitacao: number | null
          total_sugestoes: number | null
          usuarios_ativos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacao_ml_feedback_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacao_ml_feedback_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_edge_function_daily_stats: {
        Row: {
          avg_time_ms: number | null
          errors: number | null
          execution_date: string | null
          function_name: string | null
          successful: number | null
          total: number | null
        }
        Relationships: []
      }
      view_edge_function_stats: {
        Row: {
          avg_execution_time_ms: number | null
          errors: number | null
          function_name: string | null
          last_execution: string | null
          max_execution_time_ms: number | null
          min_execution_time_ms: number | null
          success_rate: number | null
          successful: number | null
          timeouts: number | null
          total_executions: number | null
        }
        Relationships: []
      }
      view_faltas_evento: {
        Row: {
          checkin_id: string | null
          evento_id: string | null
          faltou: boolean | null
          inscricao_status: string | null
          pessoa_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      view_health_score: {
        Row: {
          avatar_url: string | null
          nome: string | null
          pessoa_id: string | null
          score_presenca: number | null
          score_sentimento: number | null
          score_servico: number | null
          status: Database["public"]["Enums"]["user_status"] | null
        }
        Insert: {
          avatar_url?: string | null
          nome?: string | null
          pessoa_id?: string | null
          score_presenca?: never
          score_sentimento?: never
          score_servico?: never
          status?: Database["public"]["Enums"]["user_status"] | null
        }
        Update: {
          avatar_url?: string | null
          nome?: string | null
          pessoa_id?: string | null
          score_presenca?: never
          score_sentimento?: never
          score_servico?: never
          status?: Database["public"]["Enums"]["user_status"] | null
        }
        Relationships: []
      }
      view_kids_checkins_ativos: {
        Row: {
          checkin_at: string | null
          checkin_por: string | null
          checkin_por_nome: string | null
          crianca_avatar: string | null
          crianca_data_nascimento: string | null
          crianca_id: string | null
          crianca_nome: string | null
          evento_id: string | null
          id: string | null
          observacoes: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_checkin_por_fkey"
            columns: ["checkin_por"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_checkins_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_checkins_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      view_kids_diario: {
        Row: {
          comportamento_tags: string[] | null
          created_at: string | null
          crianca_avatar: string | null
          crianca_id: string | null
          crianca_nascimento: string | null
          crianca_nome: string | null
          culto_data: string | null
          culto_id: string | null
          culto_titulo: string | null
          data: string | null
          humor: string | null
          id: string | null
          necessidades_tags: string[] | null
          observacoes: string | null
          professor_id: string | null
          professor_nome: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_diario_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "kids_diario_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "kids_diario_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      view_movimento_contabil: {
        Row: {
          base_ministerial_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          data_competencia: string | null
          data_pagamento: string | null
          fornecedor_nome: string | null
          item_descricao: string | null
          item_valor: number | null
          origem: string | null
          status: string | null
          subcategoria_id: string | null
          tipo: string | null
          transacao_id: string | null
          valor_contabil: number | null
          valor_total_saida: number | null
        }
        Relationships: []
      }
      view_reconciliacao_cobertura: {
        Row: {
          conta_id: string | null
          conta_nome: string | null
          extratos_pendentes: number | null
          extratos_reconciliados: number | null
          filial_id: string | null
          igreja_id: string | null
          percentual_cobertura: number | null
          periodo: string | null
          total_extratos: number | null
          valor_pendente: number | null
          valor_reconciliado: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_reconciliacao_estatisticas: {
        Row: {
          conta_id: string | null
          diferenca_media: number | null
          filial_id: string | null
          igreja_id: string | null
          periodo: string | null
          quantidade: number | null
          score_medio: number | null
          tipo_reconciliacao: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliacao_audit_logs_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliacao_audit_logs_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_room_occupancy: {
        Row: {
          capacity: number | null
          current_count: number | null
          idade_max: number | null
          idade_min: number | null
          occupancy_rate: number | null
          room_name: string | null
          sala_id: string | null
        }
        Relationships: []
      }
      view_solicitacoes_reembolso: {
        Row: {
          comprovante_pagamento_url: string | null
          created_at: string | null
          dados_bancarios: string | null
          data_pagamento: string | null
          data_solicitacao: string | null
          data_vencimento: string | null
          filial_id: string | null
          forma_pagamento_preferida: string | null
          id: string | null
          igreja_id: string | null
          observacoes: string | null
          quantidade_itens: number | null
          solicitante_avatar: string | null
          solicitante_email: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          solicitante_telefone: string | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_reembolso_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "view_absent_kids"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "solicitacoes_reembolso_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "view_health_score"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      webhooks_safe: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          filial_id: string | null
          has_secret: boolean | null
          id: string | null
          igreja_id: string | null
          secret_masked: string | null
          tipo: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          filial_id?: string | null
          has_secret?: never
          id?: string | null
          igreja_id?: string | null
          secret_masked?: never
          tipo?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          filial_id?: string | null
          has_secret?: never
          id?: string | null
          igreja_id?: string | null
          secret_masked?: never
          tipo?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_filial_id_fkey"
            columns: ["filial_id"]
            isOneToOne: false
            referencedRelation: "filiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      alocar_pedido_balanceado: {
        Args: { p_pedido_id: string }
        Returns: string
      }
      aplicar_conciliacao:
        | {
            Args: { p_extrato_id: string; p_transacao_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_extrato_id: string
              p_score?: number
              p_tipo?: string
              p_transacao_id: string
              p_usuario_id?: string
            }
            Returns: boolean
          }
      aplicar_sugestao_conciliacao: {
        Args: { p_sugestao_id: string; p_usuario_id?: string }
        Returns: boolean
      }
      aprovar_onboarding: { Args: { p_request_id: string }; Returns: Json }
      buscar_pessoa_por_contato: {
        Args: { p_email?: string; p_nome?: string; p_telefone?: string }
        Returns: string
      }
      calcular_metricas_tenant: {
        Args: { p_data?: string; p_igreja_id: string }
        Returns: string
      }
      check_lote_disponivel: { Args: { p_lote_id: string }; Returns: boolean }
      check_voluntario_conflito:
        | {
            Args: {
              p_escala_id?: string
              p_evento_id: string
              p_pessoa_id: string
            }
            Returns: {
              mensagem: string
              tem_conflito: boolean
            }[]
          }
        | {
            Args: {
              p_data_inicio: string
              p_duracao_minutos?: number
              p_voluntario_id: string
            }
            Returns: {
              conflito_detectado: boolean
              evento_data: string
              evento_titulo: string
              time_nome: string
            }[]
          }
      checkin_por_localizacao: {
        Args: { p_lat: number; p_long: number; p_telefone: string }
        Returns: Json
      }
      confrontar_contagens: {
        Args: { p_sessao_id: string }
        Returns: {
          status: string
          variance_by_tipo: Json
          variance_value: number
        }[]
      }
      create_filial_short_links: {
        Args: {
          p_filial_id: string
          p_filial_nome: string
          p_igreja_id: string
        }
        Returns: undefined
      }
      criar_usuario_membro: {
        Args: {
          p_email: string
          p_profile_id: string
          p_senha_temporaria: string
        }
        Returns: {
          message: string
          success: boolean
          user_id: string
        }[]
      }
      generate_filial_slug: {
        Args: { p_igreja_id: string; p_nome: string }
        Returns: string
      }
      gerar_candidatos_conciliacao: {
        Args: {
          p_conta_id?: string
          p_igreja_id: string
          p_mes_fim?: string
          p_mes_inicio?: string
          p_score_minimo?: number
        }
        Returns: {
          extrato_id: string
          features: Json
          score: number
          tipo_match: string
          transacao_ids: string[]
        }[]
      }
      get_current_user_filial_id: { Args: never; Returns: string }
      get_current_user_igreja_id: { Args: never; Returns: string }
      get_default_filial_id: { Args: { _igreja_id: string }; Returns: string }
      get_dre_anual: {
        Args: { p_ano: number }
        Returns: {
          categoria_id: string
          categoria_nome: string
          mes: number
          secao_dre: string
          total: number
        }[]
      }
      get_jwt_filial_id: { Args: never; Returns: string }
      get_jwt_igreja_id: { Args: never; Returns: string }
      get_minha_lista_chamada: {
        Args: { p_evento_id: string }
        Returns: {
          avatar_url: string
          ja_marcado: boolean
          nome: string
          nome_grupo: string
          pessoa_id: string
          tipo_grupo: string
        }[]
      }
      get_ovelhas_em_risco:
        | {
            Args: never
            Returns: {
              avatar_url: string
              detalhe: string
              gravidade: number
              id: string
              nome: string
              telefone: string
              tipo_risco: string
            }[]
          }
        | {
            Args: { p_filial_id: string; p_is_all?: boolean }
            Returns: {
              avatar_url: string
              detalhe: string
              gravidade: number
              id: string
              nome: string
              telefone: string
              tipo_risco: string
            }[]
          }
      get_super_admin_dashboard: { Args: never; Returns: Json }
      get_user_auth_context: { Args: { p_user_id: string }; Returns: Json }
      get_user_familia_id: { Args: { _user_id: string }; Returns: string }
      get_user_module_access: {
        Args: { _module_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["access_level"]
      }
      get_webhook_secret: {
        Args: { p_encryption_key: string; p_igreja_id: string; p_tipo: string }
        Returns: string
      }
      has_filial_access: {
        Args: { _filial_id: string; _igreja_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_slug: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_igreja: {
        Args: {
          _igreja_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banner_active: {
        Args: {
          p_active: boolean
          p_expires_at: string
          p_scheduled_at: string
        }
        Returns: boolean
      }
      is_ip_blocked: { Args: { p_ip: string }; Returns: boolean }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      is_midia_active: {
        Args: { p_ativo: boolean; p_expires_at: string; p_scheduled_at: string }
        Returns: boolean
      }
      log_edge_function_execution: {
        Args: { p_details?: string; p_function_name: string; p_status: string }
        Returns: undefined
      }
      log_edge_function_with_metrics: {
        Args: {
          p_error_message?: string
          p_execution_time_ms?: number
          p_function_name: string
          p_request_payload?: Json
          p_response_payload?: Json
          p_status: string
        }
        Returns: string
      }
      log_rate_limit_violation: {
        Args: { p_endpoint: string; p_ip: string }
        Returns: undefined
      }
      mask_cpf_cnpj: { Args: { cpf_cnpj: string }; Returns: string }
      notify_admins: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_related_user_id?: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      open_sessao_contagem: {
        Args: {
          p_data_culto: string
          p_filial_id: string
          p_igreja_id: string
          p_periodo: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          blind_compare_level: string
          blind_count_mode: string
          blind_lock_totals: boolean
          blind_min_counters: number
          blind_tolerance_value: number
          conferentes: Json
          created_at: string
          created_by: string | null
          data_culto: string
          data_fechamento: string | null
          evento_id: string | null
          filial_id: string | null
          id: string
          igreja_id: string
          periodo: string
          provider_tipo: string | null
          rejection_at: string | null
          rejection_by: string | null
          rejection_reason_code: string | null
          rejection_reason_note: string | null
          secret_hint: string | null
          status: string
          sync_strategy: string | null
          updated_at: string
          variance_by_tipo: Json | null
          variance_value: number | null
          webhook_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sessoes_contagem"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reconciliar_transacoes: {
        Args: {
          p_conta_id: string
          p_tolerancia_dias?: number
          p_tolerancia_valor?: number
        }
        Returns: {
          extrato_id: string
          score: number
          transacao_id: string
        }[]
      }
      refresh_conciliacao_dataset: { Args: never; Returns: undefined }
      rejeitar_sugestao_conciliacao: {
        Args: { p_sugestao_id: string; p_usuario_id?: string }
        Returns: boolean
      }
      resetar_senha_usuario_membro: {
        Args: { p_profile_id: string; p_senha_temporaria: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      rollback_audit_batch: {
        Args: { target_request_id: string }
        Returns: undefined
      }
      save_permissions_batch: {
        Args: { p_deletes: Json; p_inserts: Json; p_request_id: string }
        Returns: undefined
      }
      set_audit_context: {
        Args: { p_request_id: string; p_source?: string }
        Returns: undefined
      }
      set_webhook_secret: {
        Args: {
          p_encryption_key: string
          p_igreja_id: string
          p_secret: string
          p_tipo: string
        }
        Returns: undefined
      }
    }
    Enums: {
      access_level:
        | "visualizar"
        | "criar_editar"
        | "aprovar_gerenciar"
        | "acesso_completo"
      app_role:
        | "admin"
        | "pastor"
        | "lider"
        | "secretario"
        | "tesoureiro"
        | "professor"
        | "membro"
        | "basico"
        | "tecnico"
        | "admin_igreja"
        | "admin_filial"
        | "super_admin"
      categoria_testemunho:
        | "espiritual"
        | "casamento"
        | "familia"
        | "saude"
        | "trabalho"
        | "financeiro"
        | "ministerial"
        | "outro"
      evento_tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO"
      gravidade_enum: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA"
      sentimento_tipo:
        | "feliz"
        | "cuidadoso"
        | "abencoado"
        | "grato"
        | "angustiado"
        | "sozinho"
        | "triste"
        | "doente"
        | "com_pouca_fe"
      status_atendimento_enum:
        | "PENDENTE"
        | "TRIAGEM"
        | "AGENDADO"
        | "EM_ACOMPANHAMENTO"
        | "CONCLUIDO"
      status_intercessor: "ATIVO" | "PAUSA" | "FERIAS"
      status_pedido: "pendente" | "em_oracao" | "respondido" | "arquivado"
      status_sessao_chat: "INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "EXPIRADO"
      status_testemunho: "aberto" | "publico" | "arquivado"
      tipo_comunicado: "banner" | "alerta"
      tipo_pedido:
        | "saude"
        | "familia"
        | "financeiro"
        | "trabalho"
        | "espiritual"
        | "agradecimento"
        | "outro"
      user_status: "visitante" | "frequentador" | "membro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: [
        "visualizar",
        "criar_editar",
        "aprovar_gerenciar",
        "acesso_completo",
      ],
      app_role: [
        "admin",
        "pastor",
        "lider",
        "secretario",
        "tesoureiro",
        "professor",
        "membro",
        "basico",
        "tecnico",
        "admin_igreja",
        "admin_filial",
        "super_admin",
      ],
      categoria_testemunho: [
        "espiritual",
        "casamento",
        "familia",
        "saude",
        "trabalho",
        "financeiro",
        "ministerial",
        "outro",
      ],
      evento_tipo: ["CULTO", "RELOGIO", "TAREFA", "EVENTO", "OUTRO"],
      gravidade_enum: ["BAIXA", "MEDIA", "ALTA", "CRITICA"],
      sentimento_tipo: [
        "feliz",
        "cuidadoso",
        "abencoado",
        "grato",
        "angustiado",
        "sozinho",
        "triste",
        "doente",
        "com_pouca_fe",
      ],
      status_atendimento_enum: [
        "PENDENTE",
        "TRIAGEM",
        "AGENDADO",
        "EM_ACOMPANHAMENTO",
        "CONCLUIDO",
      ],
      status_intercessor: ["ATIVO", "PAUSA", "FERIAS"],
      status_pedido: ["pendente", "em_oracao", "respondido", "arquivado"],
      status_sessao_chat: ["INICIADO", "EM_ANDAMENTO", "CONCLUIDO", "EXPIRADO"],
      status_testemunho: ["aberto", "publico", "arquivado"],
      tipo_comunicado: ["banner", "alerta"],
      tipo_pedido: [
        "saude",
        "familia",
        "financeiro",
        "trabalho",
        "espiritual",
        "agradecimento",
        "outro",
      ],
      user_status: ["visitante", "frequentador", "membro"],
    },
  },
} as const
