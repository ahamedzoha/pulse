import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../config/env';
import type { AuthUser, SessionJwtPayload } from './auth.types';

/** Validates the app's own session JWT (issued after the MSAL OIDC flow). */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Header is the norm for REST. The `?token=` fallback exists because the
      // native EventSource API (Intel SSE feed) can't set an Authorization
      // header — same JWT, just carried in the query string for that one case.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: env.jwtSecret,
    });
  }

  validate(payload: SessionJwtPayload): AuthUser {
    return {
      userId: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
  }
}
