export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      answers: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          end_seconds: number | null;
          error_message: string | null;
          id: string;
          interview_id: string;
          is_followup: boolean;
          parent_answer_id: string | null;
          quality_reasoning: string | null;
          quality_score: number | null;
          question_id: string | null;
          question_text: string;
          start_seconds: number | null;
          status: Database["public"]["Enums"]["answer_status"];
          transcript: string | null;
          updated_at: string;
          video_path: string | null;
          words_json: Json | null;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          end_seconds?: number | null;
          error_message?: string | null;
          id?: string;
          interview_id: string;
          is_followup?: boolean;
          parent_answer_id?: string | null;
          quality_reasoning?: string | null;
          quality_score?: number | null;
          question_id?: string | null;
          question_text: string;
          start_seconds?: number | null;
          status?: Database["public"]["Enums"]["answer_status"];
          transcript?: string | null;
          updated_at?: string;
          video_path?: string | null;
          words_json?: Json | null;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          end_seconds?: number | null;
          error_message?: string | null;
          id?: string;
          interview_id?: string;
          is_followup?: boolean;
          parent_answer_id?: string | null;
          quality_reasoning?: string | null;
          quality_score?: number | null;
          question_id?: string | null;
          question_text?: string;
          start_seconds?: number | null;
          status?: Database["public"]["Enums"]["answer_status"];
          transcript?: string | null;
          updated_at?: string;
          video_path?: string | null;
          words_json?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "answers_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_parent_answer_id_fkey";
            columns: ["parent_answer_id"];
            isOneToOne: false;
            referencedRelation: "answers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          id: boolean;
          stt_provider: string;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          stt_provider?: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          stt_provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      compensation_log: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string;
          currency: string;
          id: string;
          interview_id: string | null;
          method: string;
          notes: string | null;
          paid_at: string | null;
          receipt_url: string | null;
          reference: string | null;
          respondent_id: string;
          status: string;
          study_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by: string;
          currency?: string;
          id?: string;
          interview_id?: string | null;
          method?: string;
          notes?: string | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          respondent_id: string;
          status?: string;
          study_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          interview_id?: string | null;
          method?: string;
          notes?: string | null;
          paid_at?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          respondent_id?: string;
          status?: string;
          study_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          accepted_at: string;
          consent_version: string;
          created_at: string;
          id: string;
          interview_id: string;
          ip_address: string | null;
          study_id: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          consent_version: string;
          created_at?: string;
          id?: string;
          interview_id: string;
          ip_address?: string | null;
          study_id: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          consent_version?: string;
          created_at?: string;
          id?: string;
          interview_id?: string;
          ip_address?: string | null;
          study_id?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      cta_click_events: {
        Row: {
          created_at: string;
          cta_id: string;
          href: string;
          id: string;
          referrer: string | null;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          cta_id: string;
          href: string;
          id?: string;
          referrer?: string | null;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          cta_id?: string;
          href?: string;
          id?: string;
          referrer?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      insights: {
        Row: {
          created_at: string;
          evidence: Json;
          id: string;
          study_id: string;
          summary: string;
          theme: string;
        };
        Insert: {
          created_at?: string;
          evidence?: Json;
          id?: string;
          study_id: string;
          summary: string;
          theme: string;
        };
        Update: {
          created_at?: string;
          evidence?: Json;
          id?: string;
          study_id?: string;
          summary?: string;
          theme?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_insights: {
        Row: {
          answer_summaries: Json;
          bullet_summary: string[];
          created_at: string;
          interview_id: string;
          model: string | null;
          quality: string | null;
          segments: string[];
          tagline: string | null;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          answer_summaries?: Json;
          bullet_summary?: string[];
          created_at?: string;
          interview_id: string;
          model?: string | null;
          quality?: string | null;
          segments?: string[];
          tagline?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          answer_summaries?: Json;
          bullet_summary?: string[];
          created_at?: string;
          interview_id?: string;
          model?: string | null;
          quality?: string | null;
          segments?: string[];
          tagline?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_insights_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: true;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      interviews: {
        Row: {
          created_at: string;
          external_respondent: Json | null;
          finished_at: string | null;
          id: string;
          respondent_id: string | null;
          source: string;
          started_at: string;
          status: Database["public"]["Enums"]["interview_status"];
          study_id: string;
        };
        Insert: {
          created_at?: string;
          external_respondent?: Json | null;
          finished_at?: string | null;
          id?: string;
          respondent_id?: string | null;
          source?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["interview_status"];
          study_id: string;
        };
        Update: {
          created_at?: string;
          external_respondent?: Json | null;
          finished_at?: string | null;
          id?: string;
          respondent_id?: string | null;
          source?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["interview_status"];
          study_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          age_range: string | null;
          can_publish: boolean;
          city: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          industry: string | null;
          occupation: string | null;
          research_interests: string[] | null;
          state: string | null;
          updated_at: string;
        };
        Insert: {
          age_range?: string | null;
          can_publish?: boolean;
          city?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          industry?: string | null;
          occupation?: string | null;
          research_interests?: string[] | null;
          state?: string | null;
          updated_at?: string;
        };
        Update: {
          age_range?: string | null;
          can_publish?: boolean;
          city?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          industry?: string | null;
          occupation?: string | null;
          research_interests?: string[] | null;
          state?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          created_at: string;
          id: string;
          intent: string | null;
          position: number;
          study_id: string;
          text: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          intent?: string | null;
          position: number;
          study_id: string;
          text: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          intent?: string | null;
          position?: number;
          study_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendations: {
        Row: {
          created_at: string;
          id: string;
          priority: number | null;
          rationale: string;
          study_id: string;
          supporting_insight_ids: string[];
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          priority?: number | null;
          rationale: string;
          study_id: string;
          supporting_insight_ids?: string[];
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          priority?: number | null;
          rationale?: string;
          study_id?: string;
          supporting_insight_ids?: string[];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_study_id_fkey";
            columns: ["study_id"];
            isOneToOne: false;
            referencedRelation: "studies";
            referencedColumns: ["id"];
          },
        ];
      };
      respondent_profile: {
        Row: {
          active: boolean;
          age_range: string | null;
          city: string | null;
          company: string | null;
          company_size: string | null;
          consent_marketing: boolean;
          consent_research: boolean;
          country: string;
          created_at: string;
          education: string | null;
          email: string | null;
          full_name: string | null;
          gender: string | null;
          id: string;
          income_range: string | null;
          linkedin_url: string | null;
          notes: string | null;
          occupation: string | null;
          phone: string | null;
          source: string | null;
          state: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          age_range?: string | null;
          city?: string | null;
          company?: string | null;
          company_size?: string | null;
          consent_marketing?: boolean;
          consent_research?: boolean;
          country?: string;
          created_at?: string;
          education?: string | null;
          email?: string | null;
          full_name?: string | null;
          gender?: string | null;
          id?: string;
          income_range?: string | null;
          linkedin_url?: string | null;
          notes?: string | null;
          occupation?: string | null;
          phone?: string | null;
          source?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          age_range?: string | null;
          city?: string | null;
          company?: string | null;
          company_size?: string | null;
          consent_marketing?: boolean;
          consent_research?: boolean;
          country?: string;
          created_at?: string;
          education?: string | null;
          email?: string | null;
          full_name?: string | null;
          gender?: string | null;
          id?: string;
          income_range?: string | null;
          linkedin_url?: string | null;
          notes?: string | null;
          occupation?: string | null;
          phone?: string | null;
          source?: string | null;
          state?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      respondent_tags: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          respondent_id: string;
          tag_value_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          respondent_id: string;
          tag_value_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          respondent_id?: string;
          tag_value_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "respondent_tags_respondent_id_fkey";
            columns: ["respondent_id"];
            isOneToOne: false;
            referencedRelation: "respondent_profile";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "respondent_tags_respondent_id_fkey";
            columns: ["respondent_id"];
            isOneToOne: false;
            referencedRelation: "respondent_stats";
            referencedColumns: ["respondent_id"];
          },
          {
            foreignKeyName: "respondent_tags_tag_value_id_fkey";
            columns: ["tag_value_id"];
            isOneToOne: false;
            referencedRelation: "tag_values";
            referencedColumns: ["id"];
          },
        ];
      };
      screener_questions: {
        Row: {
          created_at: string;
          id: string;
          options: Json;
          position: number;
          qualifies: boolean;
          qualifying_options: Json;
          study_id: string;
          text: string;
          type: Database["public"]["Enums"]["screener_question_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          options?: Json;
          position: number;
          qualifies?: boolean;
          qualifying_options?: Json;
          study_id: string;
          text: string;
          type?: Database["public"]["Enums"]["screener_question_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          options?: Json;
          position?: number;
          qualifies?: boolean;
          qualifying_options?: Json;
          study_id?: string;
          text?: string;
          type?: Database["public"]["Enums"]["screener_question_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      screener_submissions: {
        Row: {
          created_at: string;
          id: string;
          qualified: boolean;
          responses: Json;
          study_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          qualified: boolean;
          responses?: Json;
          study_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          qualified?: boolean;
          responses?: Json;
          study_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      studies: {
        Row: {
          business_goal: string | null;
          context: string | null;
          created_at: string;
          id: string;
          max_followups: number;
          owner_id: string;
          public_slug: string;
          status: Database["public"]["Enums"]["study_status"];
          target_audience: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          business_goal?: string | null;
          context?: string | null;
          created_at?: string;
          id?: string;
          max_followups?: number;
          owner_id: string;
          public_slug?: string;
          status?: Database["public"]["Enums"]["study_status"];
          target_audience?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          business_goal?: string | null;
          context?: string | null;
          created_at?: string;
          id?: string;
          max_followups?: number;
          owner_id?: string;
          public_slug?: string;
          status?: Database["public"]["Enums"]["study_status"];
          target_audience?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_invitations: {
        Row: {
          channel: string;
          created_at: string;
          id: string;
          invited_by: string;
          message: string | null;
          respondent_id: string;
          sent_at: string | null;
          status: string;
          study_id: string;
          updated_at: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          id?: string;
          invited_by: string;
          message?: string | null;
          respondent_id: string;
          sent_at?: string | null;
          status?: string;
          study_id: string;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          id?: string;
          invited_by?: string;
          message?: string | null;
          respondent_id?: string;
          sent_at?: string | null;
          status?: string;
          study_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tag_dimensions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          label: string;
          position: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          label: string;
          position?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          label?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tag_values: {
        Row: {
          created_at: string;
          dimension_id: string;
          id: string;
          label: string;
          position: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          dimension_id: string;
          id?: string;
          label: string;
          position?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          dimension_id?: string;
          id?: string;
          label?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tag_values_dimension_id_fkey";
            columns: ["dimension_id"];
            isOneToOne: false;
            referencedRelation: "tag_dimensions";
            referencedColumns: ["id"];
          },
        ];
      };
      telegram_sessions: {
        Row: {
          awaiting_consent: boolean;
          chat_id: number;
          created_at: string;
          interview_id: string | null;
          last_update_id: number | null;
          pending_is_followup: boolean;
          pending_parent_answer_id: string | null;
          pending_question_id: string | null;
          pending_question_text: string | null;
          state: string;
          study_id: string | null;
          telegram_first_name: string | null;
          telegram_username: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          awaiting_consent?: boolean;
          chat_id: number;
          created_at?: string;
          interview_id?: string | null;
          last_update_id?: number | null;
          pending_is_followup?: boolean;
          pending_parent_answer_id?: string | null;
          pending_question_id?: string | null;
          pending_question_text?: string | null;
          state?: string;
          study_id?: string | null;
          telegram_first_name?: string | null;
          telegram_username?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          awaiting_consent?: boolean;
          chat_id?: number;
          created_at?: string;
          interview_id?: string | null;
          last_update_id?: number | null;
          pending_is_followup?: boolean;
          pending_parent_answer_id?: string | null;
          pending_question_id?: string | null;
          pending_question_text?: string | null;
          state?: string;
          study_id?: string | null;
          telegram_first_name?: string | null;
          telegram_username?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      respondent_stats: {
        Row: {
          avg_quality_score: number | null;
          completed_count: number | null;
          interviews_count: number | null;
          last_participation_at: string | null;
          respondent_id: string | null;
          studies_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_respondent_data: {
        Args: { p_interview_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      answer_status: "uploading" | "transcribing" | "ready" | "failed";
      app_role: "researcher" | "respondent";
      interview_status: "in_progress" | "completed" | "abandoned";
      screener_question_type: "single_choice" | "multi_choice" | "short_text";
      study_status: "draft" | "published" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      answer_status: ["uploading", "transcribing", "ready", "failed"],
      app_role: ["researcher", "respondent"],
      interview_status: ["in_progress", "completed", "abandoned"],
      screener_question_type: ["single_choice", "multi_choice", "short_text"],
      study_status: ["draft", "published", "closed"],
    },
  },
} as const;
