import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'quisqueya_core',
  connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
});

const prisma = new PrismaClient({ adapter });

const asObject = value => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

function practicalCandidates(provenance) {
  const root = asObject(provenance);
  const meta = asObject(root.meta);
  const candidates = {};

  const fields = [
    'what_to_bring',
    'whatToBring',
    'restrictions',
    'minimum_age',
    'minimumAge',
    'physical_level',
    'physicalLevel',
    'meeting_point',
    'meetingPoint',
    'pickup',
    'pickup_information',
    'cancellation_policy',
    'booking_notice',
    'required_documents',
  ];

  for (const field of fields) {
    const value = root[field] ?? meta[field];
    if (value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length)) {
      candidates[field] = value;
    }
  }

  return candidates;
}

async function main() {
  const experiences = await prisma.experience.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      sourceId: true,
      slug: true,
      title: true,
      categoryLabel: true,
      practicalInfoJson: true,
      provenanceJson: true,
    },
  });

  const links = await prisma.experienceTaxonomyTerm.findMany({
    where: { experienceId: { in: experiences.map(item => item.id) } },
    select: { experienceId: true, termId: true },
  });

  const terms = await prisma.taxonomyTerm.findMany({
    where: { id: { in: [...new Set(links.map(link => link.termId))] } },
    select: {
      id: true,
      taxonomy: true,
      slug: true,
      name: true,
      sourceId: true,
    },
  });

  const termById = new Map(terms.map(term => [term.id, term]));
  const termsByExperience = new Map();

  for (const link of links) {
    const term = termById.get(link.termId);
    if (!term) continue;
    const rows = termsByExperience.get(link.experienceId) || [];
    rows.push(term);
    termsByExperience.set(link.experienceId, rows);
  }

  const report = experiences.map(experience => {
    const taxonomyTerms = (termsByExperience.get(experience.id) || [])
      .sort((a, b) => a.taxonomy.localeCompare(b.taxonomy) || a.name.localeCompare(b.name));
    const categoryEvidence = taxonomyTerms.filter(term =>
      ['tour_type', 'tour_activities', 'tour_attraction', 'tour_features'].includes(term.taxonomy),
    );
    const candidates = practicalCandidates(experience.provenanceJson);

    return {
      id: experience.id,
      sourceId: experience.sourceId,
      slug: experience.slug,
      title: experience.title,
      currentCategory: experience.categoryLabel,
      categoryEvidence,
      practicalInfoStored: Boolean(experience.practicalInfoJson),
      practicalSourceCandidates: candidates,
      hasPracticalSourceEvidence: Object.keys(candidates).length > 0,
    };
  });

  console.log(JSON.stringify({
    totals: {
      experiences: report.length,
      withCategory: report.filter(item => nonEmpty(item.currentCategory)).length,
      withCategoryEvidence: report.filter(item => item.categoryEvidence.length).length,
      withPracticalInfo: report.filter(item => item.practicalInfoStored).length,
      withPracticalSourceEvidence: report.filter(item => item.hasPracticalSourceEvidence).length,
    },
    experiences: report,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
