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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_theater: {
        Args: { p_name: string; p_rows: number; p_seats_per_row: number };
        Returns: string;
      };
    };
    Enums: {
      app_role: "customer" | "staff" | "admin" | "executive";
      movie_status: "coming_soon" | "now_showing" | "ended";
      showtime_status: "scheduled" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type MovieStatus = Database["public"]["Enums"]["movie_status"];
