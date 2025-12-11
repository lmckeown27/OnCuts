/**
 * Admin Users Controller
 * 
 * Handles admin operations on user accounts
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Mock user database for demo purposes
 * In production, this would query PostgreSQL or blockchain
 */
const mockUsers: Record<string, any> = {};

// Initialize some mock users
const initMockUsers = () => {
  // Cal Poly Barbers
  mockUsers['user-marcus-thompson'] = {
    id: 'user-marcus-thompson',
    name: 'Marcus Thompson',
    email: 'marcus.thompson@calpoly.edu',
    phone: '+1 (805) 555-0123',
    role: 'barber',
    wallet_address: '0xB001234567890abcdef1234567890abcdef12345',
    status: 'active',
    is_verified: true,
    created_at: '2024-01-15T10:00:00Z',
    last_login: '2024-12-11T09:30:00Z',
    total_bookings: 156,
    total_earned: 5460.00,
    average_rating: 4.9,
    specialties: ['Fades', 'Curly Hair', 'Beard Grooming'],
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  };

  mockUsers['user-jordan-williams'] = {
    id: 'user-jordan-williams',
    name: 'Jordan Williams',
    email: 'jordan.williams@calpoly.edu',
    phone: '+1 (805) 555-0124',
    role: 'barber',
    wallet_address: '0xB002234567890abcdef1234567890abcdef12345',
    status: 'active',
    is_verified: true,
    created_at: '2024-02-10T10:00:00Z',
    last_login: '2024-12-10T15:20:00Z',
    total_bookings: 132,
    total_earned: 4620.00,
    average_rating: 4.8,
    specialties: ['Line-ups', 'Buzz Cuts', 'Fades'],
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  };

  // Students
  mockUsers['user-alice-smith'] = {
    id: 'user-alice-smith',
    name: 'Alice Smith',
    email: 'alice.smith@calpoly.edu',
    phone: '+1 (805) 555-1001',
    role: 'student',
    wallet_address: '0xS001234567890abcdef1234567890abcdef12345',
    status: 'active',
    is_verified: true,
    created_at: '2024-03-01T10:00:00Z',
    last_login: '2024-12-11T08:15:00Z',
    total_bookings: 12,
    total_spent: 420.00,
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  };

  mockUsers['user-bob-johnson'] = {
    id: 'user-bob-johnson',
    name: 'Bob Johnson',
    email: 'bob.johnson@calpoly.edu',
    phone: '+1 (805) 555-1002',
    role: 'student',
    wallet_address: '0xS002234567890abcdef1234567890abcdef12345',
    status: 'active',
    is_verified: true,
    created_at: '2024-03-15T10:00:00Z',
    last_login: '2024-12-10T19:30:00Z',
    total_bookings: 8,
    total_spent: 280.00,
    campus: 'California Polytechnic State University',
    admin_notes: [],
    flags: [],
  };
};

initMockUsers();

/**
 * GET /api/admin/users/:userId
 * Get user details
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    logger.info(`Fetching user details for ${userId}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate mock activity logs
    const activityLogs = [
      {
        id: 'act-1',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        action: 'Login',
        details: 'Logged in from 128.61.x.x',
      },
      {
        id: 'act-2',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        action: user.role === 'barber' ? 'Booking Completed' : 'Booking Created',
        details: user.role === 'barber' ? 'Completed booking #BK-1234' : 'Created booking #BK-1234',
      },
      {
        id: 'act-3',
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        action: user.role === 'barber' ? 'Payment Received' : 'Payment Sent',
        details: user.role === 'barber' ? 'Received $35 for booking #BK-1233' : 'Paid $35 for booking #BK-1233',
      },
    ];

    // Generate mock transactions
    const transactions = user.role === 'barber' ? [
      {
        id: 'tx-1',
        type: 'Payment Received',
        amount: 35.00,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        counterparty: 'Alice Smith',
      },
      {
        id: 'tx-2',
        type: 'Payment Received',
        amount: 35.00,
        date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        counterparty: 'Bob Johnson',
      },
      {
        id: 'tx-3',
        type: 'Withdrawal',
        amount: -200.00,
        date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        counterparty: 'Bank Account ****1234',
      },
    ] : [
      {
        id: 'tx-1',
        type: 'Payment Sent',
        amount: -35.00,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        counterparty: 'Marcus Thompson',
      },
      {
        id: 'tx-2',
        type: 'Payment Sent',
        amount: -35.00,
        date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        counterparty: 'Jordan Williams',
      },
    ];

    res.json({
      success: true,
      user,
      activityLogs,
      transactions,
    });
  } catch (error: any) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * PUT /api/admin/users/:userId/status
 * Update user status (active, blocked, banned, suspended)
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    logger.info(`Updating status for ${userId} to ${status}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!['active', 'blocked', 'banned', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    user.status = status;

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    logger.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * PUT /api/admin/users/:userId/verification
 * Toggle user verification status
 */
export const toggleVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    logger.info(`Toggling verification for ${userId}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.is_verified = !user.is_verified;

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    logger.error('Error toggling verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * POST /api/admin/users/:userId/notes
 * Add admin note to user
 */
export const addAdminNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { note } = req.body;

    logger.info(`Adding note to ${userId}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note cannot be empty',
      });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const formattedNote = `${note} - ${timestamp}`;
    user.admin_notes.unshift(formattedNote);

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    logger.error('Error adding admin note:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * POST /api/admin/users/:userId/reset-password
 * Send password reset email to user
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    logger.info(`Sending password reset for ${userId}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // In production: send actual password reset email
    logger.info(`Password reset email sent to ${user.email}`);

    res.json({
      success: true,
      message: `Password reset email sent to ${user.email}`,
    });
  } catch (error: any) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * DELETE /api/admin/users/:userId
 * Delete user account (dangerous operation)
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    logger.warn(`DELETING user ${userId}`);

    const user = mockUsers[userId];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // In production: soft-delete or archive user data
    delete mockUsers[userId];

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

