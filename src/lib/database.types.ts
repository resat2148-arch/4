export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          created_at: string;
          id: string;
          invite_code: string | null;
          status: Database['public']['Enums']['friendship_status'];
          user_a: string;
          user_b: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invite_code?: string | null;
          status?: Database['public']['Enums']['friendship_status'];
          user_a: string;
          user_b?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          invite_code?: string | null;
          status?: Database['public']['Enums']['friendship_status'];
          user_a?: string;
          user_b?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_a_fkey';
            columns: ['user_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_b_fkey';
            columns: ['user_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      letters: {
        Row: {
          approved_at: string | null;
          audio_path: string;
          created_at: string;
          deliver_after: string;
          delivered_at: string | null;
          duration_sec: number;
          id: string;
          question_id: string;
          recipient_id: string | null;
          recipient_type: Database['public']['Enums']['recipient_type'];
          reject_reason: string | null;
          reply_to_letter_id: string | null;
          sender_id: string;
          status: Database['public']['Enums']['letter_status'];
        };
        Insert: {
          approved_at?: string | null;
          audio_path: string;
          created_at?: string;
          deliver_after: string;
          delivered_at?: string | null;
          duration_sec: number;
          id?: string;
          question_id: string;
          recipient_id?: string | null;
          recipient_type: Database['public']['Enums']['recipient_type'];
          reject_reason?: string | null;
          reply_to_letter_id?: string | null;
          sender_id: string;
          status?: Database['public']['Enums']['letter_status'];
        };
        Update: {
          approved_at?: string | null;
          audio_path?: string;
          created_at?: string;
          deliver_after?: string;
          delivered_at?: string | null;
          duration_sec?: number;
          id?: string;
          question_id?: string;
          recipient_id?: string | null;
          recipient_type?: Database['public']['Enums']['recipient_type'];
          reject_reason?: string | null;
          reply_to_letter_id?: string | null;
          sender_id?: string;
          status?: Database['public']['Enums']['letter_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'letters_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'letters_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'letters_reply_to_letter_id_fkey';
            columns: ['reply_to_letter_id'];
            isOneToOne: false;
            referencedRelation: 'letters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'letters_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      listens: {
        Row: {
          completed_at: string | null;
          letter_id: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          letter_id: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          letter_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listens_letter_id_fkey';
            columns: ['letter_id'];
            isOneToOne: false;
            referencedRelation: 'letters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_decisions: {
        Row: {
          decided_at: string;
          decided_by: string;
          decision: Database['public']['Enums']['moderation_decision'];
          id: string;
          letter_id: string | null;
          note: string | null;
          reason: string | null;
        };
        Insert: {
          decided_at?: string;
          decided_by: string;
          decision: Database['public']['Enums']['moderation_decision'];
          id?: string;
          letter_id?: string | null;
          note?: string | null;
          reason?: string | null;
        };
        Update: {
          decided_at?: string;
          decided_by?: string;
          decision?: Database['public']['Enums']['moderation_decision'];
          id?: string;
          letter_id?: string | null;
          note?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_decisions_letter_id_fkey';
            columns: ['letter_id'];
            isOneToOne: false;
            referencedRelation: 'letters';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          age_confirmed_at: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_banned: boolean;
          push_token: string | null;
        };
        Insert: {
          age_confirmed_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_banned?: boolean;
          push_token?: string | null;
        };
        Update: {
          age_confirmed_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_banned?: boolean;
          push_token?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          intensity: Database['public']['Enums']['question_intensity'];
          publish_date: string;
          text: string;
        };
        Insert: {
          id?: string;
          intensity?: Database['public']['Enums']['question_intensity'];
          publish_date: string;
          text: string;
        };
        Update: {
          id?: string;
          intensity?: Database['public']['Enums']['question_intensity'];
          publish_date?: string;
          text?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          handled_at: string | null;
          id: string;
          letter_id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
        };
        Insert: {
          created_at?: string;
          handled_at?: string | null;
          id?: string;
          letter_id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
        };
        Update: {
          created_at?: string;
          handled_at?: string | null;
          id?: string;
          letter_id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_letter_id_fkey';
            columns: ['letter_id'];
            isOneToOne: false;
            referencedRelation: 'letters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_age: { Args: Record<PropertyKey, never>; Returns: string };
      get_my_outgoing_letters: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          deliver_after: string;
          duration_sec: number;
          id: string;
          recipient_type: Database['public']['Enums']['recipient_type'];
          state: string;
        }[];
      };
      get_today_question: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          intensity: Database['public']['Enums']['question_intensity'];
          publish_date: string;
          text: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'questions';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      send_letter: {
        Args: {
          p_audio_path: string;
          p_duration_sec: number;
          p_question_id?: string;
          p_recipient_id?: string;
          p_recipient_type?: Database['public']['Enums']['recipient_type'];
          p_reply_to_letter_id?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      friendship_status: 'pending' | 'accepted';
      letter_status: 'in_review' | 'approved' | 'rejected' | 'delivered';
      moderation_decision: 'approved' | 'rejected';
      question_intensity: 'light' | 'deep';
      recipient_type: 'stranger' | 'friend';
      report_reason: 'harassment' | 'inappropriate' | 'personal_info' | 'at_risk';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      friendship_status: ['pending', 'accepted'],
      letter_status: ['in_review', 'approved', 'rejected', 'delivered'],
      moderation_decision: ['approved', 'rejected'],
      question_intensity: ['light', 'deep'],
      recipient_type: ['stranger', 'friend'],
      report_reason: ['harassment', 'inappropriate', 'personal_info', 'at_risk'],
    },
  },
} as const;
