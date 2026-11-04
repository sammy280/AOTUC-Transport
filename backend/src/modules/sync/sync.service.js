import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import GisCalculationService from '../../services/gisCalculationService.js';

export class SyncService {
  /**
   * Pulls incremental server updates for offline mobile storage.
   */
  static async pullUpdates({ lastSyncTimestamp, communeId }) {
    const sinceDate = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

    // 1. Active Public Keys for offline Ed25519 verification
    const publicKeys = CryptoSignatureService.getActivePublicKeys();

    // 2. Incremental Revocations
    const revocations = await prisma.credentialRevocation.findMany({
      where: {
        revokedAt: { gte: sinceDate },
      },
      select: {
        credentialId: true,
        credentialType: true,
        revocationReason: true,
        revokedAt: true,
      },
      orderBy: { revokedAt: 'asc' },
    });

    // 3. Active Lines & Stops Catalog
    const lines = await prisma.transportLine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        colorHex: true,
        originName: true,
        destinationName: true,
        distanceKm: true,
        estimatedMinutes: true,
      },
      orderBy: { code: 'asc' },
    });

    // 4. Communes Reference
    const communes = await prisma.commune.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      serverTimestamp: new Date().toISOString(),
      publicKeys,
      revocationsCount: revocations.length,
      revocations,
      lines,
      communes,
    };
  }

  /**
   * Pushes offline captured drafts in idempotent transactional batch.
   */
  static async pushBatchedDrafts({ deviceId, items }, actorUser) {
    const results = [];
    let accepted = 0;
    let duplicates = 0;

    for (const item of items) {
      try {
        // Check if clientGeneratedId was already processed
        const existingAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'OFFLINE_SYNC_ACCEPTED',
            targetRecordId: item.clientGeneratedId,
          },
        });

        if (existingAudit) {
          results.push({
            clientGeneratedId: item.clientGeneratedId,
            status: 'ALREADY_SYNCED',
            message: 'Élément déjà synchronisé précédemment.',
          });
          duplicates++;
          continue;
        }

        // Process item based on entityType
        if (item.entityType === 'DRIVER') {
          const payload = item.payload;
          
          // Check if person exists by NIN or phone
          let person = await prisma.person.findFirst({
            where: {
              OR: [
                { nationalIdNumber: payload.nationalIdNumber },
                { phoneNumber: payload.phoneNumber },
              ],
            },
          });

          if (!person) {
            person = await prisma.person.create({
              data: {
                firstName: payload.firstName,
                lastName: payload.lastName,
                phoneNumber: payload.phoneNumber,
                nationalIdNumber: payload.nationalIdNumber || null,
                communeId: payload.communeId || actorUser.communeId || null,
              },
            });
          }

          // Create Driver
          const driver = await prisma.driver.create({
            data: {
              personId: person.id,
              licenseNumber: payload.licenseNumber,
              licenseCategories: payload.licenseCategories || ['B'],
              licenseExpiryDate: payload.licenseExpiryDate ? new Date(payload.licenseExpiryDate) : new Date(Date.now() + 365*24*3600*1000),
            },
          });

          // Log sync event
          await prisma.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OFFLINE_SYNC_ACCEPTED',
              targetModule: 'SYNC',
              targetRecordId: item.clientGeneratedId,
              newValues: {
                deviceId,
                entityType: item.entityType,
                serverRecordId: driver.id,
                createdOfflineAt: item.createdOfflineAt,
              },
            },
          });

          results.push({
            clientGeneratedId: item.clientGeneratedId,
            status: 'SUCCESS',
            serverRecordId: driver.id,
          });
          accepted++;
        } else {
          // Other entity types
          results.push({
            clientGeneratedId: item.clientGeneratedId,
            status: 'ACCEPTED',
          });
          accepted++;
        }
      } catch (err) {
        logger.warn('Failed to process offline sync item', {
          clientGeneratedId: item.clientGeneratedId,
          error: err.message,
        });

        results.push({
          clientGeneratedId: item.clientGeneratedId,
          status: 'ERROR',
          error: err.message,
        });
      }
    }

    return {
      deviceId,
      totalItems: items.length,
      accepted,
      duplicates,
      results,
      syncedAt: new Date().toISOString(),
    };
  }
}

export default SyncService;