export interface Passwords {
  hash(password: string): Promise<string>;
  // With a null hash it still does the full check against a stand-in hash and answers
  // false, so an unknown email takes as long as a wrong password.
  verify(passwordHash: string | null, password: string): Promise<boolean>;
}

export interface SessionTokens {
  // A new random token for the cookie.
  create(): string;
  // What is stored instead of the token itself.
  hashOf(token: string): string;
}
