export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** All-optional, null-tolerant row type used for Insert/Update payloads. */
type Upsertable<T> = { [K in keyof T]?: T[K] | null };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          timezone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Upsertable<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          logo_path: string | null;
          logo_url: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          tax_id: string | null;
          registration_number: string | null;
          additional_info: string | null;
          default_currency: string;
          default_template: string;
          invoice_prefix: string;
          next_invoice_number: number;
          number_padding: number;
          default_payment_terms: string;
          default_notes: string;
          default_terms: string;
          default_design: Json;
          default_payment_enabled: boolean;
          default_payment_provider: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["business_settings"]["Row"]> & {
          user_id: string;
        };
        Update: Upsertable<Database["public"]["Tables"]["business_settings"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company: string | null;
          email: string | null;
          phone: string | null;
          billing_address: string | null;
          shipping_address: string | null;
          tax_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["customers"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Upsertable<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          invoice_type: string;
          customer_id: string | null;
          customer_name: string;
          customer_company: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          customer_address: string | null;
          customer_shipping: string | null;
          customer_tax_id: string | null;
          invoice_date: string;
          due_date: string | null;
          po_number: string | null;
          reference: string | null;
          currency: string;
          currency_symbol: string | null;
          payment_terms: string | null;
          status: string;
          payment_status: string;
          subtotal: number;
          discount_type: string;
          discount_value: number;
          discount_total: number;
          tax_total: number;
          shipping: number;
          fees: number;
          adjustment: number;
          total: number;
          amount_paid: number;
          amount_due: number;
          template: string;
          design_settings: Json;
          notes: string | null;
          terms: string | null;
          footer_text: string | null;
          payment_instructions: string | null;
          payment_enabled: boolean;
          payment_provider: string | null;
          public_token: string;
          published_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["invoices"]["Row"]> & {
          user_id: string;
          invoice_number: string;
        };
        Update: Upsertable<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          user_id: string;
          name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          discount: number;
          tax: number;
          line_total: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["invoice_items"]["Row"]> & {
          invoice_id: string;
          user_id: string;
        };
        Update: Upsertable<Database["public"]["Tables"]["invoice_items"]["Row"]>;
        Relationships: [];
      };
      invoice_templates: {
        Row: {
          id: string;
          user_id: string | null;
          slug: string;
          name: string;
          description: string | null;
          thumbnail: string | null;
          design_settings: Json;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["invoice_templates"]["Row"]>;
        Update: Upsertable<Database["public"]["Tables"]["invoice_templates"]["Row"]>;
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          id: string;
          invoice_id: string;
          user_id: string;
          provider: string;
          provider_session_id: string | null;
          provider_payment_id: string | null;
          amount: number;
          currency: string;
          status: string;
          is_test: boolean;
          raw_event: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Upsertable<Database["public"]["Tables"]["payment_transactions"]["Row"]>;
        Update: Upsertable<Database["public"]["Tables"]["payment_transactions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_public_invoice: { Args: { p_token: string }; Returns: unknown };
      reserve_invoice_number: {
        Args: { p_user_id: string; p_prefix?: string | null; p_padding?: number | null };
        Returns: string;
      };
      duplicate_invoice: {
        Args: { p_invoice_id: string; p_new_number?: string | null };
        Returns: string;
      };
      recalculate_invoice_totals: { Args: { p_invoice_id: string }; Returns: undefined };
      sync_payment_status: { Args: { p_invoice_id: string }; Returns: undefined };
      record_payment: {
        Args: {
          p_invoice_id: string;
          p_provider: string;
          p_amount: number;
          p_currency: string;
          p_session_id?: string | null;
          p_payment_id?: string | null;
          p_status?: string | null;
          p_is_test?: boolean | null;
          p_raw_event?: Json | null;
        };
        Returns: string;
      };
    };
    Enums: {
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "paid"
        | "partial"
        | "overdue"
        | "cancelled";
      payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "partially_paid"
        | "overdue"
        | "cancelled"
        | "refunded";
      invoice_type: "standard" | "tax" | "proforma" | "commercial" | "custom";
      payment_provider: "stripe" | "paypal" | "manual";
      transaction_status:
        | "created"
        | "pending"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InvoiceRow = Tables<"invoices">;
export type InvoiceItemRow = Tables<"invoice_items">;
export type CustomerRow = Tables<"customers">;
export type BusinessSettingsRow = Tables<"business_settings">;
export type ProfileRow = Tables<"profiles">;
export type InvoiceTemplateRow = Tables<"invoice_templates">;
export type PaymentTransactionRow = Tables<"payment_transactions">;
