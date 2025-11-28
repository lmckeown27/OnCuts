import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pool } from './database/connection';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { connectRedis } from './config/redis';
import rateLimit from 'express-rate-limit';

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

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
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

logger.info('✅ V2 routes enabled:');
logger.info('   - /api/v2/bookings (escrow-based)');
logger.info('   - /api/v2/wallet (production wallet)');
logger.info('   - /api/admin (platform management)');

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
httpServer.listen(PORT, () => {
  logger.info(`🚀 CampusCuts API server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Aptos Network: ${process.env.APTOS_NETWORK || 'devnet'}`);
  logger.info(`💬 Socket.IO ready for real-time messaging`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing servers');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    io.close(() => {
      logger.info('Socket.IO server closed');
      pool.end(() => {
        logger.info('Database pool closed');
        process.exit(0);
      });
    });
  });
});

export default app;

