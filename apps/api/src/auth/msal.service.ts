import { Injectable } from '@nestjs/common';
import {
  AuthenticationResult,
  ConfidentialClientApplication,
} from '@azure/msal-node';
import { env } from '../config/env';

const OIDC_SCOPES = ['openid', 'profile', 'email'];

/** Thin wrapper around MSAL Node's confidential client (auth code flow). */
@Injectable()
export class MsalService {
  private readonly cca = new ConfidentialClientApplication({
    auth: {
      clientId: env.entra.clientId,
      clientSecret: env.entra.clientSecret,
      authority: `https://login.microsoftonline.com/${env.entra.tenantId}`,
    },
  });

  getAuthCodeUrl(state: string): Promise<string> {
    return this.cca.getAuthCodeUrl({
      scopes: OIDC_SCOPES,
      redirectUri: env.entra.redirectUri,
      state,
    });
  }

  acquireTokenByCode(code: string): Promise<AuthenticationResult> {
    return this.cca.acquireTokenByCode({
      code,
      scopes: OIDC_SCOPES,
      redirectUri: env.entra.redirectUri,
    });
  }
}
