import { describe, expect, it } from 'vitest';
import type { PublicExperience } from './content.types.js';
import {
  getExperienceFamilyConfig,
  resolveExperienceCatalog,
  resolveExperienceFamily,
} from './experience-families.js';

function experience(slug: string, overrides: Partial<PublicExperience> = {}): PublicExperience {
  return {
    id: slug,
    slug,
    title: slug,
    languages: [],
    gallery: [],
    galleryMediaIds: [],
    galleryMediaSourceIds: [],
    pricingMode: 'fixed',
    pricing: { currency: 'USD', basis: 'person', from: 99 },
    included: [],
    excluded: [],
    itinerary: [],
    faqs: [],
    editorialFlags: [],
    status: 'published',
    ...overrides,
  };
}

function parent(slugs: string[], mode: 'single' | 'multi_inquiry' | 'addons' = 'multi_inquiry') {
  return experience('bavaro-adventure-park', {
    display: { experienceFamily: { version: 2, mode, packageSlugs: slugs } },
  });
}

describe('Experiencias con modalidades — contrato público v2', () => {
  it('conserva íntegra una experiencia v1 sin configuración de familia', () => {
    const standalone = experience('isla-saona');
    expect(resolveExperienceFamily(standalone, [])).toBe(standalone);
    expect(resolveExperienceCatalog([standalone])).toEqual([standalone]);
  });

  it('devuelve una tarjeta para 13 paquetes y conserva la ficha individual ajena', () => {
    const slugs = Array.from({ length: 13 }, (_, i) => `bavaro-package-${i + 1}`);
    const packages = slugs.map((slug, i) => experience(slug, { pricing: { currency: 'USD', basis: 'person', from: 99 + i * 10 } }));
    const catalog = resolveExperienceCatalog([parent(slugs), ...packages, experience('isla-saona')]);

    expect(catalog.map(item => item.slug)).toEqual(['bavaro-adventure-park', 'isla-saona']);
    expect(catalog[0]).toMatchObject({
      kind: 'package_family', packageCount: 13,
      packageSelection: { version: 2, mode: 'multi_inquiry' },
      pricing: { version: 2, currency: 'USD', basis: 'person', from: 99 },
    });
    expect(catalog[0].packages).toBeUndefined();

    const detail = resolveExperienceFamily(parent(slugs), [...packages].reverse());
    expect(detail.packages?.map(item => item.slug)).toEqual(slugs);
    expect(detail.packages?.[12].pricing).toEqual(packages[12].pricing);
  });

  it('filtra borradores y no convierte una familia sin hijos publicados en un selector vacío', () => {
    const main = parent(['package-a', 'package-b']);
    const draft = experience('package-b', { status: 'draft' });
    const active = experience('package-a');

    expect(resolveExperienceFamily(main, [active, draft]).packages?.map(item => item.slug)).toEqual(['package-a']);
    expect(resolveExperienceFamily(main, [draft])).toBe(main);
    expect(resolveExperienceCatalog([main])).toEqual([main]);
  });

  it('no agrupa configuraciones inválidas, duplicadas, autorreferenciales ni versiones desconocidas', () => {
    const child = experience('package-a');
    for (const config of [
      { version: 2, mode: 'single', packageSlugs: ['package-a', 'package-a'] },
      { version: 2, mode: 'single', packageSlugs: ['bavaro-adventure-park'] },
      { version: 2, mode: 'multi', packageSlugs: ['package-a'] },
      { version: 3, mode: 'single', packageSlugs: ['package-a'] },
      { version: 2, mode: 'single', packageSlugs: ['package-a', 'not valid'] },
    ]) {
      const invalid = experience('bavaro-adventure-park', { display: { experienceFamily: config } });
      expect(getExperienceFamilyConfig(invalid)).toBeNull();
      expect(resolveExperienceCatalog([invalid, child])).toEqual([invalid, child]);
    }
  });

  it('no oculta paquetes si dos padres reclaman la misma modalidad', () => {
    const child = experience('shared-package');
    const a = experience('parent-a', { display: { experienceFamily: { version: 2, mode: 'single', packageSlugs: [child.slug] } } });
    const b = experience('parent-b', { display: { experienceFamily: { version: 2, mode: 'single', packageSlugs: [child.slug] } } });
    const catalog = resolveExperienceCatalog([a, b, child]);
    expect(catalog).toEqual([a, b, child]);
  });

  it('no oculta modalidades si una familia intenta anidar a otra familia', () => {
    const child = experience('package-c');
    const a = experience('parent-a', {
      display: { experienceFamily: { version: 2, mode: 'single', packageSlugs: ['parent-b'] } },
    });
    const b = experience('parent-b', {
      display: { experienceFamily: { version: 2, mode: 'single', packageSlugs: [child.slug] } },
    });
    expect(resolveExperienceCatalog([a, b, child])).toEqual([a, b, child]);
  });

  it('no publica precio desde cuando hay paquetes no cotizados o monedas diferentes', () => {
    const p = parent(['priced', 'unknown']);
    const priced = experience('priced');
    const unknown = experience('unknown', { pricingMode: 'on_request', pricing: undefined });

    const detail = resolveExperienceFamily(p, [priced, unknown]);
    expect(detail.kind).toBe('package_family');
    expect(detail.pricingMode).toBe('on_request');
    expect(detail.pricing).toBeUndefined();
    expect(detail.packages?.[1].pricingMode).toBe('on_request');

    const euros = experience('unknown', { pricing: { currency: 'EUR', basis: 'person', from: 50 } });
    expect(resolveExperienceFamily(p, [priced, euros]).pricing).toBeUndefined();
  });

  it('no suma importes aunque el selector admita múltiples paquetes', () => {
    const main = parent(['package-a', 'package-b']);
    const detail = resolveExperienceFamily(main, [
      experience('package-a', { pricing: { currency: 'USD', basis: 'person', from: 120 } }),
      experience('package-b', { pricing: { currency: 'USD', basis: 'person', from: 140 } }),
    ]);
    expect(detail.pricing?.from).toBe(120);
    expect(detail.packageSelection?.mode).toBe('multi_inquiry');
  });
});
