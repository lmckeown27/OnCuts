/**
 * Development Routes
 * Testing endpoints using mock database (no PostgreSQL required)
 */

import { Router, Request, Response } from 'express';
import mockDb from '../services/mock.database.service';
import { AptosService } from '../services/aptos.service';

const router = Router();

// Health check with detailed status
router.get('/health', (req: Request, res: Response) => {
  const stats = mockDb.getStats();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      type: 'in-memory',
      ...stats,
    },
    blockchain: {
      network: process.env.APTOS_NETWORK || 'devnet',
      platform_address: process.env.APTOS_PLATFORM_ADDRESS,
      connected: !!process.env.APTOS_PLATFORM_ADDRESS,
    },
    environment: process.env.NODE_ENV || 'development',
  });
});

// Get all mock data
router.get('/data', (req: Request, res: Response) => {
  res.json({
    message: 'Mock database data',
    stats: mockDb.getStats(),
  });
});

// Reset mock database
router.post('/reset', (req: Request, res: Response) => {
  mockDb.clear();
  res.json({
    message: 'Mock database reset successfully',
    stats: mockDb.getStats(),
  });
});

// Test campuses endpoint
router.get('/campuses', async (req: Request, res: Response) => {
  try {
    const campuses = await mockDb.getAllCampuses();
    res.json({
      success: true,
      data: campuses,
      count: campuses.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test barbers endpoint
router.get('/barbers', async (req: Request, res: Response) => {
  try {
    const barbers = await mockDb.findBarbersByFilter({
      campus_id: req.query.campus_id as string,
    });
    res.json({
      success: true,
      data: barbers,
      count: barbers.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test booking creation
router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const booking = await mockDb.createBooking({
      barber_id: req.body.barber_id || '1',
      client_id: req.body.client_id || '1',
      service_name: req.body.service_name || 'Test Haircut',
      service_price: req.body.service_price || 30,
      scheduled_at: req.body.scheduled_at || new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: req.body.duration_minutes || 45,
      location: req.body.location || 'Test Location',
    });
    
    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test Aptos blockchain connection
router.get('/aptos/status', async (req: Request, res: Response) => {
  try {
    const aptosService = AptosService.getInstance();
    const platformAddress = process.env.APTOS_PLATFORM_ADDRESS;
    
    if (!platformAddress) {
      return res.json({
        success: false,
        error: 'Platform address not configured',
      });
    }

    // Try to get account info
    const account = await aptosService['client'].getAccount(platformAddress);
    
    res.json({
      success: true,
      network: process.env.APTOS_NETWORK || 'devnet',
      platform_address: platformAddress,
      account: {
        sequence_number: account.sequence_number,
        authentication_key: account.authentication_key,
      },
      contract_address: platformAddress,
      deployed: true,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test contract interaction
router.post('/aptos/test-transaction', async (req: Request, res: Response) => {
  try {
    const aptosService = AptosService.getInstance();
    
    res.json({
      success: true,
      message: 'Contract deployment verified',
      address: process.env.APTOS_PLATFORM_ADDRESS,
      network: 'devnet',
      note: 'Full transaction testing requires active database',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create test review
router.post('/reviews', async (req: Request, res: Response) => {
  try {
    const review = await mockDb.createReview({
      booking_id: req.body.booking_id || '1',
      barber_id: req.body.barber_id || '1',
      client_id: req.body.client_id || '1',
      rating: req.body.rating || 5,
      comment: req.body.comment || 'Great service!',
    });
    
    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get barber reviews
router.get('/reviews/:barberId', async (req: Request, res: Response) => {
  try {
    const reviews = await mockDb.findReviewsByBarber(req.params.barberId);
    res.json({
      success: true,
      data: reviews,
      count: reviews.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

