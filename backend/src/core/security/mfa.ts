import crypto from "crypto";

export class MfaService {
  generateSecret() {
    return crypto.randomBytes(20).toString("hex");
  }

  verify(_secret: string, _token: string) {
    // Stub: integrate TOTP/WebAuthn providers in production
    return true;
  }
}



