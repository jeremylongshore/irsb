/**
 * x402 Express Service Example
 *
 * Demonstrates integration of x402 HTTP Payment Protocol with IRSB receipts.
 */

import express from 'express';
import { config } from 'dotenv';
import { generateRouter } from './routes/generate.js';

// Load environment variables
config();

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Service info
app.get('/', (_req, res) => {
  res.json({
    service: 'x402-irsb-example',
    version: '0.1.0',
    endpoints: [
      {
        path: '/api/generate',
        method: 'POST',
        description: 'AI generation endpoint (requires x402 payment)',
        price: process.env.PRICE_WEI || '1000000000000000',
        asset: process.env.PAYMENT_ASSET || 'ETH',
      },
    ],
    documentation: 'https://github.com/intentsolutions/irsb-protocol',
  });
});

// API routes with x402 protection
app.use('/api', generateRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                  x402 + IRSB Example Service                      ║
╠═══════════════════════════════════════════════════════════════════╣
║  Server:    http://${HOST}:${PORT}
║  Chain:     ${process.env.CHAIN_ID || '11155111'} (${process.env.CHAIN_ID === '1' ? 'Mainnet' : 'Sepolia'})
║  Price:     ${process.env.PRICE_WEI || '1000000000000000'} wei per request
║
║  Endpoints:
║    GET  /           Service info
║    GET  /health     Health check
║    POST /api/generate   AI generation (requires x402 payment)
╚═══════════════════════════════════════════════════════════════════╝
  `);
});

export default app;
