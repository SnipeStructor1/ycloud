import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type MfaState = {
  required: boolean;
  factor: Factor | null;
};

export async function getMfaState(): Promise<MfaState> {
  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

  if (assuranceError) throw assuranceError;
  if (factorsError) throw factorsError;

  const factor = factors.totp.find((item) => item.status === "verified") ?? null;
  return {
    required: Boolean(
      factor && assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2",
    ),
    factor,
  };
}

export async function verifyMfaCode(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) throw error;
}
