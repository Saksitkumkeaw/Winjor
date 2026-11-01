// สร้างจาก Supabase ให้สร้างใหม่ทุกครั้งที่แก้โครงสร้างฐานข้อมูล ห้ามแก้ด้วยมือ
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ingredients: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          quantity_on_hand: number;
          reorder_level: number;
          unit: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          quantity_on_hand?: number;
          reorder_level?: number;
          unit: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          quantity_on_hand?: number;
          reorder_level?: number;
          unit?: string;
        };
        Relationships: [];
      };
      product_recipes: {
        Row: {
          ingredient_id: string;
          product_id: string;
          quantity: number;
        };
        Insert: {
          ingredient_id: string;
          product_id: string;
          quantity: number;
        };
        Update: {
          ingredient_id?: string;
          product_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_recipes_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_recipes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          change_qty: number;
          created_at: string;
          created_by: string | null;
          id: string;
          ingredient_id: string;
          order_id: string | null;
          reason: Database["public"]["Enums"]["stock_reason"];
        };
        Insert: {
          change_qty: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          ingredient_id: string;
          order_id?: string | null;
          reason: Database["public"]["Enums"]["stock_reason"];
        };
        Update: {
          change_qty?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          ingredient_id?: string;
          order_id?: string | null;
          reason?: Database["public"]["Enums"]["stock_reason"];
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      movies: {
        Row: {
          created_at: string;
          duration_min: number;
          id: string;
          poster_url: string | null;
          rating: string;
          release_date: string | null;
          status: Database["public"]["Enums"]["movie_status"];
          synopsis: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          duration_min: number;
          id?: string;
          poster_url?: string | null;
          rating?: string;
          release_date?: string | null;
          status?: Database["public"]["Enums"]["movie_status"];
          synopsis?: string;
          title: string;
        };
        Update: {
          created_at?: string;
          duration_min?: number;
          id?: string;
          poster_url?: string | null;
          rating?: string;
          release_date?: string | null;
          status?: Database["public"]["Enums"]["movie_status"];
          synopsis?: string;
          title?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          channel: Database["public"]["Enums"]["order_channel"];
          created_at: string;
          customer_id: string | null;
          discount: number;
          expires_at: string;
          id: string;
          items_picked_up_at: string | null;
          order_no: string;
          sold_by: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
        };
        Insert: {
          channel?: Database["public"]["Enums"]["order_channel"];
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          expires_at: string;
          id?: string;
          items_picked_up_at?: string | null;
          order_no?: string;
          sold_by?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
        };
        Update: {
          channel?: Database["public"]["Enums"]["order_channel"];
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          expires_at?: string;
          id?: string;
          items_picked_up_at?: string | null;
          order_no?: string;
          sold_by?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          total?: number;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          paid_at: string | null;
          provider: string | null;
          provider_charge_id: string | null;
          received_by: string | null;
          refund_reason: string | null;
          refunded_at: string | null;
          refunded_by: string | null;
          status: Database["public"]["Enums"]["payment_status"];
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          paid_at?: string | null;
          provider?: string | null;
          provider_charge_id?: string | null;
          received_by?: string | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          order_id?: string;
          paid_at?: string | null;
          provider?: string | null;
          provider_charge_id?: string | null;
          received_by?: string | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
        };
        Relationships: [];
      };
      products: {
        Row: {
          created_at: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          price?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          phone: string | null;
          points_balance: number;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          phone?: string | null;
          points_balance?: number;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          points_balance?: number;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      scan_logs: {
        Row: {
          created_at: string;
          id: string;
          input_hint: string;
          result: string;
          staff_id: string | null;
          ticket_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input_hint: string;
          result: string;
          staff_id?: string | null;
          ticket_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_hint?: string;
          result?: string;
          staff_id?: string | null;
          ticket_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "scan_logs_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scan_logs_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      seat_types: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          surcharge: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          surcharge?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          surcharge?: number;
        };
        Relationships: [];
      };
      seats: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          row_label: string;
          seat_number: number;
          seat_type_id: string;
          theater_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          row_label: string;
          seat_number: number;
          seat_type_id: string;
          theater_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          row_label?: string;
          seat_number?: number;
          seat_type_id?: string;
          theater_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seats_seat_type_id_fkey";
            columns: ["seat_type_id"];
            isOneToOne: false;
            referencedRelation: "seat_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seats_theater_id_fkey";
            columns: ["theater_id"];
            isOneToOne: false;
            referencedRelation: "theaters";
            referencedColumns: ["id"];
          },
        ];
      };
      showtimes: {
        Row: {
          base_price: number;
          created_at: string;
          ends_at: string;
          id: string;
          movie_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["showtime_status"];
          theater_id: string;
        };
        Insert: {
          base_price: number;
          created_at?: string;
          ends_at: string;
          id?: string;
          movie_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["showtime_status"];
          theater_id: string;
        };
        Update: {
          base_price?: number;
          created_at?: string;
          ends_at?: string;
          id?: string;
          movie_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["showtime_status"];
          theater_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "showtimes_movie_id_fkey";
            columns: ["movie_id"];
            isOneToOne: false;
            referencedRelation: "movies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "showtimes_theater_id_fkey";
            columns: ["theater_id"];
            isOneToOne: false;
            referencedRelation: "theaters";
            referencedColumns: ["id"];
          },
        ];
      };
      theaters: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          id: string;
          order_id: string;
          price: number;
          qr_token: string | null;
          seat_id: string;
          showtime_id: string;
          status: Database["public"]["Enums"]["ticket_status"];
        };
        Insert: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          price: number;
          qr_token?: string | null;
          seat_id: string;
          showtime_id: string;
          status?: Database["public"]["Enums"]["ticket_status"];
        };
        Update: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          price?: number;
          qr_token?: string | null;
          seat_id?: string;
          showtime_id?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
        };
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_seat_id_fkey";
            columns: ["seat_id"];
            isOneToOne: false;
            referencedRelation: "seats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_showtime_id_fkey";
            columns: ["showtime_id"];
            isOneToOne: false;
            referencedRelation: "showtimes";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: {
          created_at: string;
          payload: Json;
          processed_at: string | null;
          provider_event_id: string;
        };
        Insert: {
          created_at?: string;
          payload: Json;
          processed_at?: string | null;
          provider_event_id: string;
        };
        Update: {
          created_at?: string;
          payload?: Json;
          processed_at?: string | null;
          provider_event_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      adjust_stock: {
        Args: {
          p_change: number;
          p_ingredient_id: string;
          p_reason: Database["public"]["Enums"]["stock_reason"];
        };
        Returns: undefined;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: undefined };
      check_in_ticket: { Args: { p_qr_token: string }; Returns: Json };
      pickup_order_items: { Args: { p_order_no: string }; Returns: Json };
      pos_cancel_order: { Args: { p_order_id: string }; Returns: undefined };
      pos_confirm_cash: { Args: { p_order_id: string }; Returns: string };
      pos_create_order: {
        Args: {
          p_items?: Json;
          p_seat_ids?: string[];
          p_showtime_id?: string;
        };
        Returns: string;
      };
      create_theater: {
        Args: { p_name: string; p_rows: number; p_seats_per_row: number };
        Returns: string;
      };
      finalize_order: { Args: { p_order_id: string }; Returns: string };
      get_showtime_seats: {
        Args: { p_showtime_id: string };
        Returns: {
          is_active: boolean;
          is_taken: boolean;
          price: number;
          row_label: string;
          seat_id: string;
          seat_number: number;
          seat_type: string;
        }[];
      };
      hold_seats: {
        Args: { p_items?: Json; p_seat_ids: string[]; p_showtime_id: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: "customer" | "staff" | "admin" | "executive";
      movie_status: "coming_soon" | "now_showing" | "ended";
      order_channel: "online" | "pos";
      order_status: "pending" | "paid" | "expired" | "cancelled" | "refunded";
      payment_method: "card" | "promptpay" | "cash";
      payment_status: "pending" | "succeeded" | "failed" | "refunded";
      showtime_status: "scheduled" | "cancelled";
      stock_reason: "purchase" | "sale" | "adjustment";
      ticket_status: "held" | "paid" | "used" | "released" | "refunded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type MovieStatus = Database["public"]["Enums"]["movie_status"];
export type ShowtimeSeat =
  Database["public"]["Functions"]["get_showtime_seats"]["Returns"][number];
