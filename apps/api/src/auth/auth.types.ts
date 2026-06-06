import type { Role } from '@pulse/shared-types';

/** Shape attached to req.user after passport-jwt validation */
export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
  email: string;
}

/** Payload we sign into the app session JWT */
export interface SessionJwtPayload {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

/** Relevant claims from the Entra id token */
export interface EntraClaims {
  oid: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  groups?: string[];
}
