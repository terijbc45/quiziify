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
      cdc_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cdc_chapters: {
        Row: {
          chapter_number: number
          chapter_title: string
          created_at: string
          id: string
          order_index: number
          subject_id: string
        }
        Insert: {
          chapter_number: number
          chapter_title: string
          created_at?: string
          id?: string
          order_index: number
          subject_id: string
        }
        Update: {
          chapter_number?: number
          chapter_title?: string
          created_at?: string
          id?: string
          order_index?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cdc_chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "cdc_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      cdc_classes: {
        Row: {
          created_at: string
          grade: number
          id: string
          stream: Database["public"]["Enums"]["cdc_stream"] | null
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          stream?: Database["public"]["Enums"]["cdc_stream"] | null
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          stream?: Database["public"]["Enums"]["cdc_stream"] | null
        }
        Relationships: []
      }
      cdc_content_chunks: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string
          page_reference: string | null
          raw_text: string
          source_document_name: string | null
          source_url: string | null
          topic_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string
          page_reference?: string | null
          raw_text: string
          source_document_name?: string | null
          source_url?: string | null
          topic_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string
          page_reference?: string | null
          raw_text?: string
          source_document_name?: string | null
          source_url?: string | null
          topic_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cdc_content_chunks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "cdc_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      cdc_questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: Database["public"]["Enums"]["cdc_difficulty"]
          id: string
          options: Json | null
          question_text: string
          question_type: Database["public"]["Enums"]["cdc_question_type"]
          source_chunk_id: string | null
          topic_id: string
          verified: boolean
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["cdc_difficulty"]
          id?: string
          options?: Json | null
          question_text: string
          question_type?: Database["public"]["Enums"]["cdc_question_type"]
          source_chunk_id?: string | null
          topic_id: string
          verified?: boolean
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["cdc_difficulty"]
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: Database["public"]["Enums"]["cdc_question_type"]
          source_chunk_id?: string | null
          topic_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cdc_questions_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "cdc_content_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdc_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "cdc_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      cdc_student_progress: {
        Row: {
          accuracy_percent: number
          chapter_id: string | null
          created_at: string
          id: string
          last_attempted_at: string | null
          status: Database["public"]["Enums"]["cdc_progress_status"]
          student_id: string
          subject_id: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy_percent?: number
          chapter_id?: string | null
          created_at?: string
          id?: string
          last_attempted_at?: string | null
          status?: Database["public"]["Enums"]["cdc_progress_status"]
          student_id: string
          subject_id: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy_percent?: number
          chapter_id?: string | null
          created_at?: string
          id?: string
          last_attempted_at?: string | null
          status?: Database["public"]["Enums"]["cdc_progress_status"]
          student_id?: string
          subject_id?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cdc_student_progress_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "cdc_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdc_student_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "cdc_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cdc_student_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "cdc_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      cdc_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_compulsory: boolean
          is_optional: boolean
          order_index: number
          subject_code: string | null
          subject_name: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_compulsory?: boolean
          is_optional?: boolean
          order_index?: number
          subject_code?: string | null
          subject_name: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_compulsory?: boolean
          is_optional?: boolean
          order_index?: number
          subject_code?: string | null
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cdc_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "cdc_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      cdc_topics: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          learning_objectives: string[]
          order_index: number
          topic_title: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          learning_objectives?: string[]
          order_index: number
          topic_title: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          learning_objectives?: string[]
          order_index?: number
          topic_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cdc_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "cdc_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_progress: {
        Row: {
          best_score: number
          chapter: string
          completed_at: string
          country: string
          grade: string
          id: string
          subject: string
          user_id: string
        }
        Insert: {
          best_score?: number
          chapter: string
          completed_at?: string
          country: string
          grade: string
          id?: string
          subject: string
          user_id: string
        }
        Update: {
          best_score?: number
          chapter?: string
          completed_at?: string
          country?: string
          grade?: string
          id?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      curriculum_cache: {
        Row: {
          fetched_at: string
          key: string
          payload: Json
        }
        Insert: {
          fetched_at?: string
          key: string
          payload: Json
        }
        Update: {
          fetched_at?: string
          key?: string
          payload?: Json
        }
        Relationships: []
      }
      date_captions: {
        Row: {
          caption: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_streaks: {
        Row: {
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      level_progress: {
        Row: {
          current_level: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_cache: {
        Row: {
          fetched_at: string
          key: string
          url: string
        }
        Insert: {
          fetched_at?: string
          key: string
          url: string
        }
        Update: {
          fetched_at?: string
          key?: string
          url?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "user_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          cover_photo_url: string | null
          created_at: string
          display_name: string
          grade: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_photo_url?: string | null
          created_at?: string
          display_name?: string
          grade?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          cover_photo_url?: string | null
          created_at?: string
          display_name?: string
          grade?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          level: number | null
          mode: string
          score: number
          topic: string | null
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id?: string
          level?: number | null
          mode: string
          score: number
          topic?: string | null
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          level?: number | null
          mode?: string
          score?: number
          topic?: string | null
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          body: string | null
          created_at: string
          fire_at: string
          fired: boolean
          id: string
          thumbnail_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          fire_at: string
          fired?: boolean
          id?: string
          thumbnail_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          fire_at?: string
          fired?: boolean
          id?: string
          thumbnail_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      seen_questions: {
        Row: {
          created_at: string
          id: string
          level: number | null
          mode: string
          question_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number | null
          mode: string
          question_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number | null
          mode?: string
          question_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quizzes: {
        Row: {
          author_id: string
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          image_url: string | null
          options: Json
          question: string
          reposted_from_post: string | null
          reposted_from_user: string | null
          topic: string
        }
        Insert: {
          author_id: string
          correct_index: number
          created_at?: string
          difficulty: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          options: Json
          question: string
          reposted_from_post?: string | null
          reposted_from_user?: string | null
          topic: string
        }
        Update: {
          author_id?: string
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          options?: Json
          question?: string
          reposted_from_post?: string | null
          reposted_from_user?: string | null
          topic?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_cdc_admin: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      cdc_difficulty: "easy" | "medium" | "hard"
      cdc_progress_status: "not_started" | "in_progress" | "mastered"
      cdc_question_type: "MCQ" | "short" | "long" | "numerical"
      cdc_stream: "Science" | "Management" | "Humanities" | "Education" | "Law"
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
      cdc_difficulty: ["easy", "medium", "hard"],
      cdc_progress_status: ["not_started", "in_progress", "mastered"],
      cdc_question_type: ["MCQ", "short", "long", "numerical"],
      cdc_stream: ["Science", "Management", "Humanities", "Education", "Law"],
    },
  },
} as const
