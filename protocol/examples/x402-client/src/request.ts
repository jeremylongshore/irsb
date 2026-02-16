/**
 * x402 Request Flow Module
 *
 * Handles the HTTP 402 payment flow:
 * 1. Make initial request → receive 402 with payment terms
 * 2. Execute payment on-chain
 * 3. Retry request with payment proof
 */

export interface ServiceTerms {
  /** Price in wei */
  amount: string;
  /** Asset (ETH, USDC, etc.) */
  asset: string;
  /** Chain ID */
  chainId: number;
  /** Recipient wallet */
  recipient?: string;
}

export interface PaymentProof {
  /** Transaction hash */
  paymentRef: string;
  /** Payer address */
  payer: string;
  /** Timestamp */
  timestamp: number;
}

export interface X402Response<T> {
  /** Whether the request succeeded */
  success: boolean;
  /** Result data (if successful) */
  result?: T;
  /** Request ID for tracking */
  requestId?: string;
  /** The receipt (solver-signed) */
  receipt?: Record<string, unknown>;
  /** EIP-712 signing payload for client attestation */
  signingPayload?: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
  };
  /** Instructions for completing dual attestation */
  instructions?: Record<string, unknown>;
}

export interface RequestOptions {
  /** Request body */
  body?: Record<string, unknown>;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Make an initial request to get payment terms.
 *
 * @param serviceUrl - Base URL of the x402 service
 * @param endpoint - API endpoint path
 * @param options - Request options
 * @returns Payment terms from 402 response, or null if no payment required
 */
export async function getPaymentTerms(
  serviceUrl: string,
  endpoint: string,
  options: RequestOptions = {}
): Promise<ServiceTerms | null> {
  const url = `${serviceUrl}${endpoint}`;

  console.log(`[Request] Requesting ${url}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(options.body ?? {}),
    signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
  });

  if (response.status === 402) {
    const data = await response.json();
    console.log(`[Request] Payment required:`, data.payment);

    return {
      amount: data.payment.amount,
      asset: data.payment.asset,
      chainId: data.payment.chainId,
      recipient: data.payment.recipient,
    };
  }

  if (response.ok) {
    console.log(`[Request] No payment required (got ${response.status})`);
    return null;
  }

  throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
}

/**
 * Retry request with payment proof.
 *
 * @param serviceUrl - Base URL of the x402 service
 * @param endpoint - API endpoint path
 * @param proof - Payment proof with transaction hash
 * @param options - Request options
 * @returns Service response with receipt
 */
export async function requestWithProof<T>(
  serviceUrl: string,
  endpoint: string,
  proof: PaymentProof,
  options: RequestOptions = {}
): Promise<X402Response<T>> {
  const url = `${serviceUrl}${endpoint}`;

  console.log(`[Request] Retrying with payment proof...`);
  console.log(`[Request] Payment ref: ${proof.paymentRef}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Proof': JSON.stringify(proof),
      ...options.headers,
    },
    body: JSON.stringify(options.body ?? {}),
    signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Request failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log(`[Request] Success! Request ID: ${data.requestId}`);

  return data as X402Response<T>;
}

/**
 * Get service pricing without triggering payment requirement.
 *
 * @param serviceUrl - Base URL of the x402 service
 * @param endpoint - Pricing endpoint (e.g., /api/generate/price)
 * @returns Pricing information
 */
export async function getServicePricing(
  serviceUrl: string,
  endpoint: string
): Promise<ServiceTerms> {
  const url = `${serviceUrl}${endpoint}`;

  console.log(`[Request] Getting pricing from ${url}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to get pricing: ${response.status}`);
  }

  const data = await response.json();
  return data.price;
}
