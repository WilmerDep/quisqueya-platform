import type { PublicExperience, PublicExperiencePackageSelection } from './content.types.js';

type FamilyConfig = PublicExperiencePackageSelection & { packageSlugs: string[] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODES = new Set<PublicExperiencePackageSelection['mode']>(['single', 'multi_inquiry', 'addons']);

/** La membresía comercial es explícita en el padre; provenanceJson solo conserva el origen. */
export function getExperienceFamilyConfig(experience: PublicExperience): FamilyConfig | null {
  const raw = experience.display?.experienceFamily;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const config = raw as Record<string, unknown>;
  if (config.version !== 2 || typeof config.mode !== 'string' ||
      !MODES.has(config.mode as PublicExperiencePackageSelection['mode'])) return null;

  if (!Array.isArray(config.packageSlugs) || config.packageSlugs.length === 0 || config.packageSlugs.length > 100) {
    return null;
  }

  const slugs = config.packageSlugs;
  if (!slugs.every((slug): slug is string => typeof slug === 'string' && SLUG.test(slug)) ||
      slugs.includes(experience.slug) || new Set(slugs).size !== slugs.length) {
    return null;
  }

  return { version: 2, mode: config.mode as FamilyConfig['mode'], packageSlugs: slugs };
}

function startingPrice(packages: PublicExperience[]): Record<string, unknown> | undefined {
  // No se calculan importes para selecciones múltiples; «desde» es solo una referencia individual.
  const priced = packages.map(item => {
    const raw = item.pricing;
    const from = typeof raw?.from === 'number' || typeof raw?.from === 'string'
      ? Number(raw.from)
      : NaN;
    return {
      from,
      currency: raw?.currency,
      basis: raw?.basis,
      fixed: item.pricingMode === 'fixed',
    };
  });

  if (!priced.length || !priced.every(item =>
    item.fixed && Number.isFinite(item.from) && item.from >= 0 &&
    typeof item.currency === 'string' && item.currency.length > 0 &&
    typeof item.basis === 'string' && item.basis.length > 0 &&
    item.currency === priced[0].currency && item.basis === priced[0].basis)) return undefined;

  return {
    version: 2,
    currency: priced[0].currency,
    basis: priced[0].basis,
    from: Math.min(...priced.map(item => item.from)),
  };
}

export function resolveExperienceFamily(
  parent: PublicExperience,
  published: PublicExperience[],
): PublicExperience {
  const config = getExperienceFamilyConfig(parent);
  if (!config) return parent;

  const bySlug = new Map(published.filter(item => item.status === 'published').map(item => [item.slug, item]));
  const packages = config.packageSlugs
    .map(slug => bySlug.get(slug))
    .filter((item): item is PublicExperience => Boolean(item));
  if (!packages.length) return parent;

  const pricing = startingPrice(packages);
  return {
    ...parent,
    kind: 'package_family',
    packageSelection: { version: 2, mode: config.mode },
    packageCount: packages.length,
    packages,
    // No tomar un precio fijo del padre sin una base homogénea comprobada.
    pricingMode: pricing ? 'fixed' : 'on_request',
    pricing,
  };
}

export function resolveExperienceCatalog(published: PublicExperience[]): PublicExperience[] {
  const parents = published.map(parent => resolveExperienceFamily(parent, published));
  const memberships = new Map<string, string[]>();
  for (const parent of parents) {
    for (const child of parent.packages ?? []) {
      memberships.set(child.slug, [...(memberships.get(child.slug) ?? []), parent.slug]);
    }
  }

  // Si existe una relación circular o dos padres reclaman el mismo hijo, no ocultamos registros.
  const familyParents = new Set(parents.filter(item => item.packages?.length).map(item => item.slug));
  const invalidParents = new Set<string>();
  for (const [slug, owners] of memberships) {
    if (owners.length > 1 || familyParents.has(slug)) {
      owners.forEach(owner => invalidParents.add(owner));
      if (familyParents.has(slug)) invalidParents.add(slug);
    }
  }

  const hidden = new Set<string>();
  for (const parent of parents) {
    if (!invalidParents.has(parent.slug)) {
      parent.packages?.forEach(child => hidden.add(child.slug));
    }
  }

  return parents
    .filter(item => !hidden.has(item.slug))
    .map(item => {
      if (invalidParents.has(item.slug)) return published.find(original => original.slug === item.slug) ?? item;
      const summary = { ...item };
      delete summary.packages;
      return summary;
    });
}
