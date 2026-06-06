import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MsalService } from './msal.service';
import { UsersService, UserRow } from '../users/users.service';
import { groupsToRole } from './role-mapping';
import type { EntraClaims, SessionJwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly msal: MsalService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  buildLoginUrl(state: string): Promise<string> {
    return this.msal.getAuthCodeUrl(state);
  }

  /** Exchange the auth code, upsert the user, and return a signed session JWT. */
  async handleCallback(code: string): Promise<{ token: string; user: UserRow }> {
    const result = await this.msal.acquireTokenByCode(code);
    const claims = result.idTokenClaims as EntraClaims | undefined;

    if (!claims?.oid) {
      throw new UnauthorizedException('Entra token missing oid claim');
    }

    const role = groupsToRole(claims.groups);
    const email = claims.email ?? claims.preferred_username ?? '';
    const displayName = claims.name ?? email ?? claims.oid;

    if (!email) {
      throw new UnauthorizedException('Entra token missing email claim');
    }

    const user = await this.users.upsertFromEntra({
      entraOid: claims.oid,
      displayName,
      email,
      role,
    });

    this.logger.log(`Login: ${user.email} (${user.role})`);

    const payload: SessionJwtPayload = {
      sub: user.id,
      role: user.role,
      name: user.display_name,
      email: user.email,
    };

    return { token: await this.jwt.signAsync(payload), user };
  }
}
