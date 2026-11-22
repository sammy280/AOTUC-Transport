import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import DocumentStorageService from '../../services/documentStorageService.js';
import { normalizeGuineanPhone } from './registration.schemas.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a commune UUID from either a UUID, a commune code (e.g. 'MTT', 'KLM'), or a commune name (e.g. 'Matoto').
 */
async function resolveCommuneId(rawCommune, fallbackCommuneId = null) {
  if (fallbackCommuneId && UUID_REGEX.test(String(fallbackCommuneId).trim())) {
    return String(fallbackCommuneId).trim();
  }
  if (!rawCommune) return fallbackCommuneId || null;
  const trimmed = String(rawCommune).trim();
  if (!trimmed) return fallbackCommuneId || null;
  if (UUID_REGEX.test(trimmed)) return trimmed;

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

/**
 * Pre-validates inline base64 documents (size, magic bytes, optional SHA-256 hash)
 * BEFORE starting any database transaction so invalid/corrupted photographs or documents
 * do not leave partial or orphaned driver/owner/vehicle records.
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

async function saveInlineDocuments(documents, { actorUserId, personId = null, vehicleId = null }) {
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
      personId,
      vehicleId,
      expectedSha256: doc.fileHashSha256 || null,
    });
    saved.push(record);
  }
  return saved;
}

export class RegistrationService {
  /**
   * Checks whether a person, driver, owner, or vehicle already exists by identifier.
   */
  static async checkDuplicates(query = {}) {
    const matches = {
      hasDuplicate: false,
      person: null,
      driver: null,
      owner: null,
      vehicle: null,
    };

    const cleanNin = query.nin ? String(query.nin).trim().toUpperCase() : null;
    const cleanPhone = query.phoneNumber ? normalizeGuineanPhone(query.phoneNumber) : null;
    const cleanLicense = query.drivingLicenseNumber
      ? String(query.drivingLicenseNumber).trim().toUpperCase()
      : null;
    const cleanPlate = query.plateNumber ? String(query.plateNumber).trim().toUpperCase() : null;
    const cleanCard = query.registrationCardNumber
      ? String(query.registrationCardNumber).trim().toUpperCase()
      : null;
    const cleanVin = query.chassisVin ? String(query.chassisVin).trim().toUpperCase() : null;
    const cleanAtr = query.atrNumber ? String(query.atrNumber).trim().toUpperCase() : null;
    const cleanAotucLic = query.aotucLicenseNumber ? String(query.aotucLicenseNumber).trim().toUpperCase() : null;

    if (cleanNin || cleanPhone) {
      const person = await prisma.person.findFirst({
        where: {
          OR: [
            ...(cleanNin ? [{ nin: cleanNin }] : []),
            ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : []),
          ],
        },
        include: { driver: true, owner: true, commune: true },
      });
      if (person) {
        matches.person = {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          nin: person.nin,
          phoneNumber: person.phoneNumber,
          commune: person.commune?.name || null,
          isDriver: Boolean(person.driver),
          isOwner: Boolean(person.owner),
        };
        if (person.driver) matches.driver = person.driver;
        if (person.owner) matches.owner = person.owner;
        matches.hasDuplicate = true;
      }
    }

    if (cleanLicense && !matches.driver) {
      const driver = await prisma.driver.findUnique({
        where: { drivingLicenseNumber: cleanLicense },
        include: { person: true },
      });
      if (driver) {
        matches.driver = driver;
        matches.hasDuplicate = true;
      }
    }

    if (cleanPlate || cleanCard || cleanVin || cleanAtr || cleanAotucLic) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            ...(cleanPlate ? [{ plateNumber: cleanPlate }] : []),
            ...(cleanCard ? [{ registrationCardNumber: cleanCard }] : []),
            ...(cleanVin ? [{ chassisVin: cleanVin }] : []),
            ...(cleanAtr ? [{ atrNumber: cleanAtr }] : []),
            ...(cleanAotucLic ? [{ aotucLicenseNumber: cleanAotucLic }] : []),
          ],
        },
        include: { owner: { include: { person: true } } },
      });
      if (vehicle) {
        matches.vehicle = vehicle;
        matches.hasDuplicate = true;
      }
    }

    return matches;
  }

  /**
   * Enrol a Driver (Chauffeur professionnel)
   */
  static async registerDriver(data, actorUser) {
    const normalizedPhone = normalizeGuineanPhone(data.phoneNumber);
    const normalizedEmergencyPhone = data.emergencyContactPhone
      ? normalizeGuineanPhone(data.emergencyContactPhone)
      : null;
    const cleanedNin = data.nin.trim().toUpperCase();
    const cleanedLicense = data.drivingLicenseNumber.trim().toUpperCase();

    if (normalizedEmergencyPhone && normalizedEmergencyPhone === normalizedPhone) {
      throw new AppError(
        "Le numéro d'urgence doit être différent du numéro de téléphone principal du chauffeur.",
        400,
        'EMERGENCY_PHONE_SAME_AS_PRIMARY'
      );
    }

    // 0. Pre-validate any inline documents (photograph, CNI, permis) before opening DB transaction
    validateInlineDocuments(data.documents, actorUser.id);

    // 1. Duplicate checks
    const existingPerson = await prisma.person.findFirst({
      where: {
        OR: [{ nin: cleanedNin }, { phoneNumber: normalizedPhone }],
      },
      include: { driver: true },
    });

    if (existingPerson && existingPerson.driver) {
      throw new AppError(
        'Un chauffeur avec ce numéro NIN ou ce numéro de téléphone est déjà enregistré.',
        409,
        'DRIVER_ALREADY_EXISTS'
      );
    }

    if (existingPerson && existingPerson.nin !== cleanedNin) {
      throw new AppError(
        'Ce numéro de téléphone est déjà associé à une autre personne (NIN différent).',
        409,
        'PHONE_ALREADY_EXISTS'
      );
    }

    if (existingPerson && existingPerson.phoneNumber !== normalizedPhone) {
      throw new AppError(
        'Ce numéro NIN est déjà enregistré avec un autre numéro de téléphone.',
        409,
        'NIN_ALREADY_EXISTS'
      );
    }

    const existingLicense = await prisma.driver.findUnique({
      where: { drivingLicenseNumber: cleanedLicense },
    });

    if (existingLicense) {
      throw new AppError(
        'Ce numéro de permis de conduire est déjà associé à un autre chauffeur.',
        409,
        'LICENSE_ALREADY_EXISTS'
      );
    }

    // Resolve communeId from actorUser.communeId, data.communeId, or data.commune
    const communeId = await resolveCommuneId(
      actorUser.communeId || data.communeId || data.commune,
      actorUser.communeId
    );
    const hasGps =
      data.latitude !== undefined &&
      data.latitude !== null &&
      data.longitude !== undefined &&
      data.longitude !== null;

    // 2. Atomic creation of Person, Driver profile, and ValidationRequest
    const result = await prisma.$transaction(async (tx) => {
      let personId;

      if (existingPerson) {
        personId = existingPerson.id;
      } else {
        const newPerson = await tx.person.create({
          data: {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            nin: cleanedNin,
            phoneNumber: normalizedPhone,
            email: data.email || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            address: data.address || null,
            communeId,
            latitude: hasGps ? Number(data.latitude) : null,
            longitude: hasGps ? Number(data.longitude) : null,
            gpsCapturedAt: hasGps
              ? data.gpsCapturedAt
                ? new Date(data.gpsCapturedAt)
                : new Date()
              : null,
            registeredByUserId: actorUser.id,
          },
        });
        personId = newPerson.id;
      }

      const driver = await tx.driver.create({
        data: {
          personId,
          drivingLicenseNumber: cleanedLicense,
          licenseCategory: data.licenseCategory || 'B',
          licenseExpirationDate: new Date(data.licenseExpirationDate),
          status: 'EN_ATTENTE_VALIDATION',
          emergencyContactName: data.emergencyContactName ? data.emergencyContactName.trim() : null,
          emergencyContactPhone: normalizedEmergencyPhone,
          emergencyContactRelation: data.emergencyContactRelation
            ? data.emergencyContactRelation.trim()
            : null,
          unionId: data.unionId || null,
        },
        include: {
          person: { include: { commune: true, documents: true } },
          union: true,
        },
      });

      if (tx.validationRequest) {
        const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await Promise.all([
          tx.validationRequest.create({
            data: {
              requestNumber,
              entityType: 'DRIVER_ENROLMENT',
              targetEntityId: driver.id,
              submitterId: actorUser.id,
              currentLevel: 2,
              currentStatus: 'SOUMIS_NIVEAU2',
              communeId,
              submittedAt: new Date(),
            },
          }),
          tx.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'DRIVER_ENROLLED',
              targetModule: 'REGISTRATION',
              targetRecordId: driver.id,
              newValues: {
                driverId: driver.id,
                nin: cleanedNin,
                license: cleanedLicense,
                emergencyContactPhone: normalizedEmergencyPhone,
                emergencyContactName: data.emergencyContactName || null,
                emergencyContactRelation: data.emergencyContactRelation || null,
                communeId,
                latitude: hasGps ? Number(data.latitude) : null,
                longitude: hasGps ? Number(data.longitude) : null,
              },
            },
          }),
        ]);
      } else {
        await tx.auditLog.create({
          data: {
            actorId: actorUser.id,
            action: 'DRIVER_ENROLLED',
            targetModule: 'REGISTRATION',
            targetRecordId: driver.id,
            newValues: {
              driverId: driver.id,
              nin: cleanedNin,
              license: cleanedLicense,
              emergencyContactPhone: normalizedEmergencyPhone,
              emergencyContactName: data.emergencyContactName || null,
              emergencyContactRelation: data.emergencyContactRelation || null,
              communeId,
              latitude: hasGps ? Number(data.latitude) : null,
              longitude: hasGps ? Number(data.longitude) : null,
            },
          },
        });
      }

      return driver;
    }, { maxWait: 10000, timeout: 25000 });

    if (Array.isArray(data.documents) && data.documents.length > 0) {
      result.documents = await saveInlineDocuments(data.documents, {
        actorUserId: actorUser.id,
        personId: result.personId,
      });
      if (result.person) {
        result.person.documents = result.documents;
      }
    } else {
      result.documents = result.person?.documents || [];
    }

    return result;
  }

  /**
   * Enrol a Vehicle Owner (Propriétaire)
   */
  static async registerOwner(data, actorUser) {
    const normalizedPhone = normalizeGuineanPhone(data.phoneNumber);
    const cleanedNin = data.nin.trim().toUpperCase();

    validateInlineDocuments(data.documents, actorUser.id);

    const existingPerson = await prisma.person.findFirst({
      where: {
        OR: [{ nin: cleanedNin }, { phoneNumber: normalizedPhone }],
      },
      include: { owner: true },
    });

    if (existingPerson && existingPerson.owner) {
      throw new AppError(
        'Un propriétaire avec ce NIN ou ce numéro de téléphone existe déjà.',
        409,
        'OWNER_ALREADY_EXISTS'
      );
    }

    if (existingPerson && existingPerson.nin !== cleanedNin) {
      throw new AppError(
        'Ce numéro de téléphone est déjà associé à une autre personne (NIN différent).',
        409,
        'PHONE_ALREADY_EXISTS'
      );
    }

    const communeId = await resolveCommuneId(
      actorUser.communeId || data.communeId || data.commune,
      actorUser.communeId
    );
    const hasGps =
      data.latitude !== undefined &&
      data.latitude !== null &&
      data.longitude !== undefined &&
      data.longitude !== null;

    const result = await prisma.$transaction(async (tx) => {
      let personId;

      if (existingPerson) {
        personId = existingPerson.id;
      } else {
        const newPerson = await tx.person.create({
          data: {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            nin: cleanedNin,
            phoneNumber: normalizedPhone,
            email: data.email || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            address: data.address || null,
            communeId,
            latitude: hasGps ? Number(data.latitude) : null,
            longitude: hasGps ? Number(data.longitude) : null,
            gpsCapturedAt: hasGps
              ? data.gpsCapturedAt
                ? new Date(data.gpsCapturedAt)
                : new Date()
              : null,
            registeredByUserId: actorUser.id,
          },
        });
        personId = newPerson.id;
      }

      const owner = await tx.owner.create({
        data: {
          personId,
          ownerType: data.ownerType || 'INDIVIDU',
          businessName: data.businessName || null,
          taxNumber: data.taxNumber || null,
          unionId: data.unionId || null,
        },
        include: {
          person: { include: { commune: true } },
          union: true,
        },
      });

      if (tx.validationRequest) {
        const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await Promise.all([
          tx.validationRequest.create({
            data: {
              requestNumber,
              entityType: 'OWNER_ENROLMENT',
              targetEntityId: owner.id,
              submitterId: actorUser.id,
              currentLevel: 2,
              currentStatus: 'SOUMIS_NIVEAU2',
              communeId,
              submittedAt: new Date(),
            },
          }),
          tx.auditLog.create({
            data: {
              actorId: actorUser.id,
              action: 'OWNER_ENROLLED',
              targetModule: 'REGISTRATION',
              targetRecordId: owner.id,
              newValues: {
                ownerId: owner.id,
                nin: cleanedNin,
                latitude: hasGps ? Number(data.latitude) : null,
                longitude: hasGps ? Number(data.longitude) : null,
              },
            },
          }),
        ]);
      } else {
        await tx.auditLog.create({
          data: {
            actorId: actorUser.id,
            action: 'OWNER_ENROLLED',
            targetModule: 'REGISTRATION',
            targetRecordId: owner.id,
            newValues: {
              ownerId: owner.id,
              nin: cleanedNin,
              latitude: hasGps ? Number(data.latitude) : null,
              longitude: hasGps ? Number(data.longitude) : null,
            },
          },
        });
      }

      return owner;
    }, { maxWait: 10000, timeout: 25000 });

    if (Array.isArray(data.documents) && data.documents.length > 0) {
      result.documents = await saveInlineDocuments(data.documents, {
        actorUserId: actorUser.id,
        personId: result.personId,
      });
    } else {
      result.documents = [];
    }

    return result;
  }

  /**
   * Enrol a Vehicle (Véhicule de transport)
   */
  static async registerVehicle(data, actorUser) {
    const cleanedPlate = data.plateNumber.trim().toUpperCase();
    const cleanedCard = data.registrationCardNumber.trim().toUpperCase();
    const cleanedVin = data.chassisVin.trim().toUpperCase();
    const cleanedAtr = data.atrNumber && data.atrNumber.trim() ? data.atrNumber.trim().toUpperCase() : null;
    const cleanedAotucLicense = data.aotucLicenseNumber && data.aotucLicenseNumber.trim() ? data.aotucLicenseNumber.trim().toUpperCase() : null;

    // 0. Pre-validate any inline documents before DB writes
    validateInlineDocuments(data.documents, actorUser.id);

    // 1. Verify owner exists
    const owner = await prisma.owner.findUnique({
      where: { id: data.ownerId },
      include: { person: true },
    });

    if (!owner) {
      throw new AppError('Propriétaire introuvable.', 404, 'OWNER_NOT_FOUND');
    }

    // 2. Scope check: If agent is restricted, owner must belong to agent's commune
    if (
      actorUser.communeId &&
      owner.person.communeId &&
      actorUser.communeId !== owner.person.communeId
    ) {
      throw new AppError(
        'Accès refusé. Vous ne pouvez enregistrer un véhicule que pour un propriétaire de votre commune.',
        403,
        'FORBIDDEN_COMMUNE_SCOPE'
      );
    }

    // 3. Duplicate checks
    const orConditions = [
      { plateNumber: cleanedPlate },
      { registrationCardNumber: cleanedCard },
      { chassisVin: cleanedVin },
    ];
    if (cleanedAtr) {
      orConditions.push({ atrNumber: cleanedAtr });
    }
    if (cleanedAotucLicense) {
      orConditions.push({ aotucLicenseNumber: cleanedAotucLicense });
    }

    const existingVehicle = await prisma.vehicle.findFirst({
      where: { OR: orConditions },
    });

    if (existingVehicle) {
      if (cleanedAtr && existingVehicle.atrNumber === cleanedAtr) {
        throw new AppError(
          `Un véhicule avec ce numéro ATR (${cleanedAtr}) est déjà enregistré.`,
          409,
          'VEHICLE_ATR_ALREADY_EXISTS'
        );
      }
      if (cleanedAotucLicense && existingVehicle.aotucLicenseNumber === cleanedAotucLicense) {
        throw new AppError(
          `Un véhicule avec ce numéro de licence AOTUC (${cleanedAotucLicense}) est déjà enregistré.`,
          409,
          'VEHICLE_AOTUC_LICENCE_ALREADY_EXISTS'
        );
      }
      throw new AppError(
        'Un véhicule avec cette immatriculation, carte grise ou numéro de châssis est déjà enregistré.',
        409,
        'VEHICLE_ALREADY_EXISTS'
      );
    }

    const communeId = await resolveCommuneId(
      actorUser.communeId || owner.person?.communeId || data.communeId || data.commune,
      actorUser.communeId
    );

    const hasGps =
      data.latitude !== undefined &&
      data.latitude !== null &&
      data.longitude !== undefined &&
      data.longitude !== null;

    // 4. Create Vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: data.ownerId,
        plateNumber: cleanedPlate,
        registrationCardNumber: cleanedCard,
        chassisVin: cleanedVin,
        atrNumber: cleanedAtr,
        aotucLicenseNumber: cleanedAotucLicense,
        vehicleType: data.vehicleType,
        make: data.make.trim(),
        model: data.model.trim(),
        year: data.year || null,
        seatingCapacity: data.seatingCapacity || null,
        status: 'EN_ATTENTE_VALIDATION',
        latitude: hasGps ? Number(data.latitude) : null,
        longitude: hasGps ? Number(data.longitude) : null,
        gpsCapturedAt: hasGps
          ? data.gpsCapturedAt
            ? new Date(data.gpsCapturedAt)
            : new Date()
          : null,
        registeredByUserId: actorUser.id,
      },
      include: {
        owner: { include: { person: true } },
      },
    });

    // Optional driver assignment
    if (data.driverId && prisma.vehicleAssignment) {
      await prisma.vehicleAssignment.create({
        data: {
          vehicleId: vehicle.id,
          driverId: data.driverId,
          transportLineId: data.transportLineId || null,
          assignedBy: actorUser.id,
          isActive: true,
        },
      });
    }

    // Optional technical inspection record
    if (data.inspectionCertificateNumber && prisma.vehicleInspection) {
      await prisma.vehicleInspection.create({
        data: {
          vehicleId: vehicle.id,
          certificateNumber: data.inspectionCertificateNumber.trim().toUpperCase(),
          inspectionCenter: (data.inspectionCenter || 'Centre Technique Conakry').trim(),
          inspectionDate: new Date(),
          expirationDate: data.inspectionExpirationDate
            ? new Date(data.inspectionExpirationDate)
            : new Date(Date.now() + 365 * 24 * 3600 * 1000),
          isConform: true,
        },
      });
    }

    if (prisma.validationRequest) {
      const requestNumber = `VAL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await prisma.validationRequest.create({
        data: {
          requestNumber,
          entityType: 'VEHICLE_ENROLMENT',
          targetEntityId: vehicle.id,
          submitterId: actorUser.id,
          currentLevel: 2,
          currentStatus: 'SOUMIS_NIVEAU2',
          communeId,
          submittedAt: new Date(),
        },
      });
    }

    if (Array.isArray(data.documents) && data.documents.length > 0) {
      vehicle.documents = await saveInlineDocuments(data.documents, {
        actorUserId: actorUser.id,
        vehicleId: vehicle.id,
      });
    } else {
      vehicle.documents = [];
    }

    // 5. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'VEHICLE_ENROLLED',
        targetModule: 'REGISTRATION',
        targetRecordId: vehicle.id,
        newValues: {
          plateNumber: cleanedPlate,
          chassisVin: cleanedVin,
          atrNumber: cleanedAtr,
          aotucLicenseNumber: cleanedAotucLicense,
          latitude: hasGps ? Number(data.latitude) : null,
          longitude: hasGps ? Number(data.longitude) : null,
        },
      },
    });

    return vehicle;
  }

  /**
   * List Drivers with Pagination and Commune Scope
   */
  static async listDrivers({ page = 1, limit = 20, search = '', communeId = null }, actorUser) {
    const skip = (page - 1) * limit;
    let filterCommuneId = undefined;
    const hasExplicitFilter = Boolean(communeId);
    if (communeId) {
      filterCommuneId = await resolveCommuneId(communeId);
    }
    if (actorUser.communeId) {
      filterCommuneId = actorUser.communeId;
    }

    const where = {
      ...(filterCommuneId
        ? {
            person:
              hasExplicitFilter && !actorUser.communeId
                ? { communeId: filterCommuneId }
                : {
                    OR: [
                      { communeId: filterCommuneId },
                      { registeredByUserId: actorUser.id },
                    ],
                  },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { drivingLicenseNumber: { contains: search, mode: 'insensitive' } },
              { emergencyContactPhone: { contains: search, mode: 'insensitive' } },
              { emergencyContactName: { contains: search, mode: 'insensitive' } },
              { person: { firstName: { contains: search, mode: 'insensitive' } } },
              { person: { lastName: { contains: search, mode: 'insensitive' } } },
              { person: { nin: { contains: search, mode: 'insensitive' } } },
              { person: { phoneNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take: limit,
        include: {
          person: { include: { commune: true, documents: true } },
          union: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.driver.count({ where }),
    ]);

    return {
      items: drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Driver by ID with full details & documents
   */
  static async getDriverById(id, actorUser) {
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        person: { include: { commune: true, documents: true } },
        union: true,
      },
    });
    if (!driver) {
      throw new AppError('Conducteur introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    if (actorUser && actorUser.communeId && driver.person?.communeId && actorUser.communeId !== driver.person.communeId) {
      const isPrivileged = Array.isArray(actorUser.roles) && (actorUser.roles.includes('SUPER_ADMIN') || actorUser.roles.includes('DIRECTOR'));
      if (!isPrivileged) {
        throw new AppError('Accès refusé. Ce conducteur relève d une autre commune.', 403, 'FORBIDDEN_COMMUNE_SCOPE');
      }
    }
    return driver;
  }

  /**
   * List Owners with Pagination and Commune Scope
   */
  static async listOwners({ page = 1, limit = 20, search = '', communeId = null }, actorUser) {
    const skip = (page - 1) * limit;
    let filterCommuneId = undefined;
    const hasExplicitFilter = Boolean(communeId);
    if (communeId) {
      filterCommuneId = await resolveCommuneId(communeId);
    }
    if (actorUser.communeId) {
      filterCommuneId = actorUser.communeId;
    }

    const where = {
      ...(filterCommuneId
        ? {
            person:
              hasExplicitFilter && !actorUser.communeId
                ? { communeId: filterCommuneId }
                : {
                    OR: [
                      { communeId: filterCommuneId },
                      { registeredByUserId: actorUser.id },
                    ],
                  },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' } },
              { taxNumber: { contains: search, mode: 'insensitive' } },
              { person: { firstName: { contains: search, mode: 'insensitive' } } },
              { person: { lastName: { contains: search, mode: 'insensitive' } } },
              { person: { nin: { contains: search, mode: 'insensitive' } } },
              { person: { phoneNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        skip,
        take: limit,
        include: {
          person: { include: { commune: true } },
          union: true,
          _count: { select: { vehicles: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.owner.count({ where }),
    ]);

    return {
      items: owners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List Vehicles with Pagination and Scope
   */
  static async listVehicles({ page = 1, limit = 20, search = '', communeId = null }, actorUser) {
    const skip = (page - 1) * limit;
    let filterCommuneId = undefined;
    const hasExplicitFilter = Boolean(communeId);
    if (communeId) {
      filterCommuneId = await resolveCommuneId(communeId);
    }
    if (actorUser.communeId) {
      filterCommuneId = actorUser.communeId;
    }

    const where = {
      ...(filterCommuneId
        ? {
            ...(hasExplicitFilter && !actorUser.communeId
              ? { owner: { person: { communeId: filterCommuneId } } }
              : {
                  OR: [
                    { owner: { person: { communeId: filterCommuneId } } },
                    { registeredByUserId: actorUser.id },
                  ],
                }),
          }
        : {}),
      ...(search
        ? {
            OR: [
              { plateNumber: { contains: search, mode: 'insensitive' } },
              { registrationCardNumber: { contains: search, mode: 'insensitive' } },
              { chassisVin: { contains: search, mode: 'insensitive' } },
              { atrNumber: { contains: search, mode: 'insensitive' } },
              { aotucLicenseNumber: { contains: search, mode: 'insensitive' } },
              { make: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: { include: { person: { include: { commune: true } } } },
          documents: true,
          assignments: {
            where: { isActive: true },
            include: { driver: { include: { person: true } }, transportLine: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      items: vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Vehicle by ID with full details & documents
   */
  static async getVehicleById(id, actorUser) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: { include: { person: { include: { commune: true } } } },
        documents: true,
        assignments: {
          where: { isActive: true },
          include: { driver: { include: { person: true } }, transportLine: true },
        },
        inspections: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!vehicle) {
      throw new AppError('Véhicule introuvable.', 404, 'VEHICLE_NOT_FOUND');
    }

    if (
      actorUser &&
      actorUser.communeId &&
      vehicle.owner?.person?.communeId &&
      actorUser.communeId !== vehicle.owner.person.communeId
    ) {
      const isPrivileged =
        Array.isArray(actorUser.roles) &&
        (actorUser.roles.includes('SUPER_ADMIN') || actorUser.roles.includes('DIRECTOR'));
      if (!isPrivileged) {
        throw new AppError(
          'Accès refusé. Ce véhicule relève d une autre commune.',
          403,
          'FORBIDDEN_COMMUNE_SCOPE'
        );
      }
    }

    return vehicle;
  }

  /**
   * Update an existing Driver record (including union affiliation)
   */
  static async updateDriver(id, data, actorUser) {
    const existing = await prisma.driver.findUnique({
      where: { id },
      include: { person: true, union: true },
    });
    if (!existing) {
      throw new AppError('Conducteur introuvable.', 404, 'DRIVER_NOT_FOUND');
    }

    if (data.unionId) {
      const unionExists = await prisma.transportUnion.findUnique({ where: { id: data.unionId } });
      if (!unionExists) {
        throw new AppError('Syndicat spécifié introuvable.', 404, 'UNION_NOT_FOUND');
      }
    }

    const driverUpdate = {};
    if (data.unionId !== undefined) driverUpdate.unionId = data.unionId || null;
    if (data.licenseCategory !== undefined) driverUpdate.licenseCategory = data.licenseCategory;
    if (data.licenseExpirationDate !== undefined) driverUpdate.licenseExpirationDate = new Date(data.licenseExpirationDate);
    if (data.emergencyContactName !== undefined) driverUpdate.emergencyContactName = data.emergencyContactName ? data.emergencyContactName.trim() : null;
    if (data.emergencyContactPhone !== undefined) driverUpdate.emergencyContactPhone = data.emergencyContactPhone ? normalizeGuineanPhone(data.emergencyContactPhone) : null;
    if (data.emergencyContactRelation !== undefined) driverUpdate.emergencyContactRelation = data.emergencyContactRelation ? data.emergencyContactRelation.trim() : null;

    const personUpdate = {};
    if (data.address !== undefined) personUpdate.address = data.address ? data.address.trim() : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(personUpdate).length > 0) {
        await tx.person.update({
          where: { id: existing.personId },
          data: personUpdate,
        });
      }
      return tx.driver.update({
        where: { id },
        data: driverUpdate,
        include: {
          person: { include: { commune: true, documents: true } },
          union: true,
        },
      });
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'DRIVER_UPDATED',
          targetModule: 'REGISTRATION',
          targetRecordId: id,
          previousValues: { unionId: existing.unionId },
          newValues: driverUpdate,
        },
      });
    } catch (_) {}

    return updated;
  }

  /**
   * Update an existing Owner record (including union affiliation)
   */
  static async updateOwner(id, data, actorUser) {
    const existing = await prisma.owner.findUnique({
      where: { id },
      include: { person: true, union: true },
    });
    if (!existing) {
      throw new AppError('Propriétaire introuvable.', 404, 'OWNER_NOT_FOUND');
    }

    if (data.unionId) {
      const unionExists = await prisma.transportUnion.findUnique({ where: { id: data.unionId } });
      if (!unionExists) {
        throw new AppError('Syndicat spécifié introuvable.', 404, 'UNION_NOT_FOUND');
      }
    }

    const ownerUpdate = {};
    if (data.unionId !== undefined) ownerUpdate.unionId = data.unionId || null;
    if (data.ownerType !== undefined) ownerUpdate.ownerType = data.ownerType;
    if (data.businessName !== undefined) ownerUpdate.businessName = data.businessName ? data.businessName.trim() : null;
    if (data.taxNumber !== undefined) ownerUpdate.taxNumber = data.taxNumber ? data.taxNumber.trim() : null;

    const personUpdate = {};
    if (data.address !== undefined) personUpdate.address = data.address ? data.address.trim() : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(personUpdate).length > 0) {
        await tx.person.update({
          where: { id: existing.personId },
          data: personUpdate,
        });
      }
      return tx.owner.update({
        where: { id },
        data: ownerUpdate,
        include: {
          person: { include: { commune: true } },
          union: true,
          _count: { select: { vehicles: true } },
        },
      });
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'OWNER_UPDATED',
          targetModule: 'REGISTRATION',
          targetRecordId: id,
          previousValues: { unionId: existing.unionId },
          newValues: ownerUpdate,
        },
      });
    } catch (_) {}

    return updated;
  }
}

export default RegistrationService;
