// Tipos compartidos del panel de administración. Extraídos de page.tsx para
// que los componentes de cada pestaña (_components/*) los reutilicen.

export interface Event {
  id: string;
  title: string;
  details: string;
  price: string;
  flyer_url: string;
  flyer_ratio: string;
  maps_url?: string;
  venue_name?: string;
  is_popular?: boolean;
  organizer?: string;
  archived?: boolean;
  publish_at?: string;
  event_date?: string;
  event_date_iso?: string;
  event_time?: string;
  event_time_end?: string;
  max_tickets?: number;
  max_per_person?: number;
  dress_code?: string;
  min_age?: number;
  sale_start?: string;
  sale_end?: string;
  archive_at?: string;
  ticket_types?: { name: string; color: string; price?: number }[];
  created_at: string;
  reservation_total?: number;
  reservation_used?: number;
}

export interface User {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  name?: string | null;
  userType?: string | null;
  source?: "registered" | "reservation";
}

export interface Reservation {
  id: string;
  code: string;
  event_id: string;
  user_email: string;
  user_name: string;
  guest_count: number;
  status: string;
  created_at: string;
  link_pin?: string | null;
  checked_in_at?: string | null;
  events: { title: string; event_date_iso?: string; archived?: boolean } | null;
}

export interface GalleryItem {
  id: string;
  url: string;
  type: "image" | "video";
  created_at: string;
}

export interface HeroPhoto {
  id: string;
  url: string;
  created_at: string;
}

export interface RentalItem {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: string;
  photos: string[];
  contact_phone: string;
  contact_email: string;
  available: boolean;
  archived?: boolean;
  created_at: string;
}

export interface RentalConfig {
  items: RentalItem[];
  section_name: string;
  button_name: string;
  enabled: boolean;
}
