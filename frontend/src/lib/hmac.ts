export const hmacSha256 = async (secret: string, payload: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = Array.from(new Uint8Array(sigBuf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};



