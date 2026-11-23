import prisma from '../../utils/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import logger from '../../utils/logger.js';
import DocumentStorageService from '../../services/documentStorageService.js';

function validateInlineDocuments(documents, actorUserId) {
  if (!Array.isArray(documents) || documents.length === 0) return;

  for (const doc of documents) {
    if (!doc.base64Data || !doc.category) continue;
    const cleanBase64 = doc.base64Data.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    DocumentStorageService.validateFileBuffer({
      fileBuffer,
      originalName: doc.originalName || `${doc.category.toLowerCase()}.jpg`,
      declaredMime: doc.mimeType || 'image/jpeg',
      expectedSha256: doc.fileHashSha256 || null,
      uploadedByUserId: actorUserId,
    });
  }
}

async function saveInlineDocuments(documents, { actorUserId, authorityId }) {
  if (!Array.isArray(documents) || documents.length === 0) return [];
  const saved = [];
  for (const doc of documents) {
    if (!doc.base64Data || !doc.category) continue;
    const cleanBase64 = doc.base64Data.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const record = await DocumentStorageService.storeFile({
      fileBuffer,
      originalName: doc.originalName || `${doc.category.toLowerCase()}.jpg`,
      declaredMime: doc.mimeType || 'image/jpeg',
      category: doc.category,
      uploadedByUserId: actorUserId,
      authorityId,
      expectedSha256: doc.fileHashSha256 || null,
    });
    saved.push(record);
  }
  return saved;
}

export class AuthorityService {
  /**
   * Register a new administrative authority.
   * Authorized for SUPER_ADMIN and DIRECTOR.
   */
  static async createAuthority(actorUser, data) {
    const fullName = data.fullName.trim();
    const fonction = data.fonction.trim();
    const institution = data.institution.trim();
    const service = data.service ? data.service.trim() : null;
    const phoneNumber = data.phoneNumber ? data.phoneNumber.trim() : null;
    const email = data.email ? data.email.trim().toLowerCase() : null;
    const cniNumber = data.cniNumber ? data.cniNumber.trim() : null;
    const badgeNumber = data.badgeNumber ? data.badgeNumber.trim() : null;
    const notes = data.notes ? data.notes.trim() : null;
    const status = data.status || 'ACTIF';
    const communeId = data.communeId || null;
    let photoUrl = data.photoUrl || null;

    // Validate commune exists if provided
    if (communeId) {
      const commune = await prisma.commune.findUnique({ where: { id: communeId } });
      if (!commune) {
        throw new AppError('La commune spécifiée est introuvable.', 404, 'COMMUNE_NOT_FOUND');
      }
    }

    // Validate inline documents if provided
    if (data.documents && Array.isArray(data.documents)) {
      validateInlineDocuments(data.documents, actorUser.id);
    }

    // Create Authority record
    const authority = await prisma.authority.create({
      data: {
        fullName,
        fonction,
        institution,
        service,
        phoneNumber,
        email,
        cniNumber,
        badgeNumber,
        notes,
        status,
        communeId,
        registeredByUserId: actorUser.id,
        photoUrl,
      },
      include: {
        commune: true,
        registeredByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Save inline documents
    if (data.documents && Array.isArray(data.documents) && data.documents.length > 0) {
      const savedDocs = await saveInlineDocuments(data.documents, {
        actorUserId: actorUser.id,
        authorityId: authority.id,
      });

      // If photo portrait was saved and photoUrl wasn't set or was base64, set URL to document route
      const portrait = savedDocs.find((d) => d.category === 'PHOTO_PORTRAIT');
      if (portrait && (!photoUrl || photoUrl.startsWith('data:'))) {
        photoUrl = `/api/v1/documents/${portrait.id}/view`;
        await prisma.authority.update({
          where: { id: authority.id },
          data: { photoUrl },
        });
      }
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'AUTHORITY_REGISTERED',
          targetModule: 'AUTHORITIES',
          targetRecordId: authority.id,
          newValues: {
            fullName,
            fonction,
            institution,
            communeId,
            status,
          },
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to create audit log for authority registration: ${auditErr.message}`);
    }

    logger.info(`Authority registered: ${fullName} (${fonction} - ${institution}) by user ${actorUser.id}`);

    return this.getAuthorityById(authority.id);
  }

  /**
   * Get authority by ID with all relations.
   */
  static async getAuthorityById(authorityId) {
    const authority = await prisma.authority.findUnique({
      where: { id: authorityId },
      include: {
        commune: true,
        registeredByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            fileSizeBytes: true,
            category: true,
            createdAt: true,
          },
        },
      },
    });

    if (!authority) {
      throw new AppError('Autorité administrative introuvable.', 404, 'AUTHORITY_NOT_FOUND');
    }

    return authority;
  }

  /**
   * List authorities with filtering, search, and pagination.
   */
  static async listAuthorities(query = {}) {
    const {
      search,
      communeId,
      status,
      institution,
      page = 1,
      limit = 20,
    } = query;

    const where = {};

    if (communeId) {
      where.communeId = communeId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (institution) {
      where.institution = { contains: institution, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { fonction: { contains: term, mode: 'insensitive' } },
        { institution: { contains: term, mode: 'insensitive' } },
        { badgeNumber: { contains: term, mode: 'insensitive' } },
        { phoneNumber: { contains: term, mode: 'insensitive' } },
        { cniNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.authority.count({ where });

    const authorities = await prisma.authority.findMany({
      where,
      include: {
        commune: true,
        registeredByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        documents: {
          select: {
            id: true,
            category: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            fileSizeBytes: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      authorities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update an existing authority.
   */
  static async updateAuthority(authorityId, actorUser, data) {
    const existing = await prisma.authority.findUnique({ where: { id: authorityId } });
    if (!existing) {
      throw new AppError('Autorité administrative introuvable.', 404, 'AUTHORITY_NOT_FOUND');
    }

    // Validate commune exists if provided
    if (data.communeId) {
      const commune = await prisma.commune.findUnique({ where: { id: data.communeId } });
      if (!commune) {
        throw new AppError('La commune spécifiée est introuvable.', 404, 'COMMUNE_NOT_FOUND');
      }
    }

    // Validate inline documents if provided
    if (data.documents && Array.isArray(data.documents)) {
      validateInlineDocuments(data.documents, actorUser.id);
    }

    const updatePayload = {};
    if (data.fullName !== undefined) updatePayload.fullName = data.fullName.trim();
    if (data.fonction !== undefined) updatePayload.fonction = data.fonction.trim();
    if (data.institution !== undefined) updatePayload.institution = data.institution.trim();
    if (data.service !== undefined) updatePayload.service = data.service ? data.service.trim() : null;
    if (data.phoneNumber !== undefined) updatePayload.phoneNumber = data.phoneNumber ? data.phoneNumber.trim() : null;
    if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.cniNumber !== undefined) updatePayload.cniNumber = data.cniNumber ? data.cniNumber.trim() : null;
    if (data.badgeNumber !== undefined) updatePayload.badgeNumber = data.badgeNumber ? data.badgeNumber.trim() : null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.communeId !== undefined) updatePayload.communeId = data.communeId || null;
    if (data.notes !== undefined) updatePayload.notes = data.notes ? data.notes.trim() : null;
    if (data.photoUrl !== undefined) updatePayload.photoUrl = data.photoUrl || null;

    await prisma.authority.update({
      where: { id: authorityId },
      data: updatePayload,
    });

    // Save inline documents if provided
    if (data.documents && Array.isArray(data.documents) && data.documents.length > 0) {
      const savedDocs = await saveInlineDocuments(data.documents, {
        actorUserId: actorUser.id,
        authorityId,
      });

      const portrait = savedDocs.find((d) => d.category === 'PHOTO_PORTRAIT');
      if (portrait && (!updatePayload.photoUrl || updatePayload.photoUrl.startsWith('data:'))) {
        await prisma.authority.update({
          where: { id: authorityId },
          data: { photoUrl: `/api/v1/documents/${portrait.id}/view` },
        });
      }
    }

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'AUTHORITY_UPDATED',
          targetModule: 'AUTHORITIES',
          targetRecordId: authorityId,
          previousValues: {
            fullName: existing.fullName,
            fonction: existing.fonction,
            institution: existing.institution,
            status: existing.status,
          },
          newValues: updatePayload,
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to create audit log for authority update: ${auditErr.message}`);
    }

    return this.getAuthorityById(authorityId);
  }

  /**
   * Delete an authority record.
   */
  static async deleteAuthority(authorityId, actorUser) {
    const existing = await prisma.authority.findUnique({ where: { id: authorityId } });
    if (!existing) {
      throw new AppError('Autorité administrative introuvable.', 404, 'AUTHORITY_NOT_FOUND');
    }

    await prisma.authority.delete({ where: { id: authorityId } });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'AUTHORITY_DELETED',
          targetModule: 'AUTHORITIES',
          targetRecordId: authorityId,
          previousValues: {
            fullName: existing.fullName,
            fonction: existing.fonction,
            institution: existing.institution,
          },
        },
      });
    } catch (auditErr) {
      logger.warn(`Failed to create audit log for authority deletion: ${auditErr.message}`);
    }

    return { message: 'Autorité administrative supprimée avec succès.' };
  }

  /**
   * Summary KPIs for the Director General dashboard widget.
   */
  static async getAuthoritiesKpis() {
    const total = await prisma.authority.count();
    const active = await prisma.authority.count({ where: { status: 'ACTIF' } });
    const pending = await prisma.authority.count({ where: { status: 'EN_ATTENTE_VALIDATION' } });
    const suspended = await prisma.authority.count({ where: { status: 'SUSPENDU' } });

    // Distinct institutions count
    const authorities = await prisma.authority.findMany({
      select: { institution: true, commune: { select: { name: true } } },
    });

    const institutions = new Set(authorities.map((a) => a.institution.trim()));

    // Recent 5 authorities
    const recent = await prisma.authority.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { commune: true },
    });

    return {
      total,
      active,
      pending,
      suspended,
      institutionsCount: institutions.size,
      recent,
    };
  }
}

export default AuthorityService;
