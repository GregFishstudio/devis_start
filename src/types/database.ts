export type Company = {
  id: string;
  name: string;
  siret: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  tva_number: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  siret: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewClient = Pick<Client, 'name' | 'email' | 'phone' | 'address' | 'siret' | 'notes'>;

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type Quote = {
  id: string;
  company_id: string;
  client_id: string | null;
  number: string;
  status: QuoteStatus;
  title: string | null;
  description: string | null;
  notes: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  pdf_url: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  position: number;
  created_at: string;
};

export type NewQuoteItem = Omit<QuoteItem, 'id' | 'total' | 'created_at'>;

export type ChatMessage = {
  id: string;
  company_id: string;
  user_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  intent: 'quote' | 'instagram' | 'note' | null;
  metadata: Record<string, unknown>;
  audio_url: string | null;
  created_at: string;
};

export type InstagramPostStatus = 'pending' | 'processing' | 'posted' | 'failed';

export type InstagramPost = {
  id: string;
  company_id: string;
  media_url: string | null;
  media_type: 'image' | 'video' | 'carousel';
  caption: string | null;
  context: string | null;
  status: InstagramPostStatus;
  instagram_id: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: Omit<Company, 'id' | 'created_at'>;
        Update: Partial<Omit<Company, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Client, 'id' | 'company_id' | 'created_at'>>;
      };
      quotes: {
        Row: Quote;
        Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at' | 'clients'>;
        Update: Partial<Omit<Quote, 'id' | 'company_id' | 'created_at' | 'clients'>>;
      };
      quote_items: {
        Row: QuoteItem;
        Insert: Omit<QuoteItem, 'id' | 'total' | 'created_at'>;
        Update: Partial<Omit<QuoteItem, 'id' | 'quote_id' | 'created_at' | 'total'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'created_at'>;
        Update: never;
      };
      instagram_posts: {
        Row: InstagramPost;
        Insert: Omit<InstagramPost, 'id' | 'created_at'>;
        Update: Partial<Omit<InstagramPost, 'id' | 'company_id' | 'created_at'>>;
      };
    };
  };
};
