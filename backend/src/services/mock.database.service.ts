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

    // Seed users - Students
    const users = [
      // Cal Poly Students
      {
        id: '1',
        email: 'alex.mustang@calpoly.edu',
        password_hash: '$2b$10$placeholder', // bcrypt hash of "password123"
        first_name: 'Alex',
        last_name: 'Mustang',
        user_type: 'student',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=alex',
        created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
      },
      {
        id: '2',
        email: 'emma.poly@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Emma',
        last_name: 'Chen',
        user_type: 'student',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=emma',
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        email: 'jake.torres@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Jake',
        last_name: 'Torres',
        user_type: 'student',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=jake',
        created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      },
      // UCSB Students
      {
        id: '4',
        email: 'sarah.gaucho@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Sarah',
        last_name: 'Johnson',
        user_type: 'student',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=sarah',
        created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '5',
        email: 'michael.garcia@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Michael',
        last_name: 'Garcia',
        user_type: 'student',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=michael',
        created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '6',
        email: 'olivia.martinez@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Olivia',
        last_name: 'Martinez',
        user_type: 'student',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=olivia',
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      
      // Barbers - Cal Poly
      {
        id: '10',
        email: 'carlos.rodriguez@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Carlos',
        last_name: 'Rodriguez',
        user_type: 'barber',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=carlos',
        created_at: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years ago
      },
      {
        id: '11',
        email: 'david.kim@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'David',
        last_name: 'Kim',
        user_type: 'barber',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=david',
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '12',
        email: 'james.brown@calpoly.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'James',
        last_name: 'Brown',
        user_type: 'barber',
        campus_id: '1',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=james',
        created_at: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000).toISOString(),
      },
      
      // Barbers - UCSB
      {
        id: '13',
        email: 'marcus.williams@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Marcus',
        last_name: 'Williams',
        user_type: 'barber',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=marcus',
        created_at: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '14',
        email: 'tyler.jackson@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Tyler',
        last_name: 'Jackson',
        user_type: 'barber',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=tyler',
        created_at: new Date(Date.now() - 600 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '15',
        email: 'antonio.lopez@ucsb.edu',
        password_hash: '$2b$10$placeholder',
        first_name: 'Antonio',
        last_name: 'Lopez',
        user_type: 'barber',
        campus_id: '2',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=antonio',
        created_at: new Date(Date.now() - 450 * 24 * 60 * 60 * 1000).toISOString(),
      },
      
      // Admin
      {
        id: '99',
        email: 'admin@campuscuts.com',
        password_hash: '$2b$10$placeholder',
        first_name: 'System',
        last_name: 'Administrator',
        user_type: 'admin',
        is_verified: true,
        is_active: true,
        profile_picture_url: 'https://i.pravatar.cc/150?u=admin',
        created_at: new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    users.forEach(user => this.users.set(user.id, user));

    // Seed barbers with comprehensive data
    const barbers = [
      // Cal Poly Barbers
      {
        id: '1',
        user_id: '10',
        bio: 'Cal Poly barber serving students since 2019. Specializing in fades, tapers, and modern cuts. I understand student life and work around your schedule. Walk-ins welcome! Instagram: @carloscuts_slo',
        specialties: ['Fades', 'Tapers', 'Beard Trim', 'Hair Design', 'Lineup'],
        years_of_experience: 5,
        pricing: [
          { id: '1', name: 'Classic Haircut', description: 'Traditional scissor cut', price: 20, duration_minutes: 30 },
          { id: '2', name: 'Fade & Taper', description: 'Modern fade with lineup', price: 25, duration_minutes: 45 },
          { id: '3', name: 'Beard Trim', description: 'Shape and lineup', price: 15, duration_minutes: 20 },
          { id: '4', name: 'Haircut + Beard', description: 'Complete grooming package', price: 35, duration_minutes: 60 },
        ],
        average_rating: 4.8,
        total_bookings: 234,
        total_reviews: 156,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa',
        portfolio_images: [
          { id: '1', barber_id: '1', image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=200', order_index: 1, created_at: new Date().toISOString() },
          { id: '2', barber_id: '1', image_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=200', order_index: 2, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        user_id: '11',
        bio: 'Korean-trained barber bringing precision cuts to Cal Poly. Expert in Asian hair textures and K-pop inspired styles. Clean, professional, and always on time. Member of National Barber Association.',
        specialties: ['Asian Hair', 'Modern Styles', 'K-Pop Cuts', 'Perms', 'Two-Block'],
        years_of_experience: 3,
        pricing: [
          { id: '5', name: 'Standard Cut', description: 'Clean and professional', price: 22, duration_minutes: 35 },
          { id: '6', name: 'K-Style Cut', description: 'Textured layered cut', price: 28, duration_minutes: 50 },
          { id: '7', name: 'Perm Styling', description: 'Texture perm service', price: 80, duration_minutes: 120 },
        ],
        average_rating: 4.9,
        total_bookings: 167,
        total_reviews: 98,
        instant_book_enabled: false,
        is_active: true,
        aptos_address: '0x60c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21bb',
        portfolio_images: [
          { id: '3', barber_id: '2', image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200', order_index: 1, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        user_id: '12',
        bio: 'Afro-textured hair specialist with 8+ years experience. From high-top fades to intricate designs, I got you covered. Supporting the Black community at Cal Poly one cut at a time. Appointments preferred.',
        specialties: ['Afro Hair', 'Waves', 'Designs', 'Twists', 'Dreadlocks'],
        years_of_experience: 8,
        pricing: [
          { id: '8', name: 'Fade & Shape', description: 'Clean fade with lineup', price: 30, duration_minutes: 45 },
          { id: '9', name: 'Hair Design', description: 'Custom artwork in hair', price: 40, duration_minutes: 60 },
          { id: '10', name: 'Twist Service', description: 'Two-strand twists', price: 50, duration_minutes: 90 },
        ],
        average_rating: 4.7,
        total_bookings: 289,
        total_reviews: 178,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x70c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21cc',
        portfolio_images: [
          { id: '4', barber_id: '3', image_url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=200', order_index: 1, created_at: new Date().toISOString() },
          { id: '5', barber_id: '3', image_url: 'https://images.unsplash.com/photo-1627481205246-e5d0dd04e46a?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1627481205246-e5d0dd04e46a?w=200', order_index: 2, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 540 * 24 * 60 * 60 * 1000).toISOString(),
      },
      
      // UCSB Barbers
      {
        id: '4',
        user_id: '13',
        bio: 'UCSB\'s premier barber! 7+ years experience serving the Isla Vista community. Expert in all hair types and styles - from classic to contemporary. Licensed and insured. Book me for your next cut!',
        specialties: ['Classic Cuts', 'Fades', 'Perms', 'Color', 'Braids'],
        years_of_experience: 7,
        pricing: [
          { id: '11', name: 'Classic Haircut', description: 'Timeless style', price: 25, duration_minutes: 40 },
          { id: '12', name: 'Fade Special', description: 'Precision fade work', price: 30, duration_minutes: 50 },
          { id: '13', name: 'Color Service', description: 'Full color treatment', price: 65, duration_minutes: 90 },
          { id: '14', name: 'Premium Package', description: 'Cut, color, and style', price: 85, duration_minutes: 120 },
        ],
        average_rating: 4.9,
        total_bookings: 312,
        total_reviews: 201,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x80c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21dd',
        portfolio_images: [
          { id: '6', barber_id: '4', image_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=200', order_index: 1, created_at: new Date().toISOString() },
          { id: '7', barber_id: '4', image_url: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=200', order_index: 2, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '5',
        user_id: '14',
        bio: 'Young entrepreneur bringing fresh vibes to UCSB! Former D1 athlete turned barber. I know what student-athletes need - quick, clean, and professional. Same-day appointments available!',
        specialties: ['Athletic Cuts', 'Buzz Cuts', 'Fades', 'Lineup', 'Quick Service'],
        years_of_experience: 2,
        pricing: [
          { id: '15', name: 'Quick Cut', description: 'Fast and clean', price: 18, duration_minutes: 25 },
          { id: '16', name: 'Athlete Special', description: 'Low maintenance cut', price: 22, duration_minutes: 30 },
          { id: '17', name: 'Fresh Fade', description: 'Modern taper fade', price: 26, duration_minutes: 40 },
        ],
        average_rating: 4.6,
        total_bookings: 143,
        total_reviews: 87,
        instant_book_enabled: true,
        is_active: true,
        aptos_address: '0x90c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21ee',
        portfolio_images: [
          { id: '8', barber_id: '5', image_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=200', order_index: 1, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 600 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '6',
        user_id: '15',
        bio: 'Latino barber specializing in traditional barbershop experience with modern techniques. Precision cuts, hot towel shaves, and great conversation. Making UCSB students look their best since 2018!',
        specialties: ['Traditional Cuts', 'Hot Shaves', 'Mustache Trim', 'Classic Styles', 'Skin Fades'],
        years_of_experience: 6,
        pricing: [
          { id: '18', name: 'Traditional Cut', description: 'Classic barbershop style', price: 24, duration_minutes: 45 },
          { id: '19', name: 'Hot Shave', description: 'Luxury shaving experience', price: 35, duration_minutes: 40 },
          { id: '20', name: 'Complete Grooming', description: 'Cut, shave, and facial', price: 55, duration_minutes: 90 },
        ],
        average_rating: 4.8,
        total_bookings: 267,
        total_reviews: 145,
        instant_book_enabled: false,
        is_active: true,
        aptos_address: '0xa0c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21ff',
        portfolio_images: [
          { id: '9', barber_id: '6', image_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=200', order_index: 1, created_at: new Date().toISOString() },
          { id: '10', barber_id: '6', image_url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=500', thumbnail_url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=200', order_index: 2, created_at: new Date().toISOString() },
        ],
        created_at: new Date(Date.now() - 450 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    barbers.forEach(barber => this.barbers.set(barber.id, barber));

    // Seed bookings - Mix of upcoming, pending, and completed
    const bookings = [
      // Upcoming confirmed bookings
      {
        id: '1',
        barber_id: '1',
        student_id: '1',
        service_id: '2',
        service_name: 'Fade & Taper',
        service_price: 25,
        scheduled_time: new Date(Date.now() + 3600000 * 4).toISOString(), // 4 hours from now
        duration_minutes: 45,
        location: 'Cal Poly Campus - Near Kennedy Library',
        status: 'confirmed',
        special_requests: 'Low fade please',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '2',
        barber_id: '4',
        student_id: '4',
        service_id: '12',
        service_name: 'Fade Special',
        service_price: 30,
        scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        duration_minutes: 50,
        location: 'UCSB - Storke Tower Area',
        status: 'confirmed',
        special_requests: '',
        created_at: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: '3',
        barber_id: '2',
        student_id: '2',
        service_id: '6',
        service_name: 'K-Style Cut',
        service_price: 28,
        scheduled_time: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
        duration_minutes: 50,
        location: 'Cal Poly - Vista Grande',
        status: 'confirmed',
        special_requests: 'Want it similar to BTS V style',
        created_at: new Date(Date.now() - 259200000).toISOString(),
      },
      
      // Pending booking requests
      {
        id: '4',
        barber_id: '3',
        student_id: '3',
        service_id: '9',
        service_name: 'Hair Design',
        service_price: 40,
        scheduled_time: new Date(Date.now() + 259200000).toISOString(), // 3 days from now
        duration_minutes: 60,
        location: 'Cal Poly - North Mountain Dorms',
        status: 'pending',
        special_requests: 'Want lightning bolt design on the side',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '5',
        barber_id: '6',
        student_id: '5',
        service_id: '18',
        service_name: 'Traditional Cut',
        service_price: 24,
        scheduled_time: new Date(Date.now() + 345600000).toISOString(), // 4 days from now
        duration_minutes: 45,
        location: 'UCSB - Isla Vista',
        status: 'pending',
        special_requests: '',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      
      // Completed bookings (past)
      {
        id: '6',
        barber_id: '1',
        student_id: '2',
        service_id: '1',
        service_name: 'Classic Haircut',
        service_price: 20,
        scheduled_time: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
        duration_minutes: 30,
        location: 'Cal Poly Campus',
        status: 'completed',
        special_requests: '',
        created_at: new Date(Date.now() - 864000000).toISOString(),
      },
      {
        id: '7',
        barber_id: '4',
        student_id: '6',
        service_id: '11',
        service_name: 'Classic Haircut',
        service_price: 25,
        scheduled_time: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        duration_minutes: 40,
        location: 'UCSB - Student Center',
        status: 'completed',
        special_requests: '',
        created_at: new Date(Date.now() - 518400000).toISOString(),
      },
      {
        id: '8',
        barber_id: '5',
        student_id: '4',
        service_id: '17',
        service_name: 'Fresh Fade',
        service_price: 26,
        scheduled_time: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
        duration_minutes: 40,
        location: 'UCSB - Recreation Center',
        status: 'completed',
        special_requests: 'Clean fade for job interview',
        created_at: new Date(Date.now() - 1296000000).toISOString(),
      },
    ];

    bookings.forEach(booking => this.bookings.set(booking.id, booking));

    // Seed reviews - Comprehensive reviews for all barbers
    const reviews = [
      // Carlos Rodriguez (Barber 1) - Cal Poly
      {
        id: '1',
        booking_id: '6',
        barber_id: '1',
        student_id: '2',
        rating: 5,
        review_text: 'Carlos gave me the cleanest fade! Super professional and knows what Cal Poly students want. He worked around my schedule and the cut lasted 3+ weeks. Highly recommend!',
        created_at: new Date(Date.now() - 604800000).toISOString(),
      },
      {
        id: '2',
        booking_id: null,
        barber_id: '1',
        student_id: '1',
        rating: 5,
        review_text: 'Been going to Carlos for 6 months now. Consistent quality, great conversation, and he actually listens to what you want. Best barber at Cal Poly!',
        created_at: new Date(Date.now() - 2592000000).toISOString(),
      },
      {
        id: '3',
        booking_id: null,
        barber_id: '1',
        student_id: '3',
        rating: 4,
        review_text: 'Great fade work. Only downside is he can be a bit busy, so book ahead!',
        created_at: new Date(Date.now() - 5184000000).toISOString(),
      },
      
      // David Kim (Barber 2) - Cal Poly
      {
        id: '4',
        booking_id: null,
        barber_id: '2',
        student_id: '2',
        rating: 5,
        review_text: 'David is amazing with Asian hair! He gave me exactly the K-pop style I wanted. Very detail-oriented and professional.',
        created_at: new Date(Date.now() - 1209600000).toISOString(),
      },
      {
        id: '5',
        booking_id: null,
        barber_id: '2',
        student_id: '1',
        rating: 5,
        review_text: 'Finally found a barber who understands texture and layering. David is the real deal!',
        created_at: new Date(Date.now() - 3024000000).toISOString(),
      },
      
      // James Brown (Barber 3) - Cal Poly
      {
        id: '6',
        booking_id: null,
        barber_id: '3',
        student_id: '3',
        rating: 5,
        review_text: 'James is a master with afro-textured hair. The designs he does are incredible! Plus he\'s super chill and makes you feel welcome.',
        created_at: new Date(Date.now() - 864000000).toISOString(),
      },
      {
        id: '7',
        booking_id: null,
        barber_id: '3',
        student_id: '1',
        rating: 4,
        review_text: 'Really skilled barber. The lineup was perfect and he educated me on hair care. Will be back!',
        created_at: new Date(Date.now() - 4320000000).toISOString(),
      },
      
      // Marcus Williams (Barber 4) - UCSB
      {
        id: '8',
        booking_id: '7',
        barber_id: '4',
        student_id: '6',
        rating: 5,
        review_text: 'Marcus is the best! Perfect cut every time. He\'s been cutting hair for years and it shows. Worth every penny. All UCSB students should book with him!',
        created_at: new Date(Date.now() - 432000000).toISOString(),
      },
      {
        id: '9',
        booking_id: null,
        barber_id: '4',
        student_id: '4',
        rating: 5,
        review_text: 'UCSB legend! Marcus has been my barber for 2 years. Never disappoints. Book him ASAP!',
        created_at: new Date(Date.now() - 7776000000).toISOString(),
      },
      {
        id: '10',
        booking_id: null,
        barber_id: '4',
        student_id: '5',
        rating: 5,
        review_text: 'Professional, skilled, and always on time. Marcus is worth the price!',
        created_at: new Date(Date.now() - 2592000000).toISOString(),
      },
      
      // Tyler Jackson (Barber 5) - UCSB
      {
        id: '11',
        booking_id: '8',
        barber_id: '5',
        student_id: '4',
        rating: 5,
        review_text: 'Tyler is fast and efficient. Perfect for busy student athletes. Got me looking fresh for my interview!',
        created_at: new Date(Date.now() - 1209600000).toISOString(),
      },
      {
        id: '12',
        booking_id: null,
        barber_id: '5',
        student_id: '5',
        rating: 4,
        review_text: 'Quick service and good quality. Great for when you need a cut between classes.',
        created_at: new Date(Date.now() - 5184000000).toISOString(),
      },
      
      // Antonio Lopez (Barber 6) - UCSB
      {
        id: '13',
        booking_id: null,
        barber_id: '6',
        student_id: '6',
        rating: 5,
        review_text: 'Antonio brings that traditional barbershop vibe. The hot towel shave was incredible! Such a relaxing experience.',
        created_at: new Date(Date.now() - 1728000000).toISOString(),
      },
      {
        id: '14',
        booking_id: null,
        barber_id: '6',
        student_id: '4',
        rating: 5,
        review_text: 'Best traditional barber at UCSB. Antonio takes his time and makes sure everything is perfect. Highly recommend!',
        created_at: new Date(Date.now() - 3456000000).toISOString(),
      },
      {
        id: '15',
        booking_id: null,
        barber_id: '6',
        student_id: '5',
        rating: 4,
        review_text: 'Great classic cuts. Antonio knows his craft. The only downside is you need to make an appointment in advance.',
        created_at: new Date(Date.now() - 6048000000).toISOString(),
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
    
    // Enrich barbers with user data, portfolio, and other nested info
    return barbers.map(barber => ({
      ...barber,
      user: this.users.get(barber.user_id),
      portfolio_images: barber.portfolio_images || [],
      pricing: barber.pricing || [],
    }));
  }

  async findBarberById(id: string): Promise<any | null> {
    const barber = this.barbers.get(id);
    if (!barber) return null;
    
    // Return barber with enriched data
    return {
      ...barber,
      user: this.users.get(barber.user_id),
      portfolio_images: barber.portfolio_images || [],
      pricing: barber.pricing || [],
    };
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

  async findBookingsByUser(userId: string, userType: 'student' | 'barber'): Promise<any[]> {
    const bookings = Array.from(this.bookings.values());
    let filtered;
    
    if (userType === 'student') {
      filtered = bookings.filter(b => b.student_id === userId);
    } else {
      filtered = bookings.filter(b => b.barber_id === userId);
    }
    
    // Enrich bookings with student and barber data
    return filtered.map(booking => ({
      ...booking,
      student: booking.student_id ? this.users.get(booking.student_id) : null,
      barber: booking.barber_id ? this.barbers.get(booking.barber_id) : null,
    }));
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
    const barberReviews = Array.from(this.reviews.values()).filter(r => r.barber_id === barberId);
    
    // Enrich reviews with student data
    return barberReviews.map(review => ({
      ...review,
      student: this.users.get(review.student_id),
    }));
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

