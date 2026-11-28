import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { AppError } from '../middlewares/errorHandler.js';

// Base storage directory outside public web root
const STORAGE_BASE_DIR = path.resolve(process.env.STORAGE_DIR || './storage/documents');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_BASE_DIR)) {
  fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true, mode: 0o700 });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates actual binary content (magic numbers) against claimed MIME type.
 * Prevents malicious executable masquerading as an image or PDF.
 */
function verifyMagicBytes(buffer, declaredMime) {
  if (!buffer || buffer.length < 8) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return declaredMime === 'image/jpeg' || declaredMime === 'image/jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return declaredMime === 'image/png';
  }

  // PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return declaredMime === 'application/pdf';
  }

  return false;
}

export class DocumentStorageService {
  /**
   * Validates file size, magic bytes, and optional expected SHA-256 hash before DB writes.
   */
  static validateFileBuffer({
    fileBuffer,
    declaredMime,
    originalName = 'document',
    expectedSha256 = null,
    uploadedByUserId = null,
  }) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError(
        'Le fichier transmis est vide.',
        400,
        'EMPTY_FILE_BUFFER'
      );
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new AppError(
        'Le fichier dépasse la taille maximale autorisée de 5 Mo.',
        400,
        'FILE_TOO_LARGE'
      );
    }

    const isAuthentic = verifyMagicBytes(fileBuffer, declaredMime);
    if (!isAuthentic) {
      logger.warn('File upload rejected: magic bytes mismatch', {
        originalName,
        declaredMime,
        uploadedByUserId,
      });
      throw new AppError(
        'Le contenu du fichier ne correspond pas au type déclaré ou est corrompu.',
        400,
        'INVALID_FILE_SIGNATURE'
      );
    }

    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (
      expectedSha256 &&
      String(expectedSha256).trim().toLowerCase() !== hash
    ) {
      logger.warn('File upload rejected: SHA-256 integrity mismatch', {
        originalName,
        expectedSha256,
        actualHash: hash,
      });
      throw new AppError(
        'Intégrité du document compromise : l empreinte SHA-256 ne correspond pas au fichier transmis.',
        400,
        'DOCUMENT_INTEGRITY_MISMATCH'
      );
    }

    return hash;
  }

  /**
   * Securely saves an uploaded file buffer to disk and registers it in the database.
   */
  static async storeFile({
    fileBuffer,
    originalName,
    declaredMime,
    category,
    uploadedByUserId,
    personId = null,
    vehicleId = null,
    unionId = null,
    authorityId = null,
    expectedSha256 = null,
  }) {
    // 1–3. Validate Size, Magic Bytes & SHA-256 Integrity
    const hash = DocumentStorageService.validateFileBuffer({
      fileBuffer,
      declaredMime,
      originalName,
      expectedSha256,
      uploadedByUserId,
    });

    // 4. Generate Safe Server Filename
    const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExtension = extension ? `.${extension}` : (declaredMime === 'application/pdf' ? '.pdf' : '.jpg');
    const safeServerFileName = `${crypto.randomUUID()}${safeExtension}`;
    const destinationPath = path.join(STORAGE_BASE_DIR, safeServerFileName);

    // 5. Write to local disk cache (best-effort) AND persist as Data URI in PostgreSQL
    // so uploaded portraits and documents survive ephemeral container restarts (Render).
    try {
      await fs.promises.writeFile(destinationPath, fileBuffer, { mode: 0o600 });
    } catch (diskErr) {
      logger.warn('Could not write local cache copy of document; relying on PostgreSQL persistence', {
        destinationPath,
        error: diskErr?.message,
      });
    }

    const persistentDataUri = `data:${declaredMime};base64,${fileBuffer.toString('base64')}`;

    // 6. Record in Database
    const document = await prisma.document.create({
      data: {
        fileName: safeServerFileName,
        originalName: path.basename(originalName).substring(0, 255),
        mimeType: declaredMime,
        fileSizeBytes: fileBuffer.length,
        storagePath: persistentDataUri,
        fileHashSha256: hash,
        category,
        uploadedByUserId,
        personId,
        vehicleId,
        unionId,
        authorityId,
      },
    });

    // 7. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: uploadedByUserId,
        action: 'DOCUMENT_UPLOADED',
        targetModule: 'DOCUMENTS',
        targetRecordId: document.id,
        newValues: { category, fileSizeBytes: fileBuffer.length, originalName, unionId, authorityId },
      },
    });

    return document;
  }

  /**
   * Resolves a document's binary Buffer from either its persistent PostgreSQL Data URI (storagePath)
   * or its local disk path / STORAGE_BASE_DIR fallback.
   */
  static resolveDocumentBuffer(document) {
    if (!document) return null;

    // 1. Persistent PostgreSQL Data URI stored in storagePath
    if (typeof document.storagePath === 'string' && document.storagePath.startsWith('data:')) {
      const commaIdx = document.storagePath.indexOf(';base64,');
      if (commaIdx !== -1) {
        const b64 = document.storagePath.slice(commaIdx + 8);
        try {
          const buf = Buffer.from(b64, 'base64');
          if (buf.length > 0) return buf;
        } catch (_) {}
      }
    }

    // 2. Local filesystem fallback (exact storagePath)
    if (typeof document.storagePath === 'string' && !document.storagePath.startsWith('data:')) {
      try {
        if (fs.existsSync(document.storagePath)) {
          const buf = fs.readFileSync(document.storagePath);
          if (buf.length > 0) return buf;
        }
      } catch (_) {}
    }

    // 3. Local STORAGE_BASE_DIR fallback by fileName
    if (typeof document.fileName === 'string' && document.fileName.trim()) {
      const candidatePath = path.join(STORAGE_BASE_DIR, path.basename(document.fileName));
      try {
        if (fs.existsSync(candidatePath)) {
          const buf = fs.readFileSync(candidatePath);
          if (buf.length > 0) return buf;
        }
      } catch (_) {}
    }

    return null;
  }

  /**
   * Resolves a document as a ready-to-render base64 Data URL (`data:<mime>;base64,...`),
   * or null if the binary content is unavailable.
   */
  static resolveDocumentDataUrl(document) {
    if (!document) return null;
    const buffer = DocumentStorageService.resolveDocumentBuffer(document);
    if (!buffer || buffer.length === 0) return null;
    const mime = document.mimeType || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  /**
   * Retrieves a document by ID with authorization and scope checks.
   */
  static async getDocumentForStreaming(documentId, userContext) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        person: true,
        vehicle: {
          include: {
            owner: { include: { person: true } },
          },
        },
        union: true,
      },
    });

    if (!document) {
      throw new AppError('Document introuvable.', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Authorization & Scope enforcement
    const userRoles = userContext?.roles || [];
    const isGlobalAuthority =
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('DIRECTOR') ||
      userRoles.includes('IT');

    if (!isGlobalAuthority) {
      // If user is CHEF_SERVICE or AGENT_TERRAIN, ensure document belongs to their assigned commune
      const docCommuneId =
        document.person?.communeId ||
        document.vehicle?.owner?.person?.communeId ||
        document.union?.communeId;
      if (docCommuneId && userContext.communeId && docCommuneId !== userContext.communeId) {
        logger.warn('Forbidden document access attempt across communes', {
          userId: userContext.id,
          userCommune: userContext.communeId,
          docCommune: docCommuneId,
          documentId,
        });
        throw new AppError(
          'Accès refusé. Ce document relève d une autre commune.',
          403,
          'FORBIDDEN_DOCUMENT_SCOPE'
        );
      }
    }

    const fileBuffer = DocumentStorageService.resolveDocumentBuffer(document);
    if (!fileBuffer) {
      logger.error('Document record exists but file is missing on disk and in DB', {
        documentId,
        path: document.storagePath,
      });
      throw new AppError(
        'Fichier introuvable sur le serveur de stockage.',
        404,
        'FILE_MISSING_ON_DISK'
      );
    }

    return {
      ...document,
      fileBuffer,
    };
  }
}

export default DocumentStorageService;
