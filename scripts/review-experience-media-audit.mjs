import { readFileSync, writeFileSync } from 'node:fs';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

export function reviewInventory(inventory, candidates, proposalCatalog) {
  if (inventory?.mode !== 'read-only' || !Array.isArray(inventory.experiences) || !Array.isArray(inventory.mediaAssets)) {
    throw new Error('Expected the authenticated CRM read-only experience media inventory.');
  }
  if (!Array.isArray(candidates?.groups) || !Array.isArray(proposalCatalog?.experiences)) {
    throw new Error('Expected the versioned media candidate/proposal catalogs.');
  }

  const drive = inventory.driveAudit;
  const exactFiles = new Map();
  for (const item of drive?.objects ?? []) {
    const path = String(item.path || '');
    const existing = exactFiles.get(path) || [];
    existing.push(item);
    exactFiles.set(path, existing);
  }

  const assetsByProviderKey = new Map();
  for (const asset of inventory.mediaAssets) {
    const key = String(asset.storageProvider) + ':' + String(asset.storageKey);
    const existing = assetsByProviderKey.get(key) || [];
    existing.push(asset);
    assetsByProviderKey.set(key, existing);
  }

  const groupsByName = new Map(candidates.groups.map(group => [group.folder, group]));
  const experiencesBySlug = new Map(inventory.experiences.map(item => [item.slug, item]));

  function resolve(relativePath, proposedRole, conditional) {
    const expectedPath = 'Experiencias/' + relativePath;
    const driveMatches = exactFiles.get(expectedPath) || [];
    if (driveMatches.length === 0) return {
      relativePath, role: proposedRole, conditional, status: 'NOT_FOUND_IN_DRIVE_AUDIT',
    };
    if (driveMatches.length !== 1) return {
      relativePath, role: proposedRole, conditional, status: 'AMBIGUOUS_DRIVE_PATH',
    };
    const file = driveMatches[0];
    const matches = assetsByProviderKey.get('google-drive:' + file.key) || [];
    if (matches.length > 1) return {
      relativePath, role: proposedRole, conditional, status: 'DUPLICATE_MEDIA_ASSET_STORAGE_KEY',
      driveFileId: file.key,
    };
    return {
      relativePath,
      role: proposedRole,
      conditional,
      status: matches.length === 1 ? 'REUSE_REGISTERED_MEDIA_ASSET' : 'REGISTER_ONLY_IF_APPROVED',
      driveFileId: file.key,
      mediaAssetId: matches.length === 1 ? matches[0].id : null,
      existingUsages: matches.length === 1 ? matches[0].usages : [],
    };
  }

  const draftReviews = proposalCatalog.experiences.map(proposal => {
    const current = experiencesBySlug.get(proposal.slug);
    const mainGroup = groupsByName.get(proposal.featuredGroup);
    const cover = mainGroup ? resolve(mainGroup.featured, 'featured', false) : null;
    const galleryCandidates = [];

    if (mainGroup) {
      for (const file of mainGroup.gallery) galleryCandidates.push(resolve(file, 'gallery', false));
    }
    for (const supportingGroup of proposal.supportGroups || []) {
      const group = groupsByName.get(supportingGroup);
      if (!group) continue;
      galleryCandidates.push(resolve(group.featured, 'gallery', true));
      for (const file of group.gallery) galleryCandidates.push(resolve(file, 'gallery', true));
    }

    const gallery = [...new Map(galleryCandidates.map(item => [item.relativePath, item])).values()];
    const missing = [cover, ...gallery].filter(Boolean).filter(item => item.status !== 'REUSE_REGISTERED_MEDIA_ASSET');
    const currentStatus = current?.status ?? 'NOT_PRESENT_IN_STAGING_INVENTORY';
    return {
      slug: proposal.slug,
      title: current?.title ?? null,
      currentStatus,
      review: currentStatus === 'DRAFT' ? 'EDITORIAL_AND_IMAGE_REVIEW_REQUIRED' : 'STOP_CHECK_DRAFT_STATUS',
      currentMedia: current ? {
        featuredMediaId: current.featuredMediaId ?? null,
        galleryMediaIds: current.galleryMediaIds ?? [],
        galleryMediaSourceIds: current.galleryMediaSourceIds ?? [],
        missingMediaAssetIds: current.missingMediaAssetIds ?? [],
      } : null,
      featuredProposal: cover,
      galleryCandidates: gallery,
      unresolvedCandidateCount: missing.length,
      unresolvedEditorialFlags: current?.editorialFlags ?? [],
      notes: proposal.notes,
      applied: false,
    };
  });

  const publishedReviews = inventory.experiences.filter(x => x.status === 'PUBLISHED').map(item => ({
    slug: item.slug,
    id: item.id,
    title: item.title,
    existingFeaturedMediaId: item.featuredMediaId ?? null,
    existingGalleryMediaIds: item.galleryMediaIds ?? [],
    existingLegacyGallerySourceIds: item.galleryMediaSourceIds ?? [],
    missingMediaAssetIds: item.missingMediaAssetIds ?? [],
    decision: 'KEEP_IF_RELEVANT_VERIFY_VISUALLY',
    applied: false,
  }));

  return {
    mode: 'read-only-review',
    generatedAt: new Date().toISOString(),
    driveAuditComplete: drive?.complete === true,
    driveAuditIssues: drive?.issues ?? ['Drive audit missing'],
    counts: {
      published: publishedReviews.length,
      actualDrafts: inventory.experiences.filter(x => x.status === 'DRAFT').length,
      proposedBavaroDrafts: draftReviews.length,
      driveFilesEnumerated: (drive?.objects ?? []).length,
      candidateFiles: candidates.groups.reduce((n, group) => n + 1 + group.gallery.length, 0),
    },
    publishedReviews,
    draftReviews,
    caution: [
      'No POST/PATCH/upload/delete operations have been executed.',
      'Only exact path and provider storageKey matches identify a Drive file or registered asset.',
      'The candidate files and the experience-to-group association still require human visual/editorial approval.',
      'Never replace approved published media by default. Never publish DRAFT experiences.',
      'Do not rerun seed scripts that reset featuredMediaId/gallery links after final associations.',
      'If driveAuditComplete is false, no association is ready to be applied.',
    ],
  };
}

if (process.argv[1]?.endsWith('review-experience-media-audit.mjs')) {
  try {
    const sourcePath = process.argv[2];
    if (!sourcePath || sourcePath.startsWith('--')) {
      throw new Error('Usage: node scripts/review-experience-media-audit.mjs <crm-inventory.json> [report.json]');
    }
    const inventory = readJson(sourcePath);
    const candidates = readJson('data/content/drive-ready-media-candidates-2026-10-14.json');
    const proposals = readJson('data/content/bavaro-media-association-proposals-2026-10-14.json');
    const review = reviewInventory(inventory, candidates, proposals);
    const report = JSON.stringify(review, null, 2) + '\n';
    if (process.argv[3]) {
      writeFileSync(process.argv[3], report, { flag: 'wx', mode: 0o600 });
      console.log('Read-only proposal report written to ' + process.argv[3]);
    } else {
      console.log(report);
    }
    if (!review.driveAuditComplete) process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
