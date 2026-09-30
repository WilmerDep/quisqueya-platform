import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  ts: number;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class GoogleDriveService {
  constructor(private readonly config: ConfigService) {}

  getStatus() {
    return {
      provider: this.config.get<string>('STORAGE_PROVIDER', ''),
      clientIdConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_CLIENT_ID')),
      clientSecretConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_CLIENT_SECRET')),
      refreshTokenConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_REFRESH_TOKEN')),
      rootFolderConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_ROOT_FOLDER_ID')),
      redirectUriConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_REDIRECT_URI')),
      scope: DRIVE_SCOPE,
    };
  }

  createAuthorizationUrl() {
    const clientId = this.requireConfig('GOOGLE_DRIVE_CLIENT_ID');
    const redirectUri = this.requireConfig('GOOGLE_DRIVE_REDIRECT_URI');
    const state = this.createState();

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', DRIVE_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, state: string) {
    if (!code) throw new BadRequestException('Missing Google authorization code');
    this.validateState(state);

    const clientId = this.requireConfig('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = this.requireConfig('GOOGLE_DRIVE_CLIENT_SECRET');
    const redirectUri = this.requireConfig('GOOGLE_DRIVE_REDIRECT_URI');

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokens = (await response.json()) as TokenResponse;
    if (!response.ok) {
      throw new BadRequestException(
        tokens.error_description || tokens.error || 'Google OAuth token exchange failed',
      );
    }

    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Revoke the app grant if needed and authorize again with prompt=consent.',
      );
    }

    return {
      refreshToken: tokens.refresh_token,
      accessTokenReceived: Boolean(tokens.access_token),
      scope: tokens.scope || DRIVE_SCOPE,
      tokenType: tokens.token_type || 'Bearer',
      expiresIn: tokens.expires_in ?? null,
    };
  }

  async getAccessToken() {
    const clientId = this.requireConfig('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = this.requireConfig('GOOGLE_DRIVE_CLIENT_SECRET');
    const refreshToken = this.requireConfig('GOOGLE_DRIVE_REFRESH_TOKEN');

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokens = (await response.json()) as TokenResponse;
    if (!response.ok || !tokens.access_token) {
      throw new InternalServerErrorException(
        tokens.error_description || tokens.error || 'Unable to refresh Google access token',
      );
    }

    return tokens.access_token;
  }

  private createState() {
    const payload: OAuthStatePayload = { ts: Date.now() };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encoded);
    return `${encoded}.${signature}`;
  }

  private validateState(state: string) {
    if (!state) throw new BadRequestException('Missing OAuth state');

    const [encoded, signature] = state.split('.');
    if (!encoded || !signature) throw new BadRequestException('Invalid OAuth state');

    const expected = this.sign(encoded);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new BadRequestException('Invalid OAuth state signature');
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
    } catch {
      throw new BadRequestException('Invalid OAuth state payload');
    }

    if (!payload.ts || Date.now() - payload.ts > STATE_MAX_AGE_MS) {
      throw new BadRequestException('OAuth state expired');
    }
  }

  private sign(value: string) {
    const secret = this.requireConfig('GOOGLE_DRIVE_CLIENT_SECRET');
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private requireConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured`);
    }
    return value;
  }
}
