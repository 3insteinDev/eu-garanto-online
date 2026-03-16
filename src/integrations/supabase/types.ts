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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      game_state: {
        Row: {
          bids: Json
          current_player_seat: number | null
          current_trick: Json
          dealer_seat: number
          hands: Json
          phase: Database["public"]["Enums"]["game_phase"]
          room_id: string
          round_index: number
          round_num_cards: number | null
          round_number: number
          round_sequence: Json
          scores: Json
          tricks_played: Json
          tricks_won: Json
          trump_card: Json | null
          trump_suit: Database["public"]["Enums"]["card_suit"] | null
          updated_at: string
        }
        Insert: {
          bids?: Json
          current_player_seat?: number | null
          current_trick?: Json
          dealer_seat?: number
          hands?: Json
          phase?: Database["public"]["Enums"]["game_phase"]
          room_id: string
          round_index?: number
          round_num_cards?: number | null
          round_number?: number
          round_sequence?: Json
          scores?: Json
          tricks_played?: Json
          tricks_won?: Json
          trump_card?: Json | null
          trump_suit?: Database["public"]["Enums"]["card_suit"] | null
          updated_at?: string
        }
        Update: {
          bids?: Json
          current_player_seat?: number | null
          current_trick?: Json
          dealer_seat?: number
          hands?: Json
          phase?: Database["public"]["Enums"]["game_phase"]
          room_id?: string
          round_index?: number
          round_num_cards?: number | null
          round_number?: number
          round_sequence?: Json
          scores?: Json
          tricks_played?: Json
          tricks_won?: Json
          trump_card?: Json | null
          trump_suit?: Database["public"]["Enums"]["card_suit"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          connected: boolean
          created_at: string
          id: string
          is_bot: boolean
          name: string
          player_id: string
          room_id: string
          score: number
          seat: number
        }
        Insert: {
          connected?: boolean
          created_at?: string
          id?: string
          is_bot?: boolean
          name: string
          player_id: string
          room_id: string
          score?: number
          seat: number
        }
        Update: {
          connected?: boolean
          created_at?: string
          id?: string
          is_bot?: boolean
          name?: string
          player_id?: string
          room_id?: string
          score?: number
          seat?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          game_mode: Database["public"]["Enums"]["game_mode"]
          host_id: string
          id: string
          max_players: number
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          game_mode?: Database["public"]["Enums"]["game_mode"]
          host_id: string
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          game_mode?: Database["public"]["Enums"]["game_mode"]
          host_id?: string
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      card_suit: "hearts" | "diamonds" | "clubs" | "spades"
      game_mode: "classic" | "manilha"
      game_phase:
        | "waiting"
        | "dealing"
        | "bidding"
        | "playing"
        | "trick_end"
        | "round_end"
        | "game_over"
      room_status: "waiting" | "in_progress" | "finished"
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
      card_suit: ["hearts", "diamonds", "clubs", "spades"],
      game_mode: ["classic", "manilha"],
      game_phase: [
        "waiting",
        "dealing",
        "bidding",
        "playing",
        "trick_end",
        "round_end",
        "game_over",
      ],
      room_status: ["waiting", "in_progress", "finished"],
    },
  },
} as const
