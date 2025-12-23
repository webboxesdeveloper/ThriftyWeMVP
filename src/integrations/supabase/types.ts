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
      ad_regions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          region_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          region_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          region_id?: string
        }
        Relationships: []
      }
      analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      chains: {
        Row: {
          chain_id: string
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          chain_id: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          chain_id?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      dish_ingredients: {
        Row: {
          created_at: string | null
          dish_id: string
          id: string
          ingredient_id: string
          optional: boolean | null
          quantity: number
          role: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          dish_id: string
          id?: string
          ingredient_id: string
          optional?: boolean | null
          quantity: number
          role?: string | null
          unit: string
        }
        Update: {
          created_at?: string | null
          dish_id?: string
          id?: string
          ingredient_id?: string
          optional?: boolean | null
          quantity?: number
          role?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          category_id: string | null
          cook_time: number | null
          created_at: string | null
          description: string | null
          dish_id: string
          id: string
          image_url: string | null
          name: string
          prep_time: number | null
          servings: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          cook_time?: number | null
          created_at?: string | null
          description?: string | null
          dish_id: string
          id?: string
          image_url?: string | null
          name: string
          prep_time?: number | null
          servings?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          cook_time?: number | null
          created_at?: string | null
          description?: string | null
          dish_id?: string
          id?: string
          image_url?: string | null
          name?: string
          prep_time?: number | null
          servings?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          dish_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dish_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dish_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          base_price: number | null
          created_at: string | null
          id: string
          ingredient_id: string
          name_canonical: string
          unit_default: string | null
          updated_at: string | null
        }
        Insert: {
          base_price?: number | null
          created_at?: string | null
          id?: string
          ingredient_id: string
          name_canonical: string
          unit_default?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number | null
          created_at?: string | null
          id?: string
          ingredient_id?: string
          name_canonical?: string
          unit_default?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          brand: string | null
          chain_id: string
          created_at: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          import_hash: string | null
          offer_id: string
          price: number
          product_name: string
          quantity: number | null
          region_id: string
          unit: string | null
          updated_at: string | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          brand?: string | null
          chain_id: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          import_hash?: string | null
          offer_id: string
          price: number
          product_name: string
          quantity?: number | null
          region_id: string
          unit?: string | null
          updated_at?: string | null
          valid_from: string
          valid_until: string
        }
        Update: {
          brand?: string | null
          chain_id?: string
          created_at?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          import_hash?: string | null
          offer_id?: string
          price?: number
          product_name?: string
          quantity?: number | null
          region_id?: string
          unit?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "ad_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      postal_codes: {
        Row: {
          city: string
          created_at: string | null
          id: string
          plz: string
          region_id: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          plz: string
          region_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          plz?: string
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postal_codes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "ad_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_map: {
        Row: {
          created_at: string | null
          id: string
          ingredient_id: string
          match_score: number | null
          offer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ingredient_id: string
          match_score?: number | null
          offer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ingredient_id?: string
          match_score?: number | null
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_map_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_map_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_region_map: {
        Row: {
          created_at: string | null
          id: string
          region_id: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          region_id: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          region_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_region_map_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "ad_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_region_map_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          chain_id: string
          city: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          plz: string | null
          store_id: string
        }
        Insert: {
          address?: string | null
          chain_id: string
          city?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          plz?: string | null
          store_id: string
        }
        Update: {
          address?: string | null
          chain_id?: string
          city?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          plz?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          abbreviation: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          last_seen: string | null
          plz: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          last_seen?: string | null
          plz?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          last_seen?: string | null
          plz?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_dish_price: {
        Args: { _dish_id: string; _user_plz?: string }
        Returns: {
          available_offers: Json
          base_price: number
          offer_price: number
          savings: number
          savings_percent: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
