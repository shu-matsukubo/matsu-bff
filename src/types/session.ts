export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: string;
};

export type Session = AuthTokens & {
  accessTokenExpiresAt: number;
};
