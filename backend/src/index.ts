import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { connectRedis } from './config/redis';
import rateLimit from 'express-rate-limit';

// PostgreSQL Cache Layer (Hybrid Architecture)
import { pool, checkHealth as checkPostgresHealth, closePool, connectToPostgres } from './database/connection';

// Import routes
import authRoutes from './routes/auth.routes';
import barberRoutes from './routes/barber.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import reviewRoutes from './routes/review.routes';
import campusRoutes from './routes/campus.routes';
import messageRoutes from './routes/message.routes';
import notificationRoutes from './routes/notification.routes';
import uploadRoutes from './routes/upload.routes';
import walletRoutes from './routes/wallet.routes';
import devRoutes from './routes/dev.routes';

// V2 Routes (Production custodial wallet system)
import bookingV2Routes from './routes/booking-v2.routes';
import walletV2Routes from './routes/wallet-v2.routes';
import adminRoutes from './routes/admin.routes';

// Stripe Integration Routes
import webhookRoutes from './routes/webhook.routes';
import bookingPaymentRoutes from './routes/booking-payment.routes';
import barberConnectRoutes from './routes/barber-connect.routes';

// Live Transaction Feed Routes
import liveFeedRoutes from './routes/live-feed.routes';

// Gas Wallet Management Routes
import gasWalletRoutes from './routes/gas-wallet.routes';

// Dynamic Pricing Routes
import pricingRoutes from './routes/pricing.routes';

// User Management Routes
import userRoutes from './routes/user.routes';

// Admin Transaction Monitoring Routes
import adminTransactionsRoutes from './routes/admin-transactions.routes';

// Admin User Management Routes
import adminUsersRoutes from './routes/admin-users.routes';

// AI Routes (Integrated AI Worker)
import aiRoutes from './routes/ai.routes';

// System Health Routes
import systemHealthRoutes from './routes/system-health.routes';

// Gas Wallet Monitoring Routes (Admin)
import gasMonitorRoutes from './routes/gas-wallet.routes';

// Marketplace Engine Routes (Capitalistic)
import marketplaceRoutes from './routes/marketplace.routes';
import { marketplaceCronService } from './services/marketplace-cron.service';

// Blockchain-First Routes (Decentralized)
import authBlockchainRoutes from './routes/auth-blockchain.routes';
import bookingBlockchainRoutes from './routes/booking-blockchain.routes';
import reviewBlockchainRoutes from './routes/review-blockchain.routes';
import fiatBridgeRoutes from './routes/fiat-bridge.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://campuscuts.app',
  'https://www.campuscuts.app',
  'https://api.campuscuts.app',
];

// Socket.IO setup for real-time messaging
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn('🚫 Socket.IO CORS: Blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Socket.IO: User connected:', socket.id);

  // Join user to their personal room for direct messages
  socket.on('join-personal', (userId: number) => {
    socket.join(`user-${userId}`);
    console.log(`📬 Socket.IO: User ${socket.id} joined personal room: user-${userId}`);
    socket.emit('joined-personal', { userId, socketId: socket.id });
  });

  // Join user to their campus room for campus-wide updates
  socket.on('join-campus', (campusId: number) => {
    socket.join(`campus-${campusId}`);
    console.log(`🏫 Socket.IO: User ${socket.id} joined campus room: campus-${campusId}`);
  });

  // Join admin to live transaction feed room (admin dashboard)
  socket.on('join-admin-live-feed', (userId: number) => {
    // TODO: Verify user is admin before allowing join
    socket.join('admin-live-feed');
    console.log(`👑 Socket.IO: Admin ${socket.id} joined live feed room`);
    socket.emit('joined-admin-live-feed', { userId, socketId: socket.id });
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO: User disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('🔴 Socket.IO: Socket error:', error);
  });
});

console.log('✅ Socket.IO server initialized');

// Make Socket.IO available to routes
app.set('io', io);

// Connect to Redis
connectRedis();

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// IMPORTANT: Webhook routes MUST come BEFORE express.json()
// Stripe requires raw body to verify webhook signatures
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Then apply JSON parsing for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Health check (Hybrid Architecture - checks Blockchain + PostgreSQL cache)
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check PostgreSQL cache layer
    const pgHealth = await checkPostgresHealth();
    
    // Check Aptos blockchain connection
    const blockchainQuery = await import('./services/blockchain-query.service');
    let blockchainStatus = 'connected';
    let stats = null;
    
    try {
      stats = await blockchainQuery.default.getPlatformStats();
    } catch {
      blockchainStatus = 'degraded';
    }
    
    const overallStatus = pgHealth.healthy && blockchainStatus === 'connected' 
      ? 'healthy' 
      : pgHealth.healthy 
        ? 'degraded' 
        : 'unhealthy';
    
    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      architecture: 'hybrid',
      layers: {
        blockchain: {
          status: blockchainStatus,
          provider: 'aptos',
          storage: 'ipfs',
        },
        cache: {
          status: pgHealth.healthy ? 'connected' : 'disconnected',
          provider: 'postgresql',
          pool: pgHealth.pool,
        },
      },
      stats: stats ? {
        total_users: stats.totalUsers,
        total_bookings: stats.totalBookings,
      } : null,
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// API Routes (V1 - kept for backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/barber', barberConnectRoutes);  // Stripe Connect for barbers
app.use('/api/bookings', bookingPaymentRoutes);  // Enhanced with Stripe payments
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wallet', walletRoutes);  // V1

// V2 Routes (Production custodial wallet system)
app.use('/api/v2/bookings', bookingV2Routes);
app.use('/api/v2/wallet', walletV2Routes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/live-feed', liveFeedRoutes);  // Live transaction monitoring
app.use('/api/admin/transactions', adminTransactionsRoutes);  // Transaction history
app.use('/api/admin/users', adminUsersRoutes);  // User management (block, ban, etc.)
app.use('/api/gas', gasWalletRoutes);  // Gas wallet management

// Dynamic Pricing Routes
app.use('/api/pricing', pricingRoutes);  // Dynamic pricing engine

// User Management Routes
app.use('/api/users', userRoutes);  // User profile management

// AI-powered features (integrated AI Worker)
app.use('/api/ai', aiRoutes);  // AI pricing, quality scores, fraud detection, disputes

// System health monitoring
app.use('/api/system', systemHealthRoutes);  // System health and database status

// Gas wallet monitoring (Admin)
app.use('/api/gas', gasMonitorRoutes);  // Gas wallet balance and usage monitoring

// Marketplace Engine (Capitalistic)
app.use('/api/marketplace', marketplaceRoutes);  // BQS, dynamic pricing, rankings, surge

// Blockchain-First Routes (Decentralized - NEW!)
app.use('/api/auth-blockchain', authBlockchainRoutes);  // Custodial auth + on-chain user accounts
app.use('/api/bookings-blockchain', bookingBlockchainRoutes);  // Smart contract escrow bookings
app.use('/api/reviews-blockchain', reviewBlockchainRoutes);  // Immutable on-chain reviews + IPFS text
app.use('/api/fiat-bridge', fiatBridgeRoutes);  // Fiat ↔ Blockchain bridge (Stripe integration)

logger.info('✅ V2 routes enabled:');
logger.info('   - /api/v2/bookings (escrow-based)');
logger.info('   - /api/v2/wallet (production wallet)');
logger.info('   - /api/admin (platform management)');
logger.info('   - /api/admin/live-feed (real-time monitoring)');
logger.info('   - /api/admin/transactions (transaction history)');
logger.info('   - /api/gas (gas wallet & top-up management)');
logger.info('   - /api/pricing (dynamic pricing engine)');

logger.info('🌐 Blockchain-first routes enabled:');
logger.info('   - /api/auth-blockchain (custodial auth + IPFS profiles)');
logger.info('   - /api/bookings-blockchain (smart contract escrow)');
logger.info('   - /api/reviews-blockchain (immutable reviews + IPFS text)');
logger.info('   - /api/fiat-bridge (Stripe → Blockchain deposits & withdrawals)');

// Development routes (mock database testing)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devRoutes);
  logger.info('🧪 Development routes enabled at /api/dev');
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Start server
httpServer.listen(PORT, async () => {
  logger.info(`🚀 CampusCuts API server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Aptos Network: ${process.env.APTOS_NETWORK || 'devnet'}`);
  logger.info(`💬 Socket.IO ready for real-time messaging`);

  // Initialize PostgreSQL cache connection
  try {
    await connectToPostgres();
    logger.info(`✅ PostgreSQL cache layer ready`);
  } catch (error: any) {
    logger.error(`❌ PostgreSQL cache unavailable (app will use blockchain fallback)`, {
      error: error.message,
    });
  }

  // Start Aptos blockchain monitor for live transaction feed
  if (process.env.APTOS_PLATFORM_ADDRESS) {
    const aptosMonitorService = (await import('./services/aptos-monitor.service')).default;
    await aptosMonitorService.start();
    logger.info(`Aptos blockchain monitor started`);
  } else {
    logger.warn('Aptos monitor not started - APTOS_PLATFORM_ADDRESS not configured');
  }

  // Start comprehensive gas wallet monitoring (every 15 min + alerts)
  const { gasWalletCron } = await import('./services/gas-wallet-cron.service');
  gasWalletCron.start();
  logger.info(`Gas wallet monitoring started (checks every 15 min, alerts when low)`);

  // Start marketplace cron jobs (BQS, pricing, rankings, surge)
  marketplaceCronService.startAllJobs();
  logger.info(`Marketplace cron jobs started (nightly: 2am, surge: every 15 min)`);

  // Start blockchain → PostgreSQL sync (hourly)
  // This keeps PostgreSQL cache up-to-date with blockchain data
  const blockchainSyncCronService = (await import('./services/blockchain-sync-cron.service')).default;
  blockchainSyncCronService.start();
  logger.info(`Blockchain sync cron job started (hourly sync)`);

  // Start pricing cron jobs (daily recompute, hourly metrics, weekly market update)
  // TEMPORARILY DISABLED: Requires PostgreSQL database to be properly configured
  // Uncomment when PostgreSQL is set up with correct DATABASE_URL
  // const pricingCronService = (await import('./services/pricing/pricing-cron.service')).default;
  // pricingCronService.start();
  logger.info(`⏸️  Pricing cron jobs disabled (enable when PostgreSQL is configured)`);
});

// Graceful shutdown (Hybrid Architecture - close PostgreSQL pool + servers)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing servers and database connections');
  
  try {
    // Close HTTP server
    await new Promise((resolve) => {
      httpServer.close(() => {
        logger.info('HTTP server closed');
        resolve(true);
      });
    });
    
    // Close Socket.IO
    await new Promise((resolve) => {
      io.close(() => {
        logger.info('Socket.IO server closed');
        resolve(true);
      });
    });
    
    // Close PostgreSQL pool
    await closePool();
    logger.info('PostgreSQL pool closed');
    
    logger.info('✅ All services shut down gracefully (hybrid architecture)');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing servers and database connections');
  
  try {
    await closePool();
    logger.info('PostgreSQL pool closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Export Socket.IO instance for use in services
export { io };

export default app;

