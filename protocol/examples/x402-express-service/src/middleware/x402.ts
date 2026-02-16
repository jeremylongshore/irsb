/**
 * x402 Payment Middleware
 *
 * Middleware that enforces payment for protected endpoints.
 * Returns HTTP 402 Payment Required if payment is missing or invalid.
 */

import { Request, Response, NextFunction } from 'express';
import { verifyPayment, PaymentProof } from '../services/paymentVerifier.js';

export interface X402Config {
  priceWei: string;
  asset: string;
  chainId: number;
  serviceDomain: string;
  /** Service wallet address for receiving payments */
  serviceWallet?: string;
  /** Skip on-chain verification (for testing) */
  skipVerification?: boolean;
}

export interface X402Request extends Request {
  paymentProof?: PaymentProof;
}

/**
 * Create x402 payment middleware.
 *
 * @param config - Payment configuration
 * @returns Express middleware function
 */
export function x402Middleware(config: X402Config) {
  return async (req: X402Request, res: Response, next: NextFunction) => {
    // Check for payment proof in header
    const paymentHeader = req.headers['x-payment-proof'] as string | undefined;

    if (!paymentHeader) {
      // Return 402 Payment Required
      return res.status(402).json({
        error: 'Payment Required',
        message: 'This endpoint requires payment. Include X-Payment-Proof header.',
        payment: {
          asset: config.asset,
          amount: config.priceWei,
          chainId: config.chainId,
          recipient: config.serviceWallet || process.env.SERVICE_SOLVER_ID,
          methods: ['native-transfer', 'erc20-transfer'],
        },
        instructions: {
          header: 'X-Payment-Proof',
          format: 'JSON object with paymentRef and signature',
          example: {
            paymentRef: '0x...transaction-hash...',
            payer: '0x...payer-address...',
            signature: '0x...eip712-signature...',
          },
        },
      });
    }

    try {
      // Parse payment proof
      const paymentProof = JSON.parse(paymentHeader) as PaymentProof;

      // Verify the payment
      const verificationResult = await verifyPayment(paymentProof, {
        expectedAmount: config.priceWei,
        expectedAsset: config.asset,
        expectedChainId: config.chainId,
        expectedRecipient: config.serviceWallet,
        skipOnChain: config.skipVerification,
      });

      if (!verificationResult.valid) {
        return res.status(402).json({
          error: 'Payment Invalid',
          message: verificationResult.reason,
          payment: {
            asset: config.asset,
            amount: config.priceWei,
            chainId: config.chainId,
          },
        });
      }

      // Attach payment proof to request for receipt generation
      req.paymentProof = paymentProof;
      next();
    } catch (err) {
      return res.status(402).json({
        error: 'Payment Malformed',
        message: 'Could not parse X-Payment-Proof header as JSON',
      });
    }
  };
}

/**
 * Get x402 config from environment.
 */
export function getX402Config(): X402Config {
  return {
    priceWei: process.env.PRICE_WEI || '1000000000000000',
    asset: process.env.PAYMENT_ASSET || 'ETH',
    chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
    serviceDomain: process.env.SERVICE_DOMAIN || 'api.example.com',
    serviceWallet: process.env.SERVICE_WALLET,
    skipVerification: process.env.SKIP_PAYMENT_VERIFICATION === 'true',
  };
}
