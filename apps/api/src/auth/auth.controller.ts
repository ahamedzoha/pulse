import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './auth.types';
import { env } from '../config/env';

type AppTarget = 'board' | 'intel';

/** Short-lived OIDC state store (CSRF) — in-memory is fine for a single-instance POC. */
const STATE_TTL_MS = 5 * 60 * 1000;

@Controller('auth')
export class AuthController {
  private readonly pendingStates = new Map<string, { app: AppTarget; ts: number }>();

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  /**
   * Step 1 — redirect the browser to Entra.
   * `?app=board|intel` sets the post-login target.
   * `?prompt=select_account` forces the account picker (switch users).
   */
  @Get('login')
  async login(
    @Query('app') app: string | undefined,
    @Query('prompt') prompt: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const target: AppTarget = app === 'intel' ? 'intel' : 'board';
    const state = randomUUID();
    this.pruneStates();
    this.pendingStates.set(state, { app: target, ts: Date.now() });

    const oidcPrompt =
      prompt === 'select_account' || prompt === 'login' ? prompt : undefined;
    const url = await this.auth.buildLoginUrl(state, oidcPrompt);
    res.redirect(url);
  }

  /** Federated sign-out — ends the Entra browser SSO session. */
  @Get('logout')
  logout(
    @Query('app') app: string | undefined,
    @Res() res: Response,
  ): void {
    const target: AppTarget = app === 'intel' ? 'intel' : 'board';
    res.redirect(this.auth.buildLogoutUrl(target));
  }

  /** Entra post-logout landing — bounce to the frontend unsigned gate. */
  @Get('logged-out')
  loggedOut(
    @Query('app') app: string | undefined,
    @Res() res: Response,
  ): void {
    const target: AppTarget = app === 'intel' ? 'intel' : 'board';
    res.redirect(env.frontends[target]);
  }

  /** Step 2 — Entra redirects here with the auth code. Exchange, issue JWT, bounce to frontend. */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }

    const pending = state ? this.pendingStates.get(state) : undefined;
    if (!pending) {
      throw new BadRequestException('Invalid or expired state');
    }
    this.pendingStates.delete(state);

    const { token } = await this.auth.handleCallback(code);

    // Hand the session token to the frontend via URL fragment (not sent to servers/logs).
    const base = env.frontends[pending.app];
    res.redirect(`${base}/#token=${token}`);
  }

  /** Returns the authenticated user, re-read from the DB for a fresh role. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.users.findById(user.userId);
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      role: row.role,
    };
  }

  private pruneStates(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingStates) {
      if (now - value.ts > STATE_TTL_MS) {
        this.pendingStates.delete(key);
      }
    }
  }
}
