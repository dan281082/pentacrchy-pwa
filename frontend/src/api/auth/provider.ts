import type { AppUser, AuthSession, RegisterInput } from "@/src/types/auth";

// Contract shared by the mock and live (WordPress connector) auth providers.
export interface AuthProvider {
  login(email: string, password: string): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  me(accessToken: string): Promise<AppUser>;
  logout(session: AuthSession): Promise<void>;
  forgot(email: string): Promise<void>;
}

// Typed auth failure with a user-safe message. `code` is for programmatic use.
export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
