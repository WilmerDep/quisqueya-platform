import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const DRIVE_FILE_FIELDS = 'id,name,mimeType,webViewLink,modifiedTime,trashed,size,md5Checksum,parents';
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

type DriveFileResponse = {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
  trashed?: boolean;
  size?: string;
  md5Checksum?: string;
  parents?: string[];
  error?: { message?: string };
};

type DriveFileListResponse = {
  files?: DriveFileResponse[];
  nextPageToken?: string;
  error?: { message?: string };
};

export type GoogleDriveFileMetadata = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
  trashed: boolean;
  sizeBytes?: number;
  checksum?: string;
  parents: string[];
};

export type GoogleDriveUploadInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
  parentFolderId?: string;
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
      pickerApiKeyConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_PICKER_API_KEY')),
      pickerAppIdConfigured: Boolean(this.config.get<string>('GOOGLE_DRIVE_APP_ID')),
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

  async getPickerConfig() {
    const accessToken = await this.getAccessToken();
    return {
      accessToken,
      developerKey: this.requireConfig('GOOGLE_DRIVE_PICKER_API_KEY'),
      appId: this.requireConfig('GOOGLE_DRIVE_APP_ID'),
      rootFolderId: this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
    };
  }

  async confirmRootFolder(folderId: string) {
    const configuredRootFolderId = this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (folderId.trim() !== configuredRootFolderId) {
      throw new BadRequestException(
        'Selected Google Drive folder does not match the configured Quisqueya media root',
      );
    }
    return this.getFileMetadata(configuredRootFolderId);
  }

  async getRootFolderMetadata() {
    return this.getFileMetadata(this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID'));
  }

  async getFileMetadata(fileId: string): Promise<GoogleDriveFileMetadata> {
    const candidateId = fileId.trim();
    if (!candidateId) throw new BadRequestException('Missing Google Drive file id');

    const accessToken = await this.getAccessToken();
    await this.assertWithinConfiguredRoot(candidateId, accessToken);
    return this.fetchFileMetadataUnchecked(candidateId, accessToken);
  }

  async listFolder(folderId?: string): Promise<GoogleDriveFileMetadata[]> {
    const parentId = folderId?.trim() || this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    const accessToken = await this.getAccessToken();
    await this.assertWithinConfiguredRoot(parentId, accessToken);

    const files: GoogleDriveFileMetadata[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `'${parentId.replaceAll("'", "\\'")}' in parents and trashed = false`,
        fields: `nextPageToken,files(${DRIVE_FILE_FIELDS})`,
        pageSize: '1000',
        spaces: 'drive',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${DRIVE_API_URL}/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as DriveFileListResponse;

      if (!response.ok) {
        throw new BadRequestException(payload.error?.message || 'Unable to list Google Drive folder');
      }

      files.push(...(payload.files ?? []).map(file => this.normalizeFile(file)));
      pageToken = payload.nextPageToken;
    } while (pageToken);

    return files;
  }

  async downloadFile(fileId: string) {
    const accessToken = await this.getAccessToken();
    await this.assertWithinConfiguredRoot(fileId, accessToken);

    const response = await fetch(
      `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const message = await this.readGoogleError(response, 'Unable to download Google Drive file');
      throw new BadRequestException(message);
    }

    const data = Buffer.from(await response.arrayBuffer());
    return {
      data,
      mimeType: response.headers.get('content-type') ?? undefined,
      sizeBytes: data.byteLength,
    };
  }

  async uploadFile(input: GoogleDriveUploadInput): Promise<GoogleDriveFileMetadata> {
    const accessToken = await this.getAccessToken();
    const parentFolderId = input.parentFolderId?.trim() || this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    await this.assertWithinConfiguredRoot(parentFolderId, accessToken);

    const boundary = `quisqueya_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const metadata = JSON.stringify({
      name: input.fileName,
      parents: [parentFolderId],
    });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`),
      input.data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: DRIVE_FILE_FIELDS,
      supportsAllDrives: 'true',
    });

    const response = await fetch(`${DRIVE_UPLOAD_URL}/files?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.byteLength),
      },
      body,
    });
    const payload = (await response.json()) as DriveFileResponse;

    if (!response.ok) {
      throw new BadRequestException(payload.error?.message || 'Unable to upload file to Google Drive');
    }

    return this.normalizeFile(payload);
  }

  async trashFile(fileId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    await this.assertWithinConfiguredRoot(fileId, accessToken);

    const params = new URLSearchParams({
      fields: 'id,trashed',
      supportsAllDrives: 'true',
    });
    const response = await fetch(
      `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      },
    );

    if (!response.ok) {
      const message = await this.readGoogleError(response, 'Unable to archive Google Drive file');
      throw new BadRequestException(message);
    }
  }

  private async fetchFileMetadataUnchecked(
    fileId: string,
    accessToken: string,
  ): Promise<GoogleDriveFileMetadata> {
    const params = new URLSearchParams({
      fields: DRIVE_FILE_FIELDS,
      supportsAllDrives: 'true',
    });
    const response = await fetch(
      `${DRIVE_API_URL}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const payload = (await response.json()) as DriveFileResponse;

    if (!response.ok) {
      throw new BadRequestException(
        payload.error?.message || 'Unable to read Google Drive file metadata',
      );
    }

    return this.normalizeFile(payload);
  }

  private async assertWithinConfiguredRoot(fileId: string, accessToken: string): Promise<void> {
    const candidateId = fileId.trim();
    if (!candidateId) throw new BadRequestException('Missing Google Drive file id');

    const rootFolderId = this.requireConfig('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (candidateId === rootFolderId) return;

    const pending = [candidateId];
    const visited = new Set<string>();
    const maxVisitedNodes = 128;

    while (pending.length > 0) {
      const currentId = pending.shift();
      if (!currentId || visited.has(currentId)) continue;
      if (currentId === rootFolderId) return;

      if (visited.size >= maxVisitedNodes) {
        throw new BadRequestException('Unable to verify Google Drive media root boundary');
      }

      visited.add(currentId);
      const metadata = await this.fetchFileMetadataUnchecked(currentId, accessToken);

      for (const parentId of metadata.parents) {
        if (parentId === rootFolderId) return;
        if (!visited.has(parentId)) pending.push(parentId);
      }
    }

    throw new ForbiddenException(
      'Google Drive object is outside the configured Quisqueya media root',
    );
  }

  private normalizeFile(payload: DriveFileResponse): GoogleDriveFileMetadata {
    if (!payload.id || !payload.name) {
      throw new BadRequestException('Google Drive returned incomplete file metadata');
    }

    const parsedSize = payload.size === undefined ? undefined : Number(payload.size);
    return {
      id: payload.id,
      name: payload.name,
      mimeType: payload.mimeType,
      webViewLink: payload.webViewLink,
      modifiedTime: payload.modifiedTime,
      trashed: payload.trashed ?? false,
      sizeBytes: parsedSize !== undefined && Number.isFinite(parsedSize) ? parsedSize : undefined,
      checksum: payload.md5Checksum,
      parents: payload.parents ?? [],
    };
  }

  private async readGoogleError(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as DriveFileResponse;
      return payload.error?.message || fallback;
    } catch {
      return fallback;
    }
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
