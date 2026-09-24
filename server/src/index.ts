// Must come first: imports below read process.env at module load, and ES
// import hoisting would otherwise run them before the .env file is read.
import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase } from './config/database';
import { blockchainService } from './services/blockchain.service';
import { webhookService } from './services/webhook.service';
import { sweepService } from './services/sweep.service';
import { walletService } from './services/wallet.service';
import { FEE_SCHEDULES } from './services/fee.service';

// Routes
import authRoutes from './routes/auth.routes';
import merchantRoutes from './routes/merchant.routes';
import linksRoutes from './routes/links.routes';
import invoiceRoutes from './routes/invoice.routes';
import webhookRoutes from './routes/webhook.routes';
import escrowRoutes from './routes/escrow.routes';
import accountRoutes from './routes/account.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Comma-separated list, so a deployed frontend and local dev can coexist.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin/server-to-server requests send no Origin header; the public
    // checkout API is also consumed by merchant backends.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'GuardPay API',
  });
});

// Public fee schedule — one source of truth for pricing pages and clients.
app.get('/api/fees', (req: Request, res: Response) => {
  res.json(
    Object.fromEntries(
      (['merchant', 'p2p', 'escrow'] as const).map((context) => {
        const s = FEE_SCHEDULES[context];
        return [
          context,
          { bps: s.bps, percent: s.bps / 100, flat: s.flat, min: s.min, max: s.max, paidBy: s.paidBy },
        ];
      })
    )
  );
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/escrows', escrowRoutes);
app.use('/api/account', accountRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('🔧 Initializing database...');
    initializeDatabase();

    // Upgrade any key material written before encryption-at-rest existed.
    walletService.migrateStoredSecrets();

    // Start background workers
    console.log('🔍 Starting blockchain monitoring...');
    blockchainService.startMonitoring();
    webhookService.startDispatcher();
    sweepService.start();

    // Start server
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║     🚀 GuardPay Server Running         ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('');
      console.log(`📡 Server:    http://localhost:${PORT}`);
      console.log(`🏥 Health:    http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  POST   /api/auth/nonce');
      console.log('  POST   /api/auth/verify');
      console.log('  GET    /api/merchant/profile');
      console.log('  GET    /api/links');
      console.log('  POST   /api/links');
      console.log('  POST   /api/invoices');
      console.log('  GET    /api/invoices/:id');
      console.log('  GET    /api/webhooks');
      console.log('  GET    /api/escrows');
      console.log('  POST   /api/escrows');
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('⏹️  SIGTERM received, shutting down gracefully...');
      blockchainService.stopMonitoring();
      webhookService.stopDispatcher();
      sweepService.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('⏹️  SIGINT received, shutting down gracefully...');
      blockchainService.stopMonitoring();
      webhookService.stopDispatcher();
      sweepService.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
