import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveService } from './google-drive.service.js';

const configValues = {
  STORAGE_PROVIDER: 'google-drive',
  GOOGLE_DRIVE_CLIENT_ID: '1234567890-test.apps.googleusercontent.com',
  GOOGLE_DRIVE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_DRIVE_REFRESH_TOKEN: 'test-refresh-token',
  GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root-folder-id',
  GOOGLE_DRIVE_REDIRECT_URI: 'http://127.0.0.1:3000/api/v1/integrations/google-drive/callback',
  GOOGLE_DRIVE_PICKER_API_KEY: 'test-picker-key',
  GOOGLE_DRIVE_APP_ID: '1234567890',
};

const createService = (overrides: Record<string, string> = {}) => {
  const values = { ...configValues, ...overrides };
  const config = {
    get: vi.fn((key: string, defaultValue?: string) => values[key as keyof typeof values] ?? defaultValue),
  } as unknown as ConfigService;

  return new GoogleDriveService(config);
};

describe('GoogleDriveService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the backend and Picker configuration without exposing secrets', () => {
    const service = createService();
    const status = service.getStatus();

    expect(status).toMatchObject({
      provider: 'google-drive',
      scope: 'https://www.googleapis.com/auth/drive',
      clientIdConfigured: true,
      clientSecretConfigured: true,
      refreshTokenConfigured: true,
      rootFolderConfigured: true,
      redirectUriConfigured: true,
      pickerApiKeyConfigured: true,
      pickerAppIdConfigured: true,
    });
    expect(status).not.toHaveProperty('clientSecret');
    expect(status).not.toHaveProperty('refreshToken');
  });

  it('creates the backend OAuth URL with full Drive scope and no incremental-scope carryover', () => {
    const service = createService();
    const url = new URL(service.createAuthorizationUrl());

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('include_granted_scopes')).toBeNull();
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('returns only short-lived Picker bootstrap data to the authenticated admin browser', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'short-lived-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const service = createService();
    const config = await service.getPickerConfig();

    expect(config).toEqual({
      accessToken: 'short-lived-access-token',
      developerKey: 'test-picker-key',
      appId: '1234567890',
      rootFolderId: 'root-folder-id',
    });
    expect(config).not.toHaveProperty('refreshToken');
    expect(config).not.toHaveProperty('clientSecret');
  });

  it('rejects a Picker selection that is not the configured media root', async () => {
    const service = createService();

    await expect(service.confirmRootFolder('another-folder')).rejects.toThrow(BadRequestException);
  });


  it('lists the configured media root without requiring an ancestor lookup', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'short-lived-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: 'experiences-folder-id',
                name: 'Experiencias',
                mimeType: 'application/vnd.google-apps.folder',
                trashed: false,
                parents: ['root-folder-id'],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const service = createService();
    const files = await service.listFolder();

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      id: 'experiences-folder-id',
      name: 'Experiencias',
      parents: ['root-folder-id'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const listUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(listUrl.searchParams.get('q')).toContain("'root-folder-id' in parents");
  });

  it('allows listing a nested folder when its ancestor chain reaches the configured media root', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'short-lived-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'nested-folder-id',
            name: 'Altos de Chavón',
            mimeType: 'application/vnd.google-apps.folder',
            trashed: false,
            parents: ['experiences-folder-id'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'experiences-folder-id',
            name: 'Experiencias',
            mimeType: 'application/vnd.google-apps.folder',
            trashed: false,
            parents: ['root-folder-id'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: 'image-id',
                name: 'hero.jpg',
                mimeType: 'image/jpeg',
                trashed: false,
                parents: ['nested-folder-id'],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const service = createService();
    const files = await service.listFolder('nested-folder-id');

    expect(files).toHaveLength(1);
    expect(files[0]?.id).toBe('image-id');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects listing an object whose ancestor chain never reaches the configured media root', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'short-lived-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'outside-folder-id',
            name: 'Outside',
            mimeType: 'application/vnd.google-apps.folder',
            trashed: false,
            parents: ['external-root-id'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'external-root-id',
            name: 'External root',
            mimeType: 'application/vnd.google-apps.folder',
            trashed: false,
            parents: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const service = createService();

    await expect(service.listFolder('outside-folder-id')).rejects.toThrow(ForbiddenException);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

});
