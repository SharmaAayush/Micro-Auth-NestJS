export interface RequestUser {
  id: string;
  email: string;
  jti: string;
}

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}
