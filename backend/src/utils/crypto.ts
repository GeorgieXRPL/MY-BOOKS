import crypto from "crypto";

export const hmacSha256 = (secret: string, payload: string) => {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

export const verifyHmacSha256 = (secret: string, payload: string, signature: string) => {
  const expected = hmacSha256(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};



