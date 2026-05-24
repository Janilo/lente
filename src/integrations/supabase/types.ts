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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          interview_id: string
          is_followup: boolean
          parent_answer_id: string | null
          question_id: string | null
          question_text: string
          status: Database["public"]["Enums"]["answer_status"]
          transcript: string | null
          updated_at: string
          video_path: string | null
          words_json: Json | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          interview_id: string
          is_followup?: boolean
          parent_answer_id?: string | null
          question_id?: string | null
          question_text: string
          status?: Database["public"]["Enums"]["answer_status"]
          transcript?: string | null
          updated_at?: string
          video_path?: string | null
          words_json?: Json | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          interview_id?: string
          is_followup?: boolean
          parent_answer_id?: string | null
          question_id?: string | null
          question_text?: string
          status?: Database["public"]["Enums"]["answer_status"]
          transcript?: string | null
          updated_at?: string
          video_path?: string | null
          words_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_parent_answer_id_fkey"
            columns: ["parent_answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          study_id: string
          summary: string
          theme: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          study_id: string
          summary: string
          theme: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          study_id?: string
          summary?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          respondent_id: string
          started_at: string
          status: Database["public"]["Enums"]["interview_status"]
          study_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          respondent_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          study_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          respondent_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          id: string
          intent: string | null
          position: number
          study_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent?: string | null
          position: number
          study_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          intent?: string | null
          position?: number
          study_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          priority: number | null
          rationale: string
          study_id: string
          supporting_insight_ids: string[]
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: number | null
          rationale: string
          study_id: string
          supporting_insight_ids?: string[]
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: number | null
          rationale?: string
          study_id?: string
          supporting_insight_ids?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          business_goal: string | null
          context: string | null
          created_at: string
          id: string
          max_followups: number
          owner_id: string
          public_slug: string
          status: Database["public"]["Enums"]["study_status"]
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          business_goal?: string | null
          context?: string | null
          created_at?: string
          id?: string
          max_followups?: number
          owner_id: string
          public_slug?: string
          status?: Database["public"]["Enums"]["study_status"]
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          business_goal?: string | null
          context?: string | null
          created_at?: string
          id?: string
          max_followups?: number
          owner_id?: string
          public_slug?: string
          status?: Database["public"]["Enums"]["study_status"]
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      answer_status: "uploading" | "transcribing" | "ready" | "failed"
      app_role: "researcher" | "respondent"
      interview_status: "in_progress" | "completed" | "abandoned"
      study_status: "draft" | "published" | "closed"
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
      answer_status: ["uploading", "transcribing", "ready", "failed"],
      app_role: ["researcher", "respondent"],
      interview_status: ["in_progress", "completed", "abandoned"],
      study_status: ["draft", "published", "closed"],
    },
  },
} as const
