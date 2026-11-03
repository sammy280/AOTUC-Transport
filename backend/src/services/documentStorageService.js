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
   * Securely saves an uploaded file buffer to disk and registers it in the database.
   */
  static async storeFile({ fileBuffer, originalName, declaredMime, category, uploadedByUserId, personId = null, vehicleId = null }) {
    // 1. Validate File Size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new AppError(
        'Le fichier dépasse la taille maximale autorisée de 5 Mo.',
        400,
        'FILE_TOO_LARGE'
      );
    }

    // 2. Validate MIME & Magic Bytes
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

    // 3. Compute SHA-256 Hash for Integrity & Deduplication
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 4. Generate Safe Server Filename
    const extension = path.extname(originalName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExtension = extension ? `.${extension}` : (declaredMime === 'application/pdf' ? '.pdf' : '.jpg');
    const safeServerFileName = `${crypto.randomUUID()}${safeExtension}`;
    const destinationPath = path.join(STORAGE_BASE_DIR, safeServerFileName);

    // 5. Write to Protected Storage
    await fs.promises.writeFile(destinationPath, fileBuffer, { mode: 0o600 });

    // 6. Record in Database
    const document = await prisma.document.create({
      data: {
        fileName: safeServerFileName,
        originalName: path.basename(originalName).substring(0, 255),
        mimeType: declaredMime,
        fileSizeBytes: fileBuffer.length,
        storagePath: destinationPath,
        fileHashSha256: hash,
        category,
        uploadedByUserId,
        personId,
        vehicleId,
      },
    });

    // 7. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: uploadedByUserId,
        action: 'DOCUMENT_UPLOADED',
        targetModule: 'DOCUMENTS',
        targetRecordId: document.id,
        newValues: { category, fileSizeBytes: fileBuffer.length, originalName },
      },
    });

    return document;
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
      },
    });

    if (!document) {
      throw new AppError('Document introuvable.', 404, 'DOCUMENT_NOT_FOUND');
    }

    // Authorization & Scope enforcement
    const isSuperAdminOrDirector = userContext.roles.includes('SUPER_ADMIN') || userContext.roles.includes('DIRECTOR');
    
    if (!isSuperAdminOrDirector) {
      // If user is CHEF_SERVICE or AGENT_TERRAIN, ensure document belongs to their assigned commune
      const docCommuneId = document.person?.communeId || document.vehicle?.owner?.person?.communeId;
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

    if (!fs.existsSync(document.storagePath)) {
      logger.error('Document record exists but file is missing on disk', { documentId, path: document.storagePath });
      throw new AppError('Fichier introuvable sur le serveur de stockage.', 404, 'FILE_MISSING_ON_DISK');
    }

    return document;
  }
}

export default DocumentStorageService;
