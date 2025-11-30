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
      banners: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
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
          id?: string
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
          id?: string
          image_url?: string | null
          message?: string
          scheduled_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bases_ministeriais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          responsavel_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          responsavel_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          responsavel_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bases_ministeriais_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancoes_culto: {
        Row: {
          artista: string | null
          bpm: number | null
          cifra: string | null
          created_at: string
          culto_id: string
          duracao_minutos: number | null
          id: string
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
          culto_id: string
          duracao_minutos?: number | null
          id?: string
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
          culto_id?: string
          duracao_minutos?: number | null
          id?: string
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
            foreignKeyName: "cancoes_culto_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
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
            foreignKeyName: "cancoes_culto_solista_id_fkey"
            columns: ["solista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          secao_dre: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          secao_dre?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          secao_dre?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias_times: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean
          base_ministerial_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base_ministerial_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base_ministerial_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
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
        ]
      }
      configuracoes_igreja: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          nome_igreja: string
          subtitulo: string | null
          updated_at: string | null
          webhook_make_liturgia: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome_igreja?: string
          subtitulo?: string | null
          updated_at?: string | null
          webhook_make_liturgia?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome_igreja?: string
          subtitulo?: string | null
          updated_at?: string | null
          webhook_make_liturgia?: string | null
        }
        Relationships: []
      }
      contas: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta_numero: string | null
          created_at: string
          id: string
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
          conta_numero?: string | null
          created_at?: string
          id?: string
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
          conta_numero?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cultos: {
        Row: {
          created_at: string
          created_by: string | null
          data_culto: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          local: string | null
          observacoes: string | null
          pregador: string | null
          status: string
          tema: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_culto: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          local?: string | null
          observacoes?: string | null
          pregador?: string | null
          status?: string
          tema?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_culto?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          local?: string | null
          observacoes?: string | null
          pregador?: string | null
          status?: string
          tema?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
      escalas_culto: {
        Row: {
          confirmado: boolean
          created_at: string
          culto_id: string
          id: string
          observacoes: string | null
          pessoa_id: string
          posicao_id: string | null
          time_id: string
          updated_at: string
        }
        Insert: {
          confirmado?: boolean
          created_at?: string
          culto_id: string
          id?: string
          observacoes?: string | null
          pessoa_id: string
          posicao_id?: string | null
          time_id: string
          updated_at?: string
        }
        Update: {
          confirmado?: boolean
          created_at?: string
          culto_id?: string
          id?: string
          observacoes?: string | null
          pessoa_id?: string
          posicao_id?: string | null
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_culto_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_culto_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_culto_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicoes_time"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_culto_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times_culto"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          created_at: string
          familiar_id: string | null
          id: string
          nome_familiar: string | null
          pessoa_id: string
          tipo_parentesco: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          familiar_id?: string | null
          id?: string
          nome_familiar?: string | null
          pessoa_id: string
          tipo_parentesco: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          familiar_id?: string | null
          id?: string
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
            foreignKeyName: "familias_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
          id: string
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
          id?: string
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
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      funcoes_igreja: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      intercessores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string | null
          id: string
          max_pedidos: number | null
          nome: string
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          max_pedidos?: number | null
          nome: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          max_pedidos?: number | null
          nome?: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      itens_template_liturgia: {
        Row: {
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
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
          id?: string
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
          id?: string
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
            foreignKeyName: "itens_template_liturgia_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_liturgia"
            referencedColumns: ["id"]
          },
        ]
      }
      liturgia_culto: {
        Row: {
          created_at: string
          culto_id: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          midias_ids: string[] | null
          ordem: number
          responsavel_externo: string | null
          responsavel_id: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          culto_id: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          midias_ids?: string[] | null
          ordem: number
          responsavel_externo?: string | null
          responsavel_id?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          culto_id?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          midias_ids?: string[] | null
          ordem?: number
          responsavel_externo?: string | null
          responsavel_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liturgia_culto_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "cultos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liturgia_culto_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          funcao_id: string
          id: string
          membro_id: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          funcao_id: string
          id?: string
          membro_id: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          funcao_id?: string
          id?: string
          membro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membro_funcoes_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes_igreja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_funcoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_time: {
        Row: {
          ativo: boolean
          created_at: string
          data_entrada: string | null
          id: string
          pessoa_id: string
          posicao_id: string | null
          time_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          id?: string
          pessoa_id: string
          posicao_id?: string | null
          time_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_entrada?: string | null
          id?: string
          pessoa_id?: string
          posicao_id?: string | null
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_time_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            referencedRelation: "times_culto"
            referencedColumns: ["id"]
          },
        ]
      }
      midia_tags: {
        Row: {
          created_at: string | null
          id: string
          midia_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          midia_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          midia_id?: string
          tag_id?: string
        }
        Relationships: [
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
          culto_id: string | null
          descricao: string | null
          expires_at: string | null
          id: string
          ordem: number
          scheduled_at: string | null
          tipo: string
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          culto_id?: string | null
          descricao?: string | null
          expires_at?: string | null
          id?: string
          ordem?: number
          scheduled_at?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          culto_id?: string | null
          descricao?: string | null
          expires_at?: string | null
          id?: string
          ordem?: number
          scheduled_at?: string | null
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
            referencedRelation: "cultos"
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
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          related_user_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          related_user_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          related_user_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pedidos_oracao: {
        Row: {
          anonimo: boolean | null
          created_at: string | null
          data_alocacao: string | null
          data_criacao: string | null
          data_resposta: string | null
          email_solicitante: string | null
          id: string
          intercessor_id: string | null
          membro_id: string | null
          nome_solicitante: string | null
          observacoes_intercessor: string | null
          pedido: string
          pessoa_id: string | null
          status: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante: string | null
          tipo: Database["public"]["Enums"]["tipo_pedido"]
          updated_at: string | null
        }
        Insert: {
          anonimo?: boolean | null
          created_at?: string | null
          data_alocacao?: string | null
          data_criacao?: string | null
          data_resposta?: string | null
          email_solicitante?: string | null
          id?: string
          intercessor_id?: string | null
          membro_id?: string | null
          nome_solicitante?: string | null
          observacoes_intercessor?: string | null
          pedido: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante?: string | null
          tipo?: Database["public"]["Enums"]["tipo_pedido"]
          updated_at?: string | null
        }
        Update: {
          anonimo?: boolean | null
          created_at?: string | null
          data_alocacao?: string | null
          data_criacao?: string | null
          data_resposta?: string | null
          email_solicitante?: string | null
          id?: string
          intercessor_id?: string | null
          membro_id?: string | null
          nome_solicitante?: string | null
          observacoes_intercessor?: string | null
          pedido?: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          telefone_solicitante?: string | null
          tipo?: Database["public"]["Enums"]["tipo_pedido"]
          updated_at?: string | null
        }
        Relationships: [
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
        ]
      }
      posicoes_time: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          time_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          time_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          time_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posicoes_time_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times_culto"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aceitou_jesus: boolean | null
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
          e_lider: boolean | null
          e_pastor: boolean | null
          email: string | null
          endereco: string | null
          entrevistado_por: string | null
          entrou_por: string | null
          escolaridade: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nacionalidade: string | null
          naturalidade: string | null
          necessidades_especiais: string | null
          nome: string
          numero_visitas: number
          observacoes: string | null
          profissao: string | null
          recebeu_brinde: boolean | null
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
          e_lider?: boolean | null
          e_pastor?: boolean | null
          email?: string | null
          endereco?: string | null
          entrevistado_por?: string | null
          entrou_por?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          naturalidade?: string | null
          necessidades_especiais?: string | null
          nome: string
          numero_visitas?: number
          observacoes?: string | null
          profissao?: string | null
          recebeu_brinde?: boolean | null
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
          e_lider?: boolean | null
          e_pastor?: boolean | null
          email?: string | null
          endereco?: string | null
          entrevistado_por?: string | null
          entrou_por?: string | null
          escolaridade?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          naturalidade?: string | null
          necessidades_especiais?: string | null
          nome?: string
          numero_visitas?: number
          observacoes?: string | null
          profissao?: string | null
          recebeu_brinde?: boolean | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_igreja?: string | null
          telefone?: string | null
          tipo_sanguineo?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sentimentos_membros: {
        Row: {
          created_at: string
          data_registro: string
          id: string
          mensagem: string | null
          pessoa_id: string
          sentimento: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_registro?: string
          id?: string
          mensagem?: string | null
          pessoa_id: string
          sentimento: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_registro?: string
          id?: string
          mensagem?: string | null
          pessoa_id?: string
          sentimento?: Database["public"]["Enums"]["sentimento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentimentos_membros_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias_financeiras: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          id?: string
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
        ]
      }
      tags_midias: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      templates_liturgia: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      testemunhos: {
        Row: {
          anonimo: boolean | null
          autor_id: string | null
          categoria: Database["public"]["Enums"]["categoria_testemunho"]
          created_at: string
          data_publicacao: string | null
          email_externo: string | null
          id: string
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
          id?: string
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
          id?: string
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
            foreignKeyName: "testemunhos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      times_culto: {
        Row: {
          ativo: boolean
          categoria: string
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      transacoes_financeiras: {
        Row: {
          anexo_url: string | null
          base_ministerial_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          conta_id: string
          created_at: string
          data_competencia: string | null
          data_fim_recorrencia: string | null
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          descricao: string
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          juros: number | null
          lancado_por: string | null
          multas: number | null
          numero_parcela: number | null
          observacoes: string | null
          recorrencia: string | null
          status: string
          subcategoria_id: string | null
          taxas_administrativas: number | null
          tipo: string
          tipo_lancamento: string
          total_parcelas: number | null
          updated_at: string
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          anexo_url?: string | null
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id: string
          created_at?: string
          data_competencia?: string | null
          data_fim_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          descricao: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          juros?: number | null
          lancado_por?: string | null
          multas?: number | null
          numero_parcela?: number | null
          observacoes?: string | null
          recorrencia?: string | null
          status?: string
          subcategoria_id?: string | null
          taxas_administrativas?: number | null
          tipo: string
          tipo_lancamento: string
          total_parcelas?: number | null
          updated_at?: string
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          anexo_url?: string | null
          base_ministerial_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string
          created_at?: string
          data_competencia?: string | null
          data_fim_recorrencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          descricao?: string
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          juros?: number | null
          lancado_por?: string | null
          multas?: number | null
          numero_parcela?: number | null
          observacoes?: string | null
          recorrencia?: string | null
          status?: string
          subcategoria_id?: string | null
          taxas_administrativas?: number | null
          tipo?: string
          tipo_lancamento?: string
          total_parcelas?: number | null
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
            foreignKeyName: "transacoes_financeiras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
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
            foreignKeyName: "transacoes_financeiras_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitante_contatos: {
        Row: {
          created_at: string | null
          data_contato: string
          id: string
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
          id?: string
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
          id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alocar_pedido_balanceado: {
        Args: { p_pedido_id: string }
        Returns: string
      }
      buscar_pessoa_por_contato: {
        Args: { p_email?: string; p_nome?: string; p_telefone?: string }
        Returns: string
      }
      get_user_module_access: {
        Args: { _module_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["access_level"]
      }
      has_role: {
        Args: {
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
      is_member: { Args: { _user_id: string }; Returns: boolean }
      is_midia_active: {
        Args: { p_ativo: boolean; p_expires_at: string; p_scheduled_at: string }
        Returns: boolean
      }
      log_edge_function_execution: {
        Args: { p_details?: string; p_function_name: string; p_status: string }
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
      categoria_testemunho:
        | "espiritual"
        | "casamento"
        | "familia"
        | "saude"
        | "trabalho"
        | "financeiro"
        | "ministerial"
        | "outro"
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
      status_pedido: "pendente" | "em_oracao" | "respondido" | "arquivado"
      status_testemunho: "aberto" | "publico" | "arquivado"
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
      status_pedido: ["pendente", "em_oracao", "respondido", "arquivado"],
      status_testemunho: ["aberto", "publico", "arquivado"],
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
