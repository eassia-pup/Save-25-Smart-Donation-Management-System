export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          phone: string | null
          address_unit: string | null
          address_line1: string | null
          address_line2: string | null
          address_city: string | null
          address_state: string | null
          address_zip: string | null
          address_country: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          phone?: string | null
          address_unit?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_city?: string | null
          address_state?: string | null
          address_zip?: string | null
          address_country?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          phone?: string | null
          address_unit?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_city?: string | null
          address_state?: string | null
          address_zip?: string | null
          address_country?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          title: string
          short_description: string
          full_description: string
          image_url: string | null
          category: string
          goal: number
          raised: number
          donor_count: number
          start_date: string
          end_date: string
          status: Database["public"]["Enums"]["campaign_status"]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          short_description: string
          full_description: string
          image_url?: string | null
          category?: string
          goal?: number
          raised?: number
          donor_count?: number
          start_date?: string
          end_date?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          short_description?: string
          full_description?: string
          image_url?: string | null
          category?: string
          goal?: number
          raised?: number
          donor_count?: number
          start_date?: string
          end_date?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      donations: {
        Row: {
          id: string
          campaign_id: string
          donor_id: string
          amount: number
          method: Database["public"]["Enums"]["donation_method"]
          cardholder_name: string
          card_last_four: string | null
          billing_address: string | null
          contact_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          donor_id: string
          amount: number
          method: Database["public"]["Enums"]["donation_method"]
          cardholder_name: string
          card_last_four?: string | null
          billing_address?: string | null
          contact_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          donor_id?: string
          amount?: number
          method?: Database["public"]["Enums"]["donation_method"]
          cardholder_name?: string
          card_last_four?: string | null
          billing_address?: string | null
          contact_number?: string | null
          created_at?: string
        }
      }
      inkind_donations: {
        Row: {
          id: string
          campaign_id: string
          donor_id: string
          donor_name: string
          inkind_type: Database["public"]["Enums"]["inkind_type"]
          amount_description: string
          contact_number: string
          address: string
          ra_4653_compliance: boolean
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          donor_id: string
          donor_name: string
          inkind_type: Database["public"]["Enums"]["inkind_type"]
          amount_description: string
          contact_number: string
          address: string
          ra_4653_compliance?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          donor_id?: string
          donor_name?: string
          inkind_type?: Database["public"]["Enums"]["inkind_type"]
          amount_description?: string
          contact_number?: string
          address?: string
          ra_4653_compliance?: boolean
          created_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          item_name: string
          category: string
          quantity: string
          campaign_id: string | null
          donor_id: string | null
          donor_name: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          item_name: string
          category: string
          quantity: string
          campaign_id?: string | null
          donor_id?: string | null
          donor_name?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          category?: string
          quantity?: string
          campaign_id?: string | null
          donor_id?: string | null
          donor_name?: string | null
          status?: string
          created_at?: string
        }
      }
      deliveries: {
        Row: {
          id: string
          campaign_id: string
          status: string
          assigned_personnel: string | null
          destination: string | null
          estimated_delivery: string | null
          progress: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          status?: string
          assigned_personnel?: string | null
          destination?: string | null
          estimated_delivery?: string | null
          progress?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          status?: string
          assigned_personnel?: string | null
          destination?: string | null
          estimated_delivery?: string | null
          progress?: number
          created_at?: string
          updated_at?: string
        }
      }
      delivery_checkpoints: {
        Row: {
          id: string
          delivery_id: string
          name: string
          status: string
          checkpoint_time: string | null
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          delivery_id: string
          name: string
          status?: string
          checkpoint_time?: string | null
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          delivery_id?: string
          name?: string
          status?: string
          checkpoint_time?: string | null
          order_index?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      user_role: "donor" | "admin" | "trustee"
      donation_method: "credit_card" | "debit_card"
      inkind_type: "relief_goods" | "new_clothes" | "medicine" | "essential_goods"
      campaign_status: "active" | "paused" | "completed" | "cancelled" | "postponed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]

export type Campaign = Tables<"campaigns">
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"]
export type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"]
export type CampaignStatus = Enums<"campaign_status">

export type Delivery = Tables<"deliveries">
export type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"]
export type DeliveryUpdate = Database["public"]["Tables"]["deliveries"]["Update"]

export type DeliveryCheckpoint = Tables<"delivery_checkpoints">
export type DeliveryCheckpointInsert = Database["public"]["Tables"]["delivery_checkpoints"]["Insert"]
export type DeliveryCheckpointUpdate = Database["public"]["Tables"]["delivery_checkpoints"]["Update"]

export type Inventory = Tables<"inventory">
export type InventoryInsert = Database["public"]["Tables"]["inventory"]["Insert"]
export type InventoryUpdate = Database["public"]["Tables"]["inventory"]["Update"]

export type Profile = Tables<"profiles">
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
