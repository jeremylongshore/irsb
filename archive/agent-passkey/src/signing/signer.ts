/**
 * Signer Interface
 *
 * Common interface for all signing backends (Lit Protocol, KMS, etc.)
 */

/**
 * Ethereum signature with recovery id
 */
export interface EthSignature {
  r: string; // 32-byte hex
  s: string; // 32-byte hex
  v: number; // 27 or 28 (or EIP-155 variant)
}

/**
 * Signer interface that all backends must implement
 */
export interface Signer {
  /**
   * Get the Ethereum address for this signer
   */
  getAddress(): Promise<string>;

  /**
   * Sign a message hash
   * @param messageHash - 32-byte keccak256 hash (0x prefixed)
   */
  sign(messageHash: string): Promise<EthSignature>;
}
