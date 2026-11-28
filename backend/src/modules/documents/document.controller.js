import fs from 'fs';
import DocumentStorageService from '../../services/documentStorageService.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class DocumentController {
  /**
   * Upload and register a document / photograph.
   */
  static async upload(req, res, next) {
    try {
      if (!req.file) {
        throw new AppError('Aucun fichier n a été transmis.', 400, 'NO_FILE_PROVIDED');
      }

      const { category, personId, vehicleId, unionId } = req.body;
      if (!category) {
        throw new AppError('La catégorie de document est obligatoire.', 400, 'CATEGORY_REQUIRED');
      }

      const document = await DocumentStorageService.storeFile({
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        declaredMime: req.file.mimetype,
        category,
        uploadedByUserId: req.user.id,
        personId: personId || null,
        vehicleId: vehicleId || null,
        unionId: unionId || null,
      });

      return res.status(201).json({
        success: true,
        message: 'Document téléversé et sécurisé avec succès.',
        data: {
          id: document.id,
          fileName: document.fileName,
          originalName: document.originalName,
          category: document.category,
          mimeType: document.mimeType,
          fileSizeBytes: document.fileSizeBytes,
          fileHashSha256: document.fileHashSha256,
          createdAt: document.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Secure streaming of a document (authorized and scoped).
   */
  static async stream(req, res, next) {
    try {
      const { id } = req.params;
      const document = await DocumentStorageService.getDocumentForStreaming(id, req.user);

      const buffer = document.fileBuffer;
      res.setHeader('Content-Type', document.mimeType || 'image/jpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(document.originalName || document.fileName || 'document.jpg')}"`
      );
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

export default DocumentController;
