export interface RequestUser {
  id: number;
  email: string;
  jti: string;
}

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}
