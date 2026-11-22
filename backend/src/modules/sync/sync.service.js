import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import CryptoSignatureService from '../../services/cryptoSignatureService.js';
import DocumentStorageService from '../../services/documentStorageService.js';
import { normalizeGuineanPhone } from '../registration/registration.schemas.js';

/**
 * Helper to resolve communeId from either a UUID, a commune code (e.g. 'MTT'), or commune name (e.g. 'Matoto').
 */
async function resolveCommuneId(rawCommune, fallbackCommuneId = null) {
  if (!rawCommune) return fallbackCommuneId || null;
  const trimmed = String(rawCommune).trim();
  if (!trimmed) return fallbackCommuneId || null;

  const upper = trimmed.toUpperCase();
  const slugStripped = upper.replace(/^(COMM-|CM-)/, '');

  const found = await prisma.commune.findFirst({
    where: {
      OR: [
        { id: trimmed },
        { code: { equals: trimmed, mode: 'insensitive' } },
        { code: { equals: slugStripped, mode: 'insensitive' } },
        { name: { equals: trimmed, mode: 'insensitive' } },
        { name: { equals: slugStripped, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  return found ? found.id : fallbackCommuneId || null;
}

const ENTITY_SYNC_PRIORITY = {
  OWNER: 1,
  DRIVER: 2,
  VEHICLE: 3,
  DOCUMENT: 4,
};

/**
 * Pre-validates inline base64 documents (size, magic bytes, optional SHA-256 hash)
 * BEFORE starting any database transaction so invalid/corrupted documents do not leave partial records.
 */
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

/**
 * Helper to process inline base64 documents attached to an offline registration draft.
 */
async function storeInlineDocuments(documents, { actorUserId, personId = null, vehicleId = null }) {
  if (!Array.isArray(documents) || documents.length === 0) return [];
  const savedDocs = [];

  for (const doc of documents) {
    if (!doc.base64Data || !doc.category) continue;
    const cleanBase64 = doc.base64Data.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    const saved = await DocumentStorageService.storeFile({
      fileBuffer,
      originalName: doc.originalName || `${doc.category.toLowerCase()}.jpg`,
      declaredMime: doc.mimeType || 'image/jpeg',
      category: doc.category,
      uploadedByUserId: actorUserId,
      personId,
      vehicleId,
      expectedSha256: doc.fileHashSha256 || null,
    });
    savedDocs.push(saved.id);
  }

  return savedDocs;
}

export class SyncService {
  /**
   * Pulls incremental server updates for offline mobile storage.
   */
  static async pullUpdates({ lastSyncTimestamp, communeId }) {
    const sinceDate = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

    // 1. Active Public Keys for offline Ed25519 verification
    const publicKeys = CryptoSignatureService.getActivePublicKeys();

    // 2. Incremental Revocations (using actual Prisma schema field `reason`)
    const rawRevocations = await prisma.credentialRevocation.findMany({
      where: {
        revokedAt: { gte: sinceDate },
      },
      select: {
        id: true,
        credentialId: true,
        serialNumber: true,
        credentialType: true,
        reason: true,
        isPermanent: true,
        revokedAt: true,
      },
      orderBy: { revokedAt: 'asc' },
    });

    const revocations = rawRevocations.map((r) => ({
      id: r.id,
      credentialId: r.credentialId,
      serialNumber: r.serialNumber,
      credentialType: r.credentialType,
      reason: r.reason || r.revocationReason || 'Révoqué',
      revocationReason: r.reason || r.revocationReason || 'Révoqué',
      isPermanent: r.isPermanent ?? true,
      revokedAt: r.revokedAt,
    }));

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
      select: { id: true, code: true, name: true, description: true, administrativeOrigin: true },
      orderBy: { name: 'asc' },
    });

    // 5. Partner Transport Unions Reference
    let unions = [];
    try {
      unions = await prisma.transportUnion.findMany({
        where: { status: { in: ['ACTIF', 'EN_ATTENTE_VALIDATION'] } },
        select: {
          id: true,
          code: true,
          name: true,
          registrationNumber: true,
          status: true,
          communeId: true,
        },
        orderBy: { code: 'asc' },
      });
    } catch (_) {
      unions = [];
    }

    // 6. Active Field Assignments (Phase 6)
    let fieldAssignments = [];
    try {
      fieldAssignments = await prisma.fieldAssignment.findMany({
        where: {
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
          ...(communeId ? { communeId } : {}),
        },
        select: {
          id: true,
          reference: true,
          title: true,
          communeId: true,
          locationName: true,
          latitude: true,
          longitude: true,
          assignedUserId: true,
          startDate: true,
          endDate: true,
          targetPeople: true,
          targetVehicles: true,
          instructions: true,
          status: true,
        },
        orderBy: { startDate: 'desc' },
      });
    } catch (_) {
      fieldAssignments = [];
    }

    return {
      serverTimestamp: new Date().toISOString(),
      publicKeys,
      revocationsCount: revocations.length,
      revocations,
      lines,
      communes,
      unions,
      fieldAssignments,
    };
  }

  /**
   * Pushes offline captured drafts (DRIVER, OWNER, VEHICLE, DOCUMENT) to PostgreSQL
   * with idempotency, duplicate/conflict detection, GPS persistence, and detailed per-item results.
   */
  static async pushBatchedDrafts({ deviceId, items }, actorUser) {
    let accepted = 0;
    let duplicates = 0;
    let conflicts = 0;
    let failed = 0;

    // Map of clientGeneratedId -> serverRecordId resolved during this batch
    const clientToServerIdMap = new Map();
    // Map of clientGeneratedId -> personId resolved during this batch (for DRIVER / OWNER)
    const clientToPersonIdMap = new Map();

    // Sort items by dependency order: OWNER (1) -> DRIVER (2) -> VEHICLE (3) -> DOCUMENT (4)
    // while tracking original index so the returned `results` array matches input order.
    const indexedItems = items.map((item, originalIndex) => ({ item, originalIndex }));
    indexedItems.sort((a, b) => {
      const pA = ENTITY_SYNC_PRIORITY[a.item.entityType] || 99;
      const pB = ENTITY_SYNC_PRIORITY[b.item.entityType] || 99;
      if (pA !== pB) return pA - pB;
      return a.originalIndex - b.originalIndex;
    });

    const resultsByIndex = new Array(items.length);

    for (const { item, originalIndex } of indexedItems) {
      const { clientGeneratedId, entityType, payload = {}, createdOfflineAt } = item;
      const offlineDate = createdOfflineAt ? new Date(createdOfflineAt) : new Date();
      const pushResult = (resObj) => {
        resultsByIndex[originalIndex] = resObj;
      };

      try {
        // 1. Idempotency check: was this exact clientGeneratedId already processed?
        const existingAudit = await prisma.auditLog.findFirst({
          where: {
            action: 'OFFLINE_SYNC_ACCEPTED',
            targetRecordId: clientGeneratedId,
          },
        });

        if (existingAudit) {
          const prevServerId = existingAudit.newValues?.serverRecordId || null;
          const prevPersonId = existingAudit.newValues?.personId || null;
          if (prevServerId) {
            clientToServerIdMap.set(clientGeneratedId, prevServerId);
          }
          if (prevPersonId) {
            clientToPersonIdMap.set(clientGeneratedId, prevPersonId);
          }
          pushResult({
            clientGeneratedId,
            entityType,
            status: 'ALREADY_SYNCED',
            serverRecordId: prevServerId,
            personId: prevPersonId,
            message: 'Élément déjà synchronisé précédemment (idempotence garantie).',
          });
          duplicates++;
          continue;
        }

        // Resolve communeId from payload.communeId, payload.commune, or actorUser.communeId
        const resolvedCommuneId = await resolveCommuneId(
          payload.communeId || payload.commune,
          actorUser.communeId
        );

        // Extract optional GPS coordinates from payload
        const latitude =
          payload.latitude !== undefined && payload.latitude !== null
            ? Number(payload.latitude)
            : null;
        const longitude =
          payload.longitude !== undefined && payload.longitude !== null
            ? Number(payload.longitude)
            : null;
        const gpsCapturedAt =
          latitude !== null && longitude !== null
            ? payload.gpsCapturedAt
              ? new Date(payload.gpsCapturedAt)
              : offlineDate
            : null;

        // ====================================================================
        // A. PROCESS DRIVER
        // ====================================================================
        if (entityType === 'DRIVER') {
          const rawNin = (payload.nin || payload.nationalIdNumber || '').trim().toUpperCase();
          const rawLicense = (payload.drivingLicenseNumber || payload.licenseNumber || '').trim().toUpperCase();
          const rawPhone = (payload.phoneNumber || '').trim();

          if (!payload.firstName || !payload.lastName || !rawNin || !rawPhone || !rawLicense) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'MISSING_DRIVER_FIELDS',
              error: 'Prénom, nom, NIN, téléphone et numéro de permis sont obligatoires pour un chauffeur.',
            });
            failed++;
            continue;
          }

          // Pre-validate inline documents (size, magic bytes, SHA-256 integrity) before DB writes
          validateInlineDocuments(payload.documents, actorUser.id);

          const normalizedPhone = normalizeGuineanPhone(rawPhone);
          const rawEmergencyPhone = (payload.emergencyContactPhone || '').trim();
          const normalizedEmergencyPhone = rawEmergencyPhone
            ? normalizeGuineanPhone(rawEmergencyPhone)
            : null;
          if (normalizedEmergencyPhone && normalizedEmergencyPhone === normalizedPhone) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'EMERGENCY_PHONE_SAME_AS_PRIMARY',
              error:
                "Le numéro d'urgence doit être différent du numéro de téléphone principal du chauffeur.",
            });
            failed++;
            continue;
          }
          const emergencyContactName = payload.emergencyContactName
            ? String(payload.emergencyContactName).trim()
            : null;
          const emergencyContactRelation = payload.emergencyContactRelation
            ? String(payload.emergencyContactRelation).trim()
            : null;
          const licenseCategory = Array.isArray(payload.licenseCategories)
            ? payload.licenseCategories[0] || 'B'
            : payload.licenseCategory || 'B';
          const rawExpDate = payload.licenseExpirationDate || payload.licenseExpiryDate;
          const licenseExpirationDate = rawExpDate
            ? new Date(rawExpDate)
            : new Date(Date.now() + 365 * 24 * 3600 * 1000);

          // Check if driving license number already exists
          const existingLicenseDriver = await prisma.driver.findUnique({
            where: { drivingLicenseNumber: rawLicense },
            include: { person: true },
          });

          // Check if person already exists by NIN or phone
          const existingPerson = await prisma.person.findFirst({
            where: {
              OR: [{ nin: rawNin }, { phoneNumber: normalizedPhone }],
            },
            include: { driver: true },
          });

          // Conflict check 1: Driving license belongs to a different person
          if (
            existingLicenseDriver &&
            existingLicenseDriver.person &&
            existingLicenseDriver.person.nin !== rawNin
          ) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'CONFLICT',
              conflictCode: 'LICENSE_BELONGS_TO_OTHER_PERSON',
              serverRecordId: existingLicenseDriver.id,
              message: `Conflit : le permis "${rawLicense}" est déjà attribué à un autre individu (NIN différent).`,
            });
            conflicts++;
            continue;
          }

          // Conflict check 2: Phone number belongs to a different NIN, or NIN has a different phone
          if (existingPerson && existingPerson.nin !== rawNin) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'CONFLICT',
              conflictCode: 'PHONE_BELONGS_TO_OTHER_NIN',
              serverRecordId: existingPerson.id,
              message: `Conflit : le numéro de téléphone "${normalizedPhone}" est déjà attribué à une autre personne (NIN ${existingPerson.nin}).`,
            });
            conflicts++;
            continue;
          }

          // Conflict / Duplicate check 3: Person already has a Driver profile
          if (existingPerson && existingPerson.driver) {
            const serverDriver = existingPerson.driver;
            const isModifiedNewerOnServer =
              serverDriver.updatedAt && new Date(serverDriver.updatedAt) > offlineDate;
            const hasDifferentLicense = serverDriver.drivingLicenseNumber !== rawLicense;
            const hasDifferentPhone = existingPerson.phoneNumber !== normalizedPhone;

            if (hasDifferentLicense || hasDifferentPhone || isModifiedNewerOnServer) {
              pushResult({
                clientGeneratedId,
                entityType,
                status: 'CONFLICT',
                conflictCode: 'DRIVER_MODIFIED_ON_OTHER_DEVICE',
                serverRecordId: serverDriver.id,
                message: `Conflit de synchronisation : ce chauffeur (NIN ${rawNin}) a été enregistré ou modifié sur un autre terminal.`,
              });
              conflicts++;
              continue;
            }

            clientToServerIdMap.set(clientGeneratedId, serverDriver.id);
            clientToPersonIdMap.set(clientGeneratedId, existingPerson.id);
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'DUPLICATE',
              serverRecordId: serverDriver.id,
              personId: existingPerson.id,
              message: 'Ce chauffeur existe déjà dans la base centrale.',
            });
            duplicates++;
            continue;
          }

          // Atomic persistence of Person + Driver + ValidationRequest
          const createdDriver = await prisma.$transaction(async (tx) => {
            let person = existingPerson;
            if (!person) {
              person = await tx.person.create({
                data: {
                  firstName: payload.firstName.trim(),
                  lastName: payload.lastName.trim(),
                  nin: rawNin,
                  phoneNumber: normalizedPhone,
                  email: payload.email ? payload.email.trim() : null,
                  dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
                  address: payload.address ? payload.address.trim() : null,
                  communeId: resolvedCommuneId,
                  latitude,
                  longitude,
                  gpsCapturedAt,
                  registeredByUserId: actorUser.id,
                },
              });
            }

            const driver = await tx.driver.create({
              data: {
                personId: person.id,
                drivingLicenseNumber: rawLicense,
                licenseCategory,
                licenseExpirationDate,
                status: 'EN_ATTENTE_VALIDATION',
                emergencyContactName,
                emergencyContactPhone: normalizedEmergencyPhone,
                emergencyContactRelation,
                unionId: payload.unionId || null,
              },
            });

            if (tx.validationRequest) {
              const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
              await tx.validationRequest.create({
                data: {
                  requestNumber,
                  entityType: 'DRIVER_ENROLMENT',
                  targetEntityId: driver.id,
                  submitterId: actorUser.id,
                  currentLevel: 2,
                  currentStatus: 'SOUMIS_NIVEAU2',
                  communeId: resolvedCommuneId,
                  submittedAt: new Date(),
                },
              });
            }

            return { driver, person };
          }, { maxWait: 10000, timeout: 25000 });

          // Store any inline documents attached to the driver draft
          const documentIds = await storeInlineDocuments(payload.documents, {
            actorUserId: actorUser.id,
            personId: createdDriver.person.id,
          });

          await prisma.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OFFLINE_SYNC_ACCEPTED',
              targetModule: 'SYNC',
              targetRecordId: clientGeneratedId,
              newValues: {
                deviceId,
                entityType: 'DRIVER',
                serverRecordId: createdDriver.driver.id,
                personId: createdDriver.person.id,
                nin: rawNin,
                latitude,
                longitude,
                createdOfflineAt,
              },
            },
          });

          clientToServerIdMap.set(clientGeneratedId, createdDriver.driver.id);
          clientToPersonIdMap.set(clientGeneratedId, createdDriver.person.id);
          pushResult({
            clientGeneratedId,
            entityType: 'DRIVER',
            status: 'SUCCESS',
            serverRecordId: createdDriver.driver.id,
            personId: createdDriver.person.id,
            documentIds,
          });
          accepted++;
          continue;
        }

        // ====================================================================
        // B. PROCESS OWNER
        // ====================================================================
        if (entityType === 'OWNER') {
          const rawNin = (payload.nin || payload.nationalIdNumber || '').trim().toUpperCase();
          const rawPhone = (payload.phoneNumber || '').trim();

          if (!payload.firstName || !payload.lastName || !rawNin || !rawPhone) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'MISSING_OWNER_FIELDS',
              error: 'Prénom, nom, NIN et téléphone sont obligatoires pour un propriétaire.',
            });
            failed++;
            continue;
          }

          validateInlineDocuments(payload.documents, actorUser.id);

          const normalizedPhone = normalizeGuineanPhone(rawPhone);

          const existingPerson = await prisma.person.findFirst({
            where: {
              OR: [{ nin: rawNin }, { phoneNumber: normalizedPhone }],
            },
            include: { owner: true },
          });

          if (existingPerson && existingPerson.nin !== rawNin) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'CONFLICT',
              conflictCode: 'PHONE_BELONGS_TO_OTHER_NIN',
              serverRecordId: existingPerson.id,
              message: `Conflit : le numéro de téléphone "${normalizedPhone}" est déjà attribué à une autre personne (NIN ${existingPerson.nin}).`,
            });
            conflicts++;
            continue;
          }

          if (existingPerson && existingPerson.owner) {
            const serverOwner = existingPerson.owner;
            const isModifiedNewerOnServer =
              serverOwner.updatedAt && new Date(serverOwner.updatedAt) > offlineDate;
            const hasDifferentPhone = existingPerson.phoneNumber !== normalizedPhone;

            if (isModifiedNewerOnServer || hasDifferentPhone) {
              pushResult({
                clientGeneratedId,
                entityType,
                status: 'CONFLICT',
                conflictCode: 'OWNER_MODIFIED_ON_OTHER_DEVICE',
                serverRecordId: serverOwner.id,
                message: `Conflit de synchronisation : ce propriétaire (NIN ${rawNin}) a été modifié sur un autre terminal.`,
              });
              conflicts++;
              continue;
            }

            clientToServerIdMap.set(clientGeneratedId, serverOwner.id);
            clientToPersonIdMap.set(clientGeneratedId, existingPerson.id);
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'DUPLICATE',
              serverRecordId: serverOwner.id,
              personId: existingPerson.id,
              message: 'Ce propriétaire existe déjà dans la base centrale.',
            });
            duplicates++;
            continue;
          }

          const createdOwner = await prisma.$transaction(async (tx) => {
            let person = existingPerson;
            if (!person) {
              person = await tx.person.create({
                data: {
                  firstName: payload.firstName.trim(),
                  lastName: payload.lastName.trim(),
                  nin: rawNin,
                  phoneNumber: normalizedPhone,
                  email: payload.email ? payload.email.trim() : null,
                  address: payload.address ? payload.address.trim() : null,
                  communeId: resolvedCommuneId,
                  latitude,
                  longitude,
                  gpsCapturedAt,
                  registeredByUserId: actorUser.id,
                },
              });
            }

            const owner = await tx.owner.create({
              data: {
                personId: person.id,
                ownerType: payload.ownerType === 'ENTREPRISE' ? 'ENTREPRISE' : 'INDIVIDU',
                businessName: payload.businessName ? payload.businessName.trim() : null,
                taxNumber: payload.taxNumber ? payload.taxNumber.trim() : null,
                unionId: payload.unionId || null,
              },
            });

            if (tx.validationRequest) {
              const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
              await tx.validationRequest.create({
                data: {
                  requestNumber,
                  entityType: 'OWNER_ENROLMENT',
                  targetEntityId: owner.id,
                  submitterId: actorUser.id,
                  currentLevel: 2,
                  currentStatus: 'SOUMIS_NIVEAU2',
                  communeId: resolvedCommuneId,
                  submittedAt: new Date(),
                },
              });
            }

            return { owner, person };
          }, { maxWait: 10000, timeout: 25000 });

          const documentIds = await storeInlineDocuments(payload.documents, {
            actorUserId: actorUser.id,
            personId: createdOwner.person.id,
          });

          await prisma.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OFFLINE_SYNC_ACCEPTED',
              targetModule: 'SYNC',
              targetRecordId: clientGeneratedId,
              newValues: {
                deviceId,
                entityType: 'OWNER',
                serverRecordId: createdOwner.owner.id,
                personId: createdOwner.person.id,
                nin: rawNin,
                latitude,
                longitude,
                createdOfflineAt,
              },
            },
          });

          clientToServerIdMap.set(clientGeneratedId, createdOwner.owner.id);
          clientToPersonIdMap.set(clientGeneratedId, createdOwner.person.id);
          pushResult({
            clientGeneratedId,
            entityType: 'OWNER',
            status: 'SUCCESS',
            serverRecordId: createdOwner.owner.id,
            personId: createdOwner.person.id,
            documentIds,
          });
          accepted++;
          continue;
        }

        // ====================================================================
        // C. PROCESS VEHICLE
        // ====================================================================
        if (entityType === 'VEHICLE') {
          const cleanedPlate = (payload.plateNumber || '').trim().toUpperCase();
          const cleanedCard = (payload.registrationCardNumber || payload.carteGriseNumber || '').trim().toUpperCase();
          const cleanedVin = (payload.chassisVin || payload.chassisNumber || '').trim().toUpperCase();

          if (!cleanedPlate || !cleanedCard || !cleanedVin || !payload.vehicleType || !payload.make || !payload.model) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'MISSING_VEHICLE_FIELDS',
              error: 'Plaque, carte grise, châssis (VIN), type, marque et modèle sont obligatoires.',
            });
            failed++;
            continue;
          }

          validateInlineDocuments(payload.documents, actorUser.id);

          // Resolve ownerId (direct UUID, batch clientGeneratedId, prior sync AuditLog, or ownerNin / ownerPhone)
          let resolvedOwnerId = payload.ownerId || null;
          if (!resolvedOwnerId && payload.ownerClientGeneratedId) {
            resolvedOwnerId = clientToServerIdMap.get(payload.ownerClientGeneratedId) || null;
            if (!resolvedOwnerId) {
              const ownerAudit = await prisma.auditLog.findFirst({
                where: {
                  action: 'OFFLINE_SYNC_ACCEPTED',
                  targetRecordId: payload.ownerClientGeneratedId,
                },
              });
              resolvedOwnerId = ownerAudit?.newValues?.serverRecordId || null;
            }
          }
          if (!resolvedOwnerId && (payload.ownerNin || payload.ownerPhone)) {
            const ownerPerson = await prisma.person.findFirst({
              where: {
                OR: [
                  ...(payload.ownerNin ? [{ nin: payload.ownerNin.trim().toUpperCase() }] : []),
                  ...(payload.ownerPhone ? [{ phoneNumber: normalizeGuineanPhone(payload.ownerPhone) }] : []),
                ],
              },
              include: { owner: true },
            });
            resolvedOwnerId = ownerPerson?.owner?.id || null;
          }

          if (!resolvedOwnerId) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'OWNER_NOT_FOUND',
              error: 'Propriétaire introuvable pour ce véhicule (ownerId ou ownerNin requis).',
            });
            failed++;
            continue;
          }

          // Check existing vehicle by plate, carte grise, or VIN
          const existingVehicle = await prisma.vehicle.findFirst({
            where: {
              OR: [
                { plateNumber: cleanedPlate },
                { registrationCardNumber: cleanedCard },
                { chassisVin: cleanedVin },
              ],
            },
          });

          if (existingVehicle) {
            const isDifferentOwner = existingVehicle.ownerId !== resolvedOwnerId;
            const isDifferentIdentifiers =
              existingVehicle.plateNumber !== cleanedPlate ||
              existingVehicle.registrationCardNumber !== cleanedCard ||
              existingVehicle.chassisVin !== cleanedVin;

            if (isDifferentOwner || isDifferentIdentifiers) {
              let conflictCode = 'VEHICLE_IDENTIFIER_CONFLICT';
              if (existingVehicle.plateNumber === cleanedPlate && isDifferentIdentifiers) {
                conflictCode = 'PLATE_ALREADY_REGISTERED';
              } else if (existingVehicle.registrationCardNumber === cleanedCard && isDifferentIdentifiers) {
                conflictCode = 'REGISTRATION_CARD_ALREADY_REGISTERED';
              } else if (existingVehicle.chassisVin === cleanedVin && isDifferentIdentifiers) {
                conflictCode = 'VIN_ALREADY_REGISTERED';
              }

              pushResult({
                clientGeneratedId,
                entityType,
                status: 'CONFLICT',
                conflictCode,
                serverRecordId: existingVehicle.id,
                message: `Conflit : un véhicule avec la plaque "${cleanedPlate}", la carte grise "${cleanedCard}" ou le châssis "${cleanedVin}" existe déjà avec des informations différentes.`,
              });
              conflicts++;
              continue;
            }

            clientToServerIdMap.set(clientGeneratedId, existingVehicle.id);
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'DUPLICATE',
              serverRecordId: existingVehicle.id,
              message: 'Ce véhicule est déjà enregistré dans la base centrale.',
            });
            duplicates++;
            continue;
          }

          // Resolve optional assigned driverId (from payload, current batch, or prior sync AuditLog)
          let resolvedDriverId = payload.driverId || null;
          if (!resolvedDriverId && payload.driverClientGeneratedId) {
            resolvedDriverId = clientToServerIdMap.get(payload.driverClientGeneratedId) || null;
            if (!resolvedDriverId) {
              const driverAudit = await prisma.auditLog.findFirst({
                where: {
                  action: 'OFFLINE_SYNC_ACCEPTED',
                  targetRecordId: payload.driverClientGeneratedId,
                },
              });
              resolvedDriverId = driverAudit?.newValues?.serverRecordId || null;
            }
          }

          const cleanedAtr = payload.atrNumber && payload.atrNumber.trim() ? payload.atrNumber.trim().toUpperCase() : null;
          const cleanedAotucLicense = payload.aotucLicenseNumber && payload.aotucLicenseNumber.trim() ? payload.aotucLicenseNumber.trim().toUpperCase() : null;

          const createdVehicle = await prisma.$transaction(async (tx) => {
            const vehicle = await tx.vehicle.create({
              data: {
                ownerId: resolvedOwnerId,
                plateNumber: cleanedPlate,
                registrationCardNumber: cleanedCard,
                chassisVin: cleanedVin,
                atrNumber: cleanedAtr,
                aotucLicenseNumber: cleanedAotucLicense,
                vehicleType: payload.vehicleType,
                make: payload.make.trim(),
                model: payload.model.trim(),
                year: payload.year ? Number(payload.year) : null,
                seatingCapacity: payload.seatingCapacity ? Number(payload.seatingCapacity) : null,
                status: 'EN_ATTENTE_VALIDATION',
                latitude,
                longitude,
                gpsCapturedAt,
                registeredByUserId: actorUser.id,
              },
            });

            if (resolvedDriverId && tx.vehicleAssignment) {
              await tx.vehicleAssignment.create({
                data: {
                  vehicleId: vehicle.id,
                  driverId: resolvedDriverId,
                  transportLineId: payload.transportLineId || null,
                  assignedBy: actorUser.id,
                  isActive: true,
                },
              });
            }

            if (payload.inspectionCertificateNumber && tx.vehicleInspection) {
              await tx.vehicleInspection.create({
                data: {
                  vehicleId: vehicle.id,
                  certificateNumber: payload.inspectionCertificateNumber.trim().toUpperCase(),
                  inspectionCenter: (payload.inspectionCenter || 'Centre Technique Conakry').trim(),
                  inspectionDate: new Date(),
                  expirationDate: payload.inspectionExpirationDate
                    ? new Date(payload.inspectionExpirationDate)
                    : new Date(Date.now() + 365 * 24 * 3600 * 1000),
                  isConform: true,
                },
              });
            }

            if (tx.validationRequest) {
              const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
              await tx.validationRequest.create({
                data: {
                  requestNumber,
                  entityType: 'VEHICLE_ENROLMENT',
                  targetEntityId: vehicle.id,
                  submitterId: actorUser.id,
                  currentLevel: 2,
                  currentStatus: 'SOUMIS_NIVEAU2',
                  communeId: resolvedCommuneId,
                  submittedAt: new Date(),
                },
              });
            }

            return vehicle;
          }, { maxWait: 10000, timeout: 25000 });

          const documentIds = await storeInlineDocuments(payload.documents, {
            actorUserId: actorUser.id,
            vehicleId: createdVehicle.id,
          });

          await prisma.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OFFLINE_SYNC_ACCEPTED',
              targetModule: 'SYNC',
              targetRecordId: clientGeneratedId,
              newValues: {
                deviceId,
                entityType: 'VEHICLE',
                serverRecordId: createdVehicle.id,
                plateNumber: cleanedPlate,
                chassisVin: cleanedVin,
                latitude,
                longitude,
                createdOfflineAt,
              },
            },
          });

          clientToServerIdMap.set(clientGeneratedId, createdVehicle.id);
          pushResult({
            clientGeneratedId,
            entityType: 'VEHICLE',
            status: 'SUCCESS',
            serverRecordId: createdVehicle.id,
            documentIds,
          });
          accepted++;
          continue;
        }

        // ====================================================================
        // D. PROCESS STANDALONE DOCUMENT
        // ====================================================================
        if (entityType === 'DOCUMENT') {
          if (!payload.base64Data || !payload.category) {
            pushResult({
              clientGeneratedId,
              entityType,
              status: 'ERROR',
              errorCode: 'MISSING_DOCUMENT_FIELDS',
              error: 'Le contenu binaire (base64Data) et la catégorie (category) sont obligatoires.',
            });
            failed++;
            continue;
          }

          // Resolve personId or vehicleId from clientGeneratedIds if linked to offline entities
          let resolvedPersonId = payload.personId || null;
          const personClientRef =
            payload.personClientGeneratedId ||
            payload.driverClientGeneratedId ||
            payload.ownerClientGeneratedId ||
            null;

          if (!resolvedPersonId && personClientRef) {
            resolvedPersonId = clientToPersonIdMap.get(personClientRef) || null;
            if (!resolvedPersonId) {
              const personAudit = await prisma.auditLog.findFirst({
                where: {
                  action: 'OFFLINE_SYNC_ACCEPTED',
                  targetRecordId: personClientRef,
                },
              });
              resolvedPersonId = personAudit?.newValues?.personId || null;
            }
          }

          let resolvedVehicleId = payload.vehicleId || null;
          if (!resolvedVehicleId && payload.vehicleClientGeneratedId) {
            resolvedVehicleId = clientToServerIdMap.get(payload.vehicleClientGeneratedId) || null;
            if (!resolvedVehicleId) {
              const vehicleAudit = await prisma.auditLog.findFirst({
                where: {
                  action: 'OFFLINE_SYNC_ACCEPTED',
                  targetRecordId: payload.vehicleClientGeneratedId,
                },
              });
              resolvedVehicleId = vehicleAudit?.newValues?.serverRecordId || null;
            }
          }

          const cleanBase64 = payload.base64Data.replace(/^data:[^;]+;base64,/, '');
          const fileBuffer = Buffer.from(cleanBase64, 'base64');

          const savedDoc = await DocumentStorageService.storeFile({
            fileBuffer,
            originalName: payload.originalName || `${payload.category.toLowerCase()}.jpg`,
            declaredMime: payload.mimeType || 'image/jpeg',
            category: payload.category,
            uploadedByUserId: actorUser.id,
            personId: resolvedPersonId,
            vehicleId: resolvedVehicleId,
            expectedSha256: payload.fileHashSha256 || null,
          });

          await prisma.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OFFLINE_SYNC_ACCEPTED',
              targetModule: 'SYNC',
              targetRecordId: clientGeneratedId,
              newValues: {
                deviceId,
                entityType: 'DOCUMENT',
                serverRecordId: savedDoc.id,
                personId: resolvedPersonId,
                vehicleId: resolvedVehicleId,
                category: payload.category,
                createdOfflineAt,
              },
            },
          });

          clientToServerIdMap.set(clientGeneratedId, savedDoc.id);
          pushResult({
            clientGeneratedId,
            entityType: 'DOCUMENT',
            status: 'SUCCESS',
            serverRecordId: savedDoc.id,
            personId: resolvedPersonId,
            vehicleId: resolvedVehicleId,
          });
          accepted++;
          continue;
        }

        // Unknown entityType: NEVER return fake ACCEPTED
        pushResult({
          clientGeneratedId,
          entityType,
          status: 'ERROR',
          errorCode: 'UNSUPPORTED_ENTITY_TYPE',
          error: `Type d'entité non pris en charge: ${entityType}`,
        });
        failed++;
      } catch (err) {
        logger.warn('Failed to process offline sync item', {
          clientGeneratedId,
          entityType,
          error: err.message,
        });

        pushResult({
          clientGeneratedId,
          entityType,
          status: 'ERROR',
          errorCode: err.code || 'SYNC_ITEM_FAILED',
          error: err.message,
        });
        failed++;
      }
    }

    return {
      deviceId,
      totalItems: items.length,
      accepted,
      duplicates,
      conflicts,
      failed,
      results: resultsByIndex,
      syncedAt: new Date().toISOString(),
    };
  }
}

export default SyncService;
