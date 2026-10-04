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
      customer_memberships: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          joined_at: string
          last_visit_at: string | null
          program_id: string
          stamp_balance: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          joined_at?: string
          last_visit_at?: string | null
          program_id: string
          stamp_balance?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          joined_at?: string
          last_visit_at?: string | null
          program_id?: string
          stamp_balance?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_memberships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          referrals_enabled: boolean
          referrer_bonus_stamps: number
          stamp_icon: string
          stamps_required: number
          store_id: string
          updated_at: string
          welcome_bonus_stamps: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          referrals_enabled?: boolean
          referrer_bonus_stamps?: number
          stamp_icon?: string
          stamps_required?: number
          store_id: string
          updated_at?: string
          welcome_bonus_stamps?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          referrals_enabled?: boolean
          referrer_bonus_stamps?: number
          stamp_icon?: string
          stamps_required?: number
          store_id?: string
          updated_at?: string
          welcome_bonus_stamps?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          telegram_user_id: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          telegram_user_id?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          telegram_user_id?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          reward_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          store_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          reward_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          store_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          reward_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          store_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          code: string
          created_at: string
          customer_id: string
          id: string
          store_id: string
        }
        Insert: {
          code: string
          created_at?: string
          customer_id: string
          id?: string
          store_id: string
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualifying_transaction_id: string | null
          referral_code: string
          referred_customer_id: string | null
          referrer_customer_id: string
          rewarded_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualifying_transaction_id?: string | null
          referral_code: string
          referred_customer_id?: string | null
          referrer_customer_id: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          qualifying_transaction_id?: string | null
          referral_code?: string
          referred_customer_id?: string | null
          referrer_customer_id?: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_qualifying_transaction_id_fkey"
            columns: ["qualifying_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["reward_kind"]
          name: string
          program_id: string | null
          stamps_required: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["reward_kind"]
          name: string
          program_id?: string | null
          stamps_required?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["reward_kind"]
          name?: string
          program_id?: string | null
          stamps_required?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["store_role"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          metadata: Json
          related_reward_id: string | null
          staff_id: string | null
          store_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json
          related_reward_id?: string | null
          staff_id?: string | null
          store_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json
          related_reward_id?: string | null
          staff_id?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_related_reward_id_fkey"
            columns: ["related_reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_referral: {
        Args: { _code: string }
        Returns: {
          status: string
          store_id: string
        }[]
      }
      award_stamp: {
        Args: { _amount?: number; _customer_id: string; _store_id: string }
        Returns: {
          membership_id: string
          stamp_balance: number
          stamps_required: number
          transaction_id: string
        }[]
      }
      create_redemption: {
        Args: { _reward_id: string }
        Returns: {
          expires_at: string
          redemption_id: string
          token: string
        }[]
      }
      get_referral_code: { Args: { _store_id: string }; Returns: string }
      is_store_member: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      join_store_program: { Args: { _store_id: string }; Returns: string }
      redeem_reward: {
        Args: { _store_id: string; _token: string }
        Returns: {
          customer_id: string
          redemption_id: string
          reward_name: string
          stamp_balance: number
          stamps_deducted: number
        }[]
      }
      undo_last_stamp: {
        Args: { _customer_id: string; _store_id: string }
        Returns: {
          membership_id: string
          stamp_balance: number
          stamps_required: number
        }[]
      }
    }
    Enums: {
      redemption_status: "pending" | "used" | "expired"
      referral_status: "pending" | "qualified" | "rewarded"
      reward_kind: "standard" | "referral" | "welcome"
      store_role: "owner" | "staff"
      transaction_type:
        | "stamp_awarded"
        | "stamp_reversed"
        | "reward_redeemed"
        | "referral_reward"
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
      redemption_status: ["pending", "used", "expired"],
      referral_status: ["pending", "qualified", "rewarded"],
      reward_kind: ["standard", "referral", "welcome"],
      store_role: ["owner", "staff"],
      transaction_type: [
        "stamp_awarded",
        "stamp_reversed",
        "reward_redeemed",
        "referral_reward",
      ],
    },
  },
} as const
