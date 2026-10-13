import { describe, expect, it } from 'vitest';
import { googleDriveOAuthNeedsRenewal } from './GoogleDriveStorageCard';

describe('Google Drive OAuth renewal detection', () => {
  it('recognizes the actual revoked refresh-token error', () => {
    expect(googleDriveOAuthNeedsRenewal('Token has been expired or revoked.')).toBe(true);
  });

  it('recognizes the Google OAuth invalid_grant response', () => {
    expect(googleDriveOAuthNeedsRenewal('invalid_grant')).toBe(true);
  });

  it('does not mistake an unrelated root-folder permissions error for OAuth expiry', () => {
    expect(googleDriveOAuthNeedsRenewal('File not found: root folder')).toBe(false);
    expect(googleDriveOAuthNeedsRenewal('Insufficient permissions to access file')).toBe(false);
    expect(googleDriveOAuthNeedsRenewal('')).toBe(false);
  });
});
