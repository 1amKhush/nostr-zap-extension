export interface VerificationResult {
  handle: string;
  verified: boolean;
  checkedAt: number;
  reason: string;
  npub?: string;
}

export interface HandleVerifier {
  verify(handle: string): Promise<VerificationResult>;
}
