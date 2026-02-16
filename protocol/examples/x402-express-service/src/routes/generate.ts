/**
 * Generate Endpoint
 *
 * Example paid endpoint that demonstrates x402 → IRSB flow.
 */

import { Router, Response } from 'express';
import { x402Middleware, getX402Config, X402Request } from '../middleware/x402.js';
import {
  generateReceipt,
  formatReceiptForResponse,
  postReceiptOnChain,
  isServerPostingEnabled,
} from '../services/irsbReceipt.js';

export const generateRouter = Router();

// Apply x402 middleware to protect the endpoint
const x402Config = getX402Config();
generateRouter.use('/generate', x402Middleware(x402Config));

/**
 * POST /api/generate
 *
 * Example AI generation endpoint protected by x402 payment.
 *
 * Request:
 * - Headers: X-Payment-Proof (required)
 * - Body: { prompt: string }
 *
 * Response:
 * - 200: { result, receipt, requestId }
 * - 402: Payment Required
 * - 500: Server Error
 */
generateRouter.post('/generate', async (req: X402Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt?: string };

    if (!prompt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: prompt',
      });
    }

    // Simulate AI generation (in production, call your actual AI service)
    console.log(`[Generate] Processing prompt: "${prompt.slice(0, 50)}..."`);
    const generatedResult = await simulateAIGeneration(prompt);

    // Generate IRSB receipt
    const receiptResult = await generateReceipt({
      paymentProof: req.paymentProof!,
      endpoint: '/api/generate',
      resultData: generatedResult,
      priceWei: x402Config.priceWei,
      asset: x402Config.asset,
    });

    console.log(`[Generate] Complete. RequestID: ${receiptResult.requestId}`);

    // Optionally post receipt on-chain (if enabled)
    let postResult = null;
    if (isServerPostingEnabled()) {
      try {
        postResult = await postReceiptOnChain(receiptResult.receipt);
        console.log(`[Generate] Receipt posted on-chain: ${postResult.receiptId}`);
      } catch (postError) {
        console.error('[Generate] Failed to post receipt on-chain:', postError);
        // Continue without posting - client can still post
      }
    }

    // Return result with receipt
    return res.status(200).json({
      success: true,
      result: generatedResult,
      ...formatReceiptForResponse(receiptResult),
      // Include on-chain posting result if available
      ...(postResult && {
        posted: {
          receiptId: postResult.receiptId,
          txHash: postResult.txHash,
          blockNumber: postResult.blockNumber,
          explorerUrl: postResult.explorerUrl,
        },
      }),
      instructions: postResult
        ? {
            status: 'Receipt already posted on-chain by service',
            receiptId: postResult.receiptId,
          }
        : {
            clientAttestation:
              'To complete dual attestation, sign the signingPayload with your wallet using EIP-712 signTypedData',
            posting:
              'Submit the receipt to IRSB IntentReceiptHub.postReceiptV2() to record on-chain',
          },
    });
  } catch (err) {
    console.error('[Generate] Error:', err);
    return res.status(500).json({
      error: 'Generation Failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/generate/price
 *
 * Returns current pricing info (no payment required).
 */
generateRouter.get('/generate/price', (_req, res) => {
  res.json({
    price: {
      amount: x402Config.priceWei,
      asset: x402Config.asset,
      chainId: x402Config.chainId,
    },
    paymentMethods: ['native-transfer', 'erc20-transfer'],
    description: 'Price per generation request',
  });
});

/**
 * Simulate AI generation.
 *
 * In production, replace with actual AI service call.
 */
async function simulateAIGeneration(prompt: string): Promise<object> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    model: 'example-ai-v1',
    prompt: prompt,
    generated: `This is a simulated AI response to: "${prompt.slice(0, 100)}"`,
    tokens: {
      input: prompt.length,
      output: 150,
    },
    timestamp: new Date().toISOString(),
  };
}
