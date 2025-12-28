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
      car_listings: {
        Row: {
          brand: string
          country: string
          created_at: string
          external_id: string
          fuel: string | null
          id: string
          image: string | null
          listing_url: string | null
          location: string | null
          mileage: number | null
          model: string
          price: number
          scraped_at: string
          source: string
          source_url: string
          title: string
          transmission: string | null
          year: number
        }
        Insert: {
          brand: string
          country: string
          created_at?: string
          external_id: string
          fuel?: string | null
          id?: string
          image?: string | null
          listing_url?: string | null
          location?: string | null
          mileage?: number | null
          model: string
          price: number
          scraped_at?: string
          source: string
          source_url: string
          title: string
          transmission?: string | null
          year: number
        }
        Update: {
          brand?: string
          country?: string
          created_at?: string
          external_id?: string
          fuel?: string | null
          id?: string
          image?: string | null
          listing_url?: string | null
          location?: string | null
          mileage?: number | null
          model?: string
          price?: number
          scraped_at?: string
          source?: string
          source_url?: string
          title?: string
          transmission?: string | null
          year?: number
        }
        Relationships: []
      }
      found_listings: {
        Row: {
          brand: string
          country: string
          created_at: string
          expires_at: string
          external_id: string
          found_at: string
          fuel: string | null
          id: string
          image: string | null
          listing_id: string
          listing_url: string | null
          location: string | null
          mileage: number | null
          model: string
          price: number
          source: string
          source_url: string
          title: string
          transmission: string | null
          user_id: string
          year: number
        }
        Insert: {
          brand: string
          country: string
          created_at?: string
          expires_at?: string
          external_id: string
          found_at?: string
          fuel?: string | null
          id?: string
          image?: string | null
          listing_id: string
          listing_url?: string | null
          location?: string | null
          mileage?: number | null
          model: string
          price: number
          source: string
          source_url: string
          title: string
          transmission?: string | null
          user_id: string
          year: number
        }
        Update: {
          brand?: string
          country?: string
          created_at?: string
          expires_at?: string
          external_id?: string
          found_at?: string
          fuel?: string | null
          id?: string
          image?: string | null
          listing_id?: string
          listing_url?: string | null
          location?: string | null
          mileage?: number | null
          model?: string
          price?: number
          source?: string
          source_url?: string
          title?: string
          transmission?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_cars: {
        Row: {
          brand: string
          created_at: string
          external_id: string
          id: string
          max_price: number | null
          max_year: number | null
          min_price: number | null
          min_year: number | null
          model: string
          title: string
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          external_id: string
          id?: string
          max_price?: number | null
          max_year?: number | null
          min_price?: number | null
          min_year?: number | null
          model: string
          title: string
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          external_id?: string
          id?: string
          max_price?: number | null
          max_year?: number | null
          min_price?: number | null
          min_year?: number | null
          model?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_status: {
        Row: {
          error_message: string | null
          id: string
          last_scraped_at: string | null
          listings_count: number | null
          source: string
          status: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          listings_count?: number | null
          source: string
          status?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          last_scraped_at?: string | null
          listings_count?: number | null
          source?: string
          status?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: never; Returns: boolean }
      is_user_approved: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
