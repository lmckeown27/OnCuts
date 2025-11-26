export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  username?: string;
  user_type: 'student' | 'barber' | 'admin';
  campus_id?: string;
  is_verified: boolean;
  profile_picture_url?: string;
  created_at: string;
}

export interface Campus {
  id: string;
  name: string;
  domain: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  is_active: boolean;
}

export interface Barber {
  id: string;
  user_id: string;
  user?: User;
  bio: string;
  specialties: string[];
  years_of_experience: number;
  pricing: Service[];
  average_rating: number;
  total_bookings: number;
  instant_book_enabled: boolean;
  is_active: boolean;
  portfolio_images?: PortfolioImage[];
  availability?: AvailabilityTemplate[];
}

export interface PortfolioImage {
  id: string;
  barber_id: string;
  image_url: string;
  thumbnail_url: string;
  order_index: number;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
}

export interface AvailabilityTemplate {
  id: string;
  barber_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // "09:00"
  end_time: string; // "17:00"
  is_active: boolean;
}

export interface Booking {
  id: string;
  student_id: string;
  barber_id: string;
  service_id?: string;
  service_name: string;
  service_price: number;
  scheduled_time: string;
  duration_minutes: number;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  special_requests?: string;
  student?: User;
  barber?: Barber;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  barber_id: string;
  student_id: string;
  rating: number; // 1-5
  review_text?: string;
  student?: User;
  created_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  booking_id?: string;
  last_message?: Message;
  last_message_at?: string;
  unread_count?: number;
  other_user?: User;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  media_url?: string;
  is_read: boolean;
  sender?: User;
  created_at: string;
}

export interface PaymentIntent {
  client_secret: string;
  amount: number;
  booking_id: string;
}

export interface EarningsReport {
  total_earnings: number;
  total_tips: number;
  total_bookings: number;
  period: {
    start: string;
    end: string;
  };
  daily_breakdown?: Array<{
    date: string;
    earnings: number;
    tips: number;
    bookings: number;
  }>;
}

export interface NotificationPreferences {
  messages: boolean;
  bookings: boolean;
  reviews: boolean;
  system: boolean;
  marketing: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

