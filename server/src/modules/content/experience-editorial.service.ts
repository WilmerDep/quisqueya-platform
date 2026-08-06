import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Experience } from '@prisma/client';
import { PrismaService } from '../../infra/prisma.service.js';

export interface ExperienceEditorialWriteInput {
  faqs?: unknown;
  itinerary?: unknown;
  included?: unknown;
  excluded?: unknown;
  practicalInfo?: unknown;
  availability?: unknown;
  contact?: unknown;
  assistedByAi?: unknown;
  reviewStatus?: unknown;
}

type EditorialFlag = {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
};

@Injectable()
export class ExperienceEditorialService {
  constructor(private readonly prisma: PrismaService) {}

  async get(experienceIdOrSlug: string) {
    const experience = await this.findExperience(experienceIdOrSlug);
    return this.toEditorialResponse(experience);
  }

  async update(experienceIdOrSlug: string, input: ExperienceEditorialWriteInput) {
    const existing = await this.findExperience(experienceIdOrSlug);
    const normalized = this.normalizeInput(input);

    if (!Object.keys(normalized.data).length) {
      throw new BadRequestException('No se recibió contenido editorial para actualizar.');
    }

    const editorialFlags = this.mergeEditorialFlags(
      existing.editorialFlagsJson,
      normalized.assistedByAi,
      normalized.reviewStatus,
    );

    const updated = await this.prisma.experience.update({
      where: { id: existing.id },
      data: {
        ...normalized.data,
        editorialFlagsJson: editorialFlags as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toEditorialResponse(updated);
  }

  private async findExperience(idOrSlug: string) {
    const value = idOrSlug.trim();
    if (!value) throw new BadRequestException('La experiencia es obligatoria.');

    const experience = await this.prisma.experience.findFirst({
      where: { OR: [{ id: value }, { slug: value }] },
    });
    if (!experience) throw new NotFoundException('Experiencia no encontrada.');
    return experience;
  }

  private normalizeInput(input: ExperienceEditorialWriteInput) {
    const data: Prisma.ExperienceUpdateInput = {};

    if (input.faqs !== undefined) data.faqsJson = this.normalizeFaqs(input.faqs);
    if (input.itinerary !== undefined) data.itineraryJson = this.normalizeItinerary(input.itinerary);
    if (input.included !== undefined) data.includedItemsJson = this.normalizeStringList(input.included, 'incluidos');
    if (input.excluded !== undefined) data.excludedItemsJson = this.normalizeStringList(input.excluded, 'excluidos');
    if (input.practicalInfo !== undefined) data.practicalInfoJson = this.normalizeObject(input.practicalInfo, 'información práctica');
    if (input.availability !== undefined) data.availabilityJson = this.normalizeObject(input.availability, 'disponibilidad');
    if (input.contact !== undefined) data.contactJson = this.normalizeObject(input.contact, 'contacto');

    const assistedByAi = input.assistedByAi === true;
    const reviewStatus = this.normalizeReviewStatus(input.reviewStatus);

    return { data, assistedByAi, reviewStatus };
  }

  private normalizeFaqs(value: unknown): Prisma.InputJsonValue {
    if (!Array.isArray(value)) throw new BadRequestException('Las preguntas frecuentes deben ser una lista.');

    return value.map((item, index) => {
      const record = this.requireRecord(item, `pregunta frecuente ${index + 1}`);
      const title = this.requireText(record.title, `Título de la pregunta ${index + 1}`);
      const desc = this.requireText(record.desc, `Respuesta de la pregunta ${index + 1}`);
      return { title, desc, order: index };
    });
  }

  private normalizeItinerary(value: unknown): Prisma.InputJsonValue {
    if (!Array.isArray(value)) throw new BadRequestException('El itinerario debe ser una lista.');

    return value.map((item, index) => {
      const record = this.requireRecord(item, `paso de itinerario ${index + 1}`);
      return {
        title: this.requireText(record.title, `Título del paso ${index + 1}`),
        desc: this.requireText(record.desc, `Descripción del paso ${index + 1}`),
        time: this.optionalText(record.time),
        image: this.optionalText(record.image),
        order: index,
      };
    });
  }

  private normalizeStringList(value: unknown, label: string): Prisma.InputJsonValue {
    if (!Array.isArray(value)) throw new BadRequestException(`La lista de ${label} no es válida.`);
    return value.map((item, index) => this.requireText(item, `${label} ${index + 1}`));
  }

  private normalizeObject(value: unknown, label: string): Prisma.InputJsonValue {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`El bloque de ${label} no es válido.`);
    }
    return value as Prisma.InputJsonValue;
  }

  private normalizeReviewStatus(value: unknown): 'provisional' | 'reviewed' {
    if (value === undefined || value === null || value === '') return 'provisional';
    if (value === 'provisional' || value === 'reviewed') return value;
    throw new BadRequestException('El estado editorial debe ser provisional o reviewed.');
  }

  private mergeEditorialFlags(
    currentValue: Prisma.JsonValue | null,
    assistedByAi: boolean,
    reviewStatus: 'provisional' | 'reviewed',
  ): EditorialFlag[] {
    const managedCodes = new Set(['AI_ASSISTED_CONTENT', 'EDITORIAL_REVIEW_REQUIRED']);
    const current = Array.isArray(currentValue)
      ? currentValue.filter((item): item is EditorialFlag => {
          if (!item || Array.isArray(item) || typeof item !== 'object') return false;
          const code = (item as Record<string, unknown>).code;
          return typeof code === 'string' && !managedCodes.has(code);
        })
      : [];

    if (assistedByAi) {
      current.push({
        code: 'AI_ASSISTED_CONTENT',
        message: 'El contenido fue preparado con asistencia de inteligencia artificial.',
        severity: 'info',
      });
    }

    if (reviewStatus === 'provisional') {
      current.push({
        code: 'EDITORIAL_REVIEW_REQUIRED',
        message: 'El contenido es provisional y requiere validación editorial.',
        severity: 'warning',
      });
    }

    return current;
  }

  private toEditorialResponse(experience: Experience) {
    return {
      id: experience.id,
      slug: experience.slug,
      title: experience.title,
      faqs: this.jsonArray(experience.faqsJson),
      itinerary: this.jsonArray(experience.itineraryJson),
      included: this.jsonArray(experience.includedItemsJson),
      excluded: this.jsonArray(experience.excludedItemsJson),
      practicalInfo: this.jsonObject(experience.practicalInfoJson),
      availability: this.jsonObject(experience.availabilityJson),
      contact: this.jsonObject(experience.contactJson),
      editorialFlags: this.jsonArray(experience.editorialFlagsJson),
      updatedAt: experience.updatedAt.toISOString(),
    };
  }

  private jsonArray(value: Prisma.JsonValue | null) {
    return Array.isArray(value) ? value : [];
  }

  private jsonObject(value: Prisma.JsonValue | null) {
    return value && !Array.isArray(value) && typeof value === 'object' ? value : null;
  }

  private requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`El bloque ${label} no es válido.`);
    }
    return value as Record<string, unknown>;
  }

  private requireText(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${label} es obligatorio.`);
    }
    return value.trim();
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }
}
