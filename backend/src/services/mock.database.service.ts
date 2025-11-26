/**
 * Mock Database Service
 * In-memory database for development and testing without PostgreSQL
 */

import { User, Campus, Barber, Booking, Review } from '../types/index';

class MockDatabaseService {
  private users: Map<string, any> = new Map();
  private campuses: Map<string, any> = new Map();
  private barbers: Map<string, any> = new Map();
  private bookings: Map<string, any> = new Map();
  private reviews: Map<string, any> = new Map();
  private portfolioImages: Map<string, any> = new Map();
  private availabilityTemplates: Map<string, any> = new Map();
  private messages: Map<string, any> = new Map();
  private paymentTransactions: Map<string, any> = new Map();

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed campuses
    const campuses = [
      {
        id: '1',
        name: 'California Polytechnic State University, San Luis Obispo',
        domain: 'calpoly.edu',
        city: 'San Luis Obispo',
        state: 'CA',
        country: 'USA',
        timezone: 'America/Los_Angeles',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'University of California, Santa Barbara',
        domain: 'ucsb.edu',
        city: 'Santa Barbara',
        state: 'CA',
        country: 'USA',
        timezone: 'America/Los_Angeles',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    campuses.forEach(campus => this.campuses.set(campus.id, campus));

    // Seed users
    const users = [
      {
        id: '1',
        email: 'student@calpoly.edu',
        password_hash: '$2b$10$placeholder', // bcrypt hash of "password123"
        first_name: 'Alex',
        last_name: 'Mustang',
        user_type: 'student',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'barber@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Carlos',
        last_name: 'Rodriguez',
        user_type: 'barber',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        email: 'student@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Sarah',
        last_name: 'Gaucho',
        user_type: 'student',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '4',
        email: 'barber@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Marcus',
        last_name: 'Williams',
        user_type: 'barber',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '5',
        email: 'admin@campuscuts.com',
        password_hash: '$2b$10$placeholder',
        first_name: 'Admin',
        last_name: 'User',
        user_type: 'admin',
        is_verified: true,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    users.forEach(user => this.users.set(user.id, user));

    // Seed barbers
    const barbers = [
      {
        id: '1',
        user_id: '2',
        bio: 'Cal Poly barber serving students since 2019. Specializing in fades, tapers, and modern cuts. Walk-ins welcome!',
        specialties: ['Fades', 'Tapers', 'Beard Trim', 'Hair Design', 'Lineup'],
        years_of_experience: 5,
        base_price: 25,
        average_rating: 4.8,
        total_bookings: 234,
        total_reviews: 156,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        user_id: '4',
        bio: 'UCSB\'s premier barber! 7+ years experience. Expert in all hair types and styles. Book me for your next cut!',
        specialties: ['Classic Cuts', 'Fades', 'Perms', 'Color', 'Braids'],
        years_of_experience: 7,
        base_price: 30,
        average_rating: 4.9,
        total_bookings: 312,
        total_reviews: 201,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa',
        created_at: new Date().toISOString(),
      },
    ];

    barbers.forEach(barber => this.barbers.set(barber.id, barber));

    // Seed bookings
    const bookings = [
      {
        id: '1',
        barber_id: '1',
        client_id: '1',
        service_name: 'Haircut & Fade',
        service_price: 25,
        scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        duration_minutes: 45,
        location: 'Cal Poly Campus - Near Kennedy Library',
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        barber_id: '2',
        client_id: '3',
        service_name: 'Classic Cut',
        service_price: 30,
        scheduled_at: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
        duration_minutes: 60,
        location: 'UCSB - Storke Tower Area',
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
    ];

    bookings.forEach(booking => this.bookings.set(booking.id, booking));

    // Seed reviews
    const reviews = [
      {
        id: '1',
        booking_id: '1',
        barber_id: '1',
        client_id: '1',
        rating: 5,
        comment: 'Carlos gave me the cleanest fade! Super professional and knows what Cal Poly students want. Highly recommend!',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        booking_id: '2',
        barber_id: '2',
        client_id: '3',
        rating: 5,
        comment: 'Marcus is the best! Perfect cut every time. Worth every penny. All UCSB students should book with him!',
        created_at: new Date().toISOString(),
      },
    ];

    reviews.forEach(review => this.reviews.set(review.id, review));

    console.log('✅ Mock database seeded with initial data');
  }

  // User operations
  async findUserByEmail(email: string): Promise<any | null> {
    const users = Array.from(this.users.values());
    return users.find(u => u.email === email) || null;
  }

  async findUserById(id: string): Promise<any | null> {
    return this.users.get(id) || null;
  }

  async createUser(userData: any): Promise<any> {
    const id = (this.users.size + 1).toString();
    const user = {
      id,
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: any): Promise<any> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    
    const updated = { ...user, ...updates, updated_at: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  // Campus operations
  async getAllCampuses(): Promise<any[]> {
    return Array.from(this.campuses.values());
  }

  async findCampusById(id: string): Promise<any | null> {
    return this.campuses.get(id) || null;
  }

  // Barber operations
  async findBarbersByFilter(filter: any): Promise<any[]> {
    let barbers = Array.from(this.barbers.values());
    
    if (filter.campus_id) {
      barbers = barbers.filter(b => {
        const user = this.users.get(b.user_id);
        return user && user.campus_id === filter.campus_id;
      });
    }
    
    if (filter.is_active !== undefined) {
      barbers = barbers.filter(b => b.is_active === filter.is_active);
    }
    
    return barbers;
  }

  async findBarberById(id: string): Promise<any | null> {
    return this.barbers.get(id) || null;
  }

  async createBarber(barberData: any): Promise<any> {
    const id = (this.barbers.size + 1).toString();
    const barber = {
      id,
      ...barberData,
      average_rating: 0,
      total_bookings: 0,
      total_reviews: 0,
      created_at: new Date().toISOString(),
    };
    this.barbers.set(id, barber);
    return barber;
  }

  async updateBarber(id: string, updates: any): Promise<any> {
    const barber = this.barbers.get(id);
    if (!barber) throw new Error('Barber not found');
    
    const updated = { ...barber, ...updates, updated_at: new Date().toISOString() };
    this.barbers.set(id, updated);
    return updated;
  }

  // Booking operations
  async createBooking(bookingData: any): Promise<any> {
    const id = (this.bookings.size + 1).toString();
    const booking = {
      id,
      ...bookingData,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async findBookingById(id: string): Promise<any | null> {
    return this.bookings.get(id) || null;
  }

  async findBookingsByUser(userId: string, userType: 'client' | 'barber'): Promise<any[]> {
    const bookings = Array.from(this.bookings.values());
    if (userType === 'client') {
      return bookings.filter(b => b.client_id === userId);
    } else {
      return bookings.filter(b => b.barber_id === userId);
    }
  }

  async updateBooking(id: string, updates: any): Promise<any> {
    const booking = this.bookings.get(id);
    if (!booking) throw new Error('Booking not found');
    
    const updated = { ...booking, ...updates, updated_at: new Date().toISOString() };
    this.bookings.set(id, updated);
    return updated;
  }

  // Review operations
  async createReview(reviewData: any): Promise<any> {
    const id = (this.reviews.size + 1).toString();
    const review = {
      id,
      ...reviewData,
      created_at: new Date().toISOString(),
    };
    this.reviews.set(id, review);

    // Update barber rating
    const barberId = reviewData.barber_id;
    const barberReviews = Array.from(this.reviews.values()).filter(r => r.barber_id === barberId);
    const avgRating = barberReviews.reduce((sum, r) => sum + r.rating, 0) / barberReviews.length;
    
    const barber = this.barbers.get(barberId);
    if (barber) {
      barber.average_rating = Math.round(avgRating * 10) / 10;
      barber.total_reviews = barberReviews.length;
      this.barbers.set(barberId, barber);
    }

    return review;
  }

  async findReviewsByBarber(barberId: string): Promise<any[]> {
    return Array.from(this.reviews.values()).filter(r => r.barber_id === barberId);
  }

  // Payment operations
  async createPaymentTransaction(paymentData: any): Promise<any> {
    const id = (this.paymentTransactions.size + 1).toString();
    const payment = {
      id,
      ...paymentData,
      created_at: new Date().toISOString(),
    };
    this.paymentTransactions.set(id, payment);
    return payment;
  }

  async findPaymentByBooking(bookingId: string): Promise<any | null> {
    const payments = Array.from(this.paymentTransactions.values());
    return payments.find(p => p.booking_id === bookingId) || null;
  }

  // Utility methods
  clear() {
    this.users.clear();
    this.campuses.clear();
    this.barbers.clear();
    this.bookings.clear();
    this.reviews.clear();
    this.portfolioImages.clear();
    this.availabilityTemplates.clear();
    this.messages.clear();
    this.paymentTransactions.clear();
    this.seedInitialData();
  }

  getStats() {
    return {
      users: this.users.size,
      campuses: this.campuses.size,
      barbers: this.barbers.size,
      bookings: this.bookings.size,
      reviews: this.reviews.size,
      payments: this.paymentTransactions.size,
    };
  }
}

export default new MockDatabaseService();

