import prisma from '../../utils/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import logger from '../../utils/logger.js';

export class UnionService {
  /**
   * Register a new transport union (Syndicat).
   * Enforces server-side duplicate prevention for name, acronym (code), and official registration number.
   */
  static async createUnion(actorUser, data) {
    const trimmedName = data.name.trim();
    const trimmedCode = data.code.trim().toUpperCase();
    const trimmedRegNum = data.registrationNumber ? data.registrationNumber.trim() : null;

    // 1. Check duplicate official name (case-insensitive)
    const existingByName = await prisma.transportUnion.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });
    if (existingByName) {
      throw new AppError(
        `Un syndicat ou organisation portant le nom « ${trimmedName} » existe déjà.`,
        409,
        'DUPLICATE_UNION_NAME'
      );
    }

    // 2. Check duplicate acronym / code (case-insensitive)
    const existingByCode = await prisma.transportUnion.findFirst({
      where: {
        code: { equals: trimmedCode, mode: 'insensitive' },
      },
    });
    if (existingByCode) {
      throw new AppError(
        `Le sigle « ${trimmedCode} » est déjà attribué à un autre syndicat.`,
        409,
        'DUPLICATE_UNION_CODE'
      );
    }

    // 3. Check duplicate registration/agrément number if provided
    if (trimmedRegNum) {
      const existingByReg = await prisma.transportUnion.findFirst({
        where: {
          registrationNumber: { equals: trimmedRegNum, mode: 'insensitive' },
        },
      });
      if (existingByReg) {
        throw new AppError(
          `Le numéro d'agrément / récépissé « ${trimmedRegNum} » est déjà enregistré.`,
          409,
          'DUPLICATE_UNION_REGISTRATION_NUMBER'
        );
      }
    }

    // 4. Validate commune if specified
    if (data.communeId) {
      const communeExists = await prisma.commune.findUnique({
        where: { id: data.communeId },
      });
      if (!communeExists) {
        throw new AppError('La commune de rattachement spécifiée est introuvable.', 404, 'COMMUNE_NOT_FOUND');
      }
    }

    // 5. Create Union record
    const hasGps = data.latitude !== undefined && data.latitude !== null && data.longitude !== undefined && data.longitude !== null;

    const union = await prisma.transportUnion.create({
      data: {
        name: trimmedName,
        code: trimmedCode,
        registrationNumber: trimmedRegNum,
        presidentName: data.presidentName ? data.presidentName.trim() : null,
        contactPhone: data.contactPhone ? data.contactPhone.trim() : null,
        contactEmail: data.contactEmail ? data.contactEmail.trim().toLowerCase() : null,
        headquartersAddress: data.headquartersAddress ? data.headquartersAddress.trim() : null,
        communeId: data.communeId || null,
        logoUrl: data.logoUrl ? data.logoUrl.trim() : null,
        latitude: hasGps ? Number(data.latitude) : null,
        longitude: hasGps ? Number(data.longitude) : null,
        gpsCapturedAt: hasGps ? new Date() : null,
        registeredByUserId: actorUser.id,
        status: data.status || 'ACTIF',
      },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        _count: {
          select: { members: true, owners: true, users: true },
        },
      },
    });

    // 6. Security Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'UNION_CREATED',
          targetModule: 'UNIONS',
          targetRecordId: union.id,
          newValues: {
            code: union.code,
            name: union.name,
            registrationNumber: union.registrationNumber,
            status: union.status,
            communeId: union.communeId,
          },
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record UNION_CREATED audit log', { error: auditErr.message });
    }

    logger.info(`Syndicat « ${union.code} — ${union.name} » registered by user ${actorUser.email || actorUser.id}`);
    return union;
  }

  /**
   * List unions with search, status filtering, and pagination.
   */
  static async listUnions(actorUser, query = {}) {
    const { search = '', status, communeId, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(communeId ? { communeId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { registrationNumber: { contains: search, mode: 'insensitive' } },
              { presidentName: { contains: search, mode: 'insensitive' } },
              { contactPhone: { contains: search, mode: 'insensitive' } },
              { headquartersAddress: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.transportUnion.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: {
          commune: { select: { id: true, code: true, name: true } },
          _count: {
            select: { members: true, owners: true, users: true },
          },
        },
      }),
      prisma.transportUnion.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single union by ID with its affiliated drivers, owners, and official documents.
   */
  static async getUnionById(actorUser, id) {
    const union = await prisma.transportUnion.findUnique({
      where: { id },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        _count: {
          select: { members: true, owners: true, users: true, documents: true },
        },
        members: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nin: true,
                phoneNumber: true,
                documents: { where: { category: 'PHOTO_PORTRAIT' }, take: 1 },
                commune: { select: { id: true, name: true } },
              },
            },
          },
        },
        owners: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nin: true,
                phoneNumber: true,
                commune: { select: { id: true, name: true } },
              },
            },
          },
        },
        documents: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            category: true,
            createdAt: true,
          },
        },
      },
    });

    if (!union) {
      throw new AppError('Syndicat ou organisation professionnelle introuvable.', 404, 'UNION_NOT_FOUND');
    }

    return union;
  }

  /**
   * Update union details.
   */
  static async updateUnion(actorUser, id, data) {
    const existing = await prisma.transportUnion.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Syndicat ou organisation professionnelle introuvable.', 404, 'UNION_NOT_FOUND');
    }

    // Check duplicate name
    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicateName = await prisma.transportUnion.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name.trim(), mode: 'insensitive' },
        },
      });
      if (duplicateName) {
        throw new AppError(`Un syndicat portant le nom « ${data.name.trim()} » existe déjà.`, 409, 'DUPLICATE_UNION_NAME');
      }
    }

    // Check duplicate code
    if (data.code && data.code.trim().toUpperCase() !== existing.code.toUpperCase()) {
      const duplicateCode = await prisma.transportUnion.findFirst({
        where: {
          id: { not: id },
          code: { equals: data.code.trim().toUpperCase(), mode: 'insensitive' },
        },
      });
      if (duplicateCode) {
        throw new AppError(`Le sigle « ${data.code.trim().toUpperCase()} » est déjà utilisé par un autre syndicat.`, 409, 'DUPLICATE_UNION_CODE');
      }
    }

    // Check duplicate registrationNumber
    if (data.registrationNumber && data.registrationNumber.trim()) {
      const duplicateReg = await prisma.transportUnion.findFirst({
        where: {
          id: { not: id },
          registrationNumber: { equals: data.registrationNumber.trim(), mode: 'insensitive' },
        },
      });
      if (duplicateReg) {
        throw new AppError(`Le numéro d'agrément « ${data.registrationNumber.trim()} » est déjà enregistré.`, 409, 'DUPLICATE_UNION_REGISTRATION_NUMBER');
      }
    }

    if (data.communeId) {
      const communeExists = await prisma.commune.findUnique({
        where: { id: data.communeId },
      });
      if (!communeExists) {
        throw new AppError('La commune spécifiée est introuvable.', 404, 'COMMUNE_NOT_FOUND');
      }
    }

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.code !== undefined) updatePayload.code = data.code.trim().toUpperCase();
    if (data.registrationNumber !== undefined) updatePayload.registrationNumber = data.registrationNumber ? data.registrationNumber.trim() : null;
    if (data.presidentName !== undefined) updatePayload.presidentName = data.presidentName ? data.presidentName.trim() : null;
    if (data.contactPhone !== undefined) updatePayload.contactPhone = data.contactPhone ? data.contactPhone.trim() : null;
    if (data.contactEmail !== undefined) updatePayload.contactEmail = data.contactEmail ? data.contactEmail.trim().toLowerCase() : null;
    if (data.headquartersAddress !== undefined) updatePayload.headquartersAddress = data.headquartersAddress ? data.headquartersAddress.trim() : null;
    if (data.communeId !== undefined) updatePayload.communeId = data.communeId || null;
    if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl ? data.logoUrl.trim() : null;
    if (data.latitude !== undefined) updatePayload.latitude = data.latitude !== null ? Number(data.latitude) : null;
    if (data.longitude !== undefined) updatePayload.longitude = data.longitude !== null ? Number(data.longitude) : null;
    if (data.status !== undefined) updatePayload.status = data.status;

    const updated = await prisma.transportUnion.update({
      where: { id },
      data: updatePayload,
      include: {
        commune: { select: { id: true, code: true, name: true } },
        _count: {
          select: { members: true, owners: true, users: true },
        },
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'UNION_UPDATED',
          targetModule: 'UNIONS',
          targetRecordId: id,
          previousValues: {
            code: existing.code,
            name: existing.name,
            status: existing.status,
            registrationNumber: existing.registrationNumber,
          },
          newValues: updatePayload,
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record UNION_UPDATED audit log', { error: auditErr.message });
    }

    return updated;
  }

  /**
   * Update union lifecycle status (ACTIF, SUSPENDU, REJETE, EN_ATTENTE_VALIDATION).
   */
  static async updateUnionStatus(actorUser, id, { status, reason }) {
    const existing = await prisma.transportUnion.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new AppError('Syndicat ou organisation professionnelle introuvable.', 404, 'UNION_NOT_FOUND');
    }

    const previousStatus = existing.status;
    const updated = await prisma.transportUnion.update({
      where: { id },
      data: { status },
      include: {
        commune: { select: { id: true, code: true, name: true } },
        _count: {
          select: { members: true, owners: true, users: true },
        },
      },
    });

    // Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'UNION_STATUS_CHANGED',
          targetModule: 'UNIONS',
          targetRecordId: id,
          previousValues: { status: previousStatus },
          newValues: { status, reason: reason || null },
          reason: reason || `Statut modifié de ${previousStatus} à ${status}`,
        },
      });
    } catch (auditErr) {
      logger.warn('Failed to record UNION_STATUS_CHANGED audit log', { error: auditErr.message });
    }

    logger.info(`Union ${existing.code} status changed from ${previousStatus} to ${status} by ${actorUser.email || actorUser.id}`);
    return updated;
  }
}

export default UnionService;
