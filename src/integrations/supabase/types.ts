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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      antibiotics: {
        Row: {
          antibiotic_code: string
          created_at: string
          drug_class: string
          label_en: string
          label_fi: string
          reported_for: string
        }
        Insert: {
          antibiotic_code: string
          created_at?: string
          drug_class: string
          label_en: string
          label_fi: string
          reported_for: string
        }
        Update: {
          antibiotic_code?: string
          created_at?: string
          drug_class?: string
          label_en?: string
          label_fi?: string
          reported_for?: string
        }
        Relationships: []
      }
      cultures: {
        Row: {
          admission_date: string | null
          age_years: number | null
          created_at: string
          culture_id: string
          iso_week: number
          iso_year: number
          n_isolates: number
          patient_id: string
          result: string
          sample_date: string
          specimen_code: string
          ward_code: string
        }
        Insert: {
          admission_date?: string | null
          age_years?: number | null
          created_at?: string
          culture_id: string
          iso_week: number
          iso_year: number
          n_isolates: number
          patient_id: string
          result: string
          sample_date: string
          specimen_code: string
          ward_code: string
        }
        Update: {
          admission_date?: string | null
          age_years?: number | null
          created_at?: string
          culture_id?: string
          iso_week?: number
          iso_year?: number
          n_isolates?: number
          patient_id?: string
          result?: string
          sample_date?: string
          specimen_code?: string
          ward_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "cultures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cultures_specimen_code_fkey"
            columns: ["specimen_code"]
            isOneToOne: false
            referencedRelation: "specimen_types"
            referencedColumns: ["specimen_code"]
          },
          {
            foreignKeyName: "cultures_ward_code_fkey"
            columns: ["ward_code"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_code"]
          },
        ]
      }
      import_runs: {
        Row: {
          dataset: string
          errors: Json
          file_name: string
          finished_at: string | null
          id: string
          rows_duplicate: number
          rows_inserted: number
          rows_rejected: number
          rows_total: number
          started_at: string
          started_by: string
          status: string
        }
        Insert: {
          dataset: string
          errors?: Json
          file_name: string
          finished_at?: string | null
          id?: string
          rows_duplicate?: number
          rows_inserted?: number
          rows_rejected?: number
          rows_total?: number
          started_at?: string
          started_by: string
          status?: string
        }
        Update: {
          dataset?: string
          errors?: Json
          file_name?: string
          finished_at?: string | null
          id?: string
          rows_duplicate?: number
          rows_inserted?: number
          rows_rejected?: number
          rows_total?: number
          started_at?: string
          started_by?: string
          status?: string
        }
        Relationships: []
      }
      isolates: {
        Row: {
          cpe: boolean | null
          created_at: string
          culture_id: string
          esbl: boolean | null
          isolate_id: string
          isolate_no: number
          mrsa: boolean | null
          organism: string
          quantity: string | null
          vre: boolean | null
        }
        Insert: {
          cpe?: boolean | null
          created_at?: string
          culture_id: string
          esbl?: boolean | null
          isolate_id: string
          isolate_no: number
          mrsa?: boolean | null
          organism: string
          quantity?: string | null
          vre?: boolean | null
        }
        Update: {
          cpe?: boolean | null
          created_at?: string
          culture_id?: string
          esbl?: boolean | null
          isolate_id?: string
          isolate_no?: number
          mrsa?: boolean | null
          organism?: string
          quantity?: string | null
          vre?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "isolates_culture_id_fkey"
            columns: ["culture_id"]
            isOneToOne: false
            referencedRelation: "cultures"
            referencedColumns: ["culture_id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_year: number | null
          created_at: string
          home_area: string | null
          patient_id: string
          sex: string | null
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          home_area?: string | null
          patient_id: string
          sex?: string | null
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          home_area?: string | null
          patient_id?: string
          sex?: string | null
        }
        Relationships: []
      }
      specimen_types: {
        Row: {
          label_en: string
          label_fi: string
          specimen_code: string
        }
        Insert: {
          label_en: string
          label_fi: string
          specimen_code: string
        }
        Update: {
          label_en?: string
          label_fi?: string
          specimen_code?: string
        }
        Relationships: []
      }
      susceptibility_results: {
        Row: {
          antibiotic_code: string
          created_at: string
          guideline: string
          id: number
          isolate_id: string
          result: string
        }
        Insert: {
          antibiotic_code: string
          created_at?: string
          guideline: string
          id?: never
          isolate_id: string
          result: string
        }
        Update: {
          antibiotic_code?: string
          created_at?: string
          guideline?: string
          id?: never
          isolate_id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "susceptibility_results_antibiotic_code_fkey"
            columns: ["antibiotic_code"]
            isOneToOne: false
            referencedRelation: "antibiotics"
            referencedColumns: ["antibiotic_code"]
          },
          {
            foreignKeyName: "susceptibility_results_isolate_id_fkey"
            columns: ["isolate_id"]
            isOneToOne: false
            referencedRelation: "isolates"
            referencedColumns: ["isolate_id"]
          },
        ]
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
      wards: {
        Row: {
          created_at: string
          institution: string
          label_en: string
          label_fi: string
          ward_code: string
          ward_type: string
        }
        Insert: {
          created_at?: string
          institution: string
          label_en: string
          label_fi: string
          ward_code: string
          ward_type: string
        }
        Update: {
          created_at?: string
          institution?: string
          label_en?: string
          label_fi?: string
          ward_code?: string
          ward_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aei_organism_catalog: {
        Args: never
        Returns: {
          organism: string
        }[]
      }
      can_import: { Args: { _user_id: string }; Returns: boolean }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "importer" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "importer", "viewer"],
    },
  },
} as const
