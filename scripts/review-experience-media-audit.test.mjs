import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewInventory } from './review-experience-media-audit.mjs';

const base = () => ({
  mode: 'read-only',
  experiences: [
    {
      id: 'published-1', slug: 'haitises-isla-bacardi',
      title: 'Haitises + Isla Bacardi', status: 'PUBLISHED',
      featuredMediaId: 'old-asset', galleryMediaIds: ['old-asset'], galleryMediaSourceIds: [],
    },
    {
      id: 'draft-1', slug: 'bavaro-adventure-park-buggy-zipline',
      title: 'Buggy + Zipline', status: 'DRAFT',
      featuredMediaId: null, galleryMediaIds: [], galleryMediaSourceIds: [],
      editorialFlags: [{ code: 'MEDIA_PENDING_LIBRARY_REVIEW' }],
    },
  ],
  mediaAssets: [
    {
      id: 'existing-buggy', storageProvider: 'google-drive',
      storageKey: 'drive-buggy-id', usages: [],
    },
    {
      id: 'old-asset', storageProvider: 'google-drive',
      storageKey: 'old-published-media-id',
      usages: [{ slug: 'haitises-isla-bacardi', role: 'featured' }],
    },
  ],
  driveAudit: {
    complete: true,
    issues: [],
    objects: [
      { path: 'Experiencias/Buggy VIP/buggy-vip-01.webp', key: 'drive-buggy-id' },
      { path: 'Experiencias/Buggy VIP/buggy-vip-02.webp', key: 'drive-buggy-2' },
      { path: 'Experiencias/Zipline Mega Splash/zipline-01.webp', key: 'drive-zipline-id' },
    ],
  },
});

const candidates = {
  groups: [
    { folder: 'Buggy VIP', featured: 'Buggy VIP/buggy-vip-01.webp', gallery: ['Buggy VIP/buggy-vip-02.webp'] },
    { folder: 'Zipline Mega Splash', featured: 'Zipline Mega Splash/zipline-01.webp', gallery: [] },
  ],
};

const proposals = {
  experiences: [{
    slug: 'bavaro-adventure-park-buggy-zipline',
    featuredGroup: 'Buggy VIP',
    supportGroups: ['Zipline Mega Splash'],
    notes: 'Must show both activities.',
  }],
};

test('reuses exact provider key without creating an asset or editing published media', () => {
  const input = base();
  const original = structuredClone(input);
  const r = reviewInventory(input, candidates, proposals);

  assert.equal(r.mode, 'read-only-review');
  assert.equal(r.driveAuditComplete, true);
  assert.equal(r.counts.published, 1);
  assert.equal(r.counts.actualDrafts, 1);
  assert.equal(r.counts.driveFilesEnumerated, 3);
  assert.equal(r.draftReviews[0].featuredProposal.status, 'REUSE_REGISTERED_MEDIA_ASSET');
  assert.equal(r.draftReviews[0].featuredProposal.mediaAssetId, 'existing-buggy');
  assert.equal(r.draftReviews[0].galleryCandidates[0].status, 'REGISTER_ONLY_IF_APPROVED');
  assert.equal(r.draftReviews[0].galleryCandidates[1].conditional, true);
  assert.deepEqual(r.publishedReviews[0].existingGalleryMediaIds, ['old-asset']);
  assert.equal(r.publishedReviews[0].applied, false);
  assert.deepEqual(input, original);
});

test('warns instead of claiming readiness when Google Drive inventory is incomplete', () => {
  const input = base();
  input.driveAudit.complete = false;
  input.driveAudit.issues = ['Unable to list one folder'];
  input.driveAudit.objects = [];
  const r = reviewInventory(input, candidates, proposals);
  assert.equal(r.driveAuditComplete, false);
  assert.equal(r.draftReviews[0].featuredProposal.status, 'NOT_FOUND_IN_DRIVE_AUDIT');
  assert.equal(r.draftReviews[0].applied, false);
});

test('detects missing draft in staging instead of assuming seed was applied', () => {
  const input = base();
  input.experiences.pop();
  const r = reviewInventory(input, candidates, proposals);
  assert.equal(r.counts.actualDrafts, 0);
  assert.equal(r.draftReviews[0].currentStatus, 'NOT_PRESENT_IN_STAGING_INVENTORY');
  assert.equal(r.draftReviews[0].review, 'STOP_CHECK_DRAFT_STATUS');
});
