import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { blockchainService } from './services/blockchain.service';

// Routes
import authRoutes from './routes/auth.routes';
import merchantRoutes from './routes/merchant.routes';
import linksRoutes from './routes/links.routes';
import invoiceRoutes from './routes/invoice.routes';
import webhookRoutes from './routes/webhook.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/webhooks', webhookRoutes);

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

    // Start blockchain monitoring
    console.log('🔍 Starting blockchain monitoring...');
    blockchainService.startMonitoring();

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
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('⏹️  SIGTERM received, shutting down gracefully...');
      blockchainService.stopMonitoring();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('⏹️  SIGINT received, shutting down gracefully...');
      blockchainService.stopMonitoring();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
