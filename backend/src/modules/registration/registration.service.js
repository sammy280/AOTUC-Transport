import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { normalizeGuineanPhone } from './registration.schemas.js';

export class RegistrationService {
  /**
   * Enrol a Driver (Chauffeur professionnel)
   */
  static async registerDriver(data, actorUser) {
    const normalizedPhone = normalizeGuineanPhone(data.phoneNumber);
    const cleanedNin = data.nin.trim().toUpperCase();
    const cleanedLicense = data.drivingLicenseNumber.trim().toUpperCase();

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

    // Assign actor's commune if field agent has one and none provided
    const communeId = data.communeId || actorUser.communeId || null;

    // 2. Atomic creation of Person and Driver profile
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
          unionId: data.unionId || null,
        },
        include: {
          person: { include: { commune: true } },
          union: true,
        },
      });

      // Audit Log
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
            communeId,
          },
        },
      });

      return driver;
    });

    return result;
  }

  /**
   * Enrol a Vehicle Owner (Propriétaire)
   */
  static async registerOwner(data, actorUser) {
    const normalizedPhone = normalizeGuineanPhone(data.phoneNumber);
    const cleanedNin = data.nin.trim().toUpperCase();

    // Check existing
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

    const communeId = data.communeId || actorUser.communeId || null;

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
            address: data.address || null,
            communeId,
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
        },
        include: {
          person: { include: { commune: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'OWNER_ENROLLED',
          targetModule: 'REGISTRATION',
          targetRecordId: owner.id,
          newValues: { ownerId: owner.id, nin: cleanedNin },
        },
      });

      return owner;
    });

    return result;
  }

  /**
   * Enrol a Vehicle (Véhicule de transport)
   */
  static async registerVehicle(data, actorUser) {
    const cleanedPlate = data.plateNumber.trim().toUpperCase();
    const cleanedCard = data.registrationCardNumber.trim().toUpperCase();
    const cleanedVin = data.chassisVin.trim().toUpperCase();

    // 1. Verify owner exists
    const owner = await prisma.owner.findUnique({
      where: { id: data.ownerId },
      include: { person: true },
    });

    if (!owner) {
      throw new AppError('Propriétaire introuvable.', 404, 'OWNER_NOT_FOUND');
    }

    // 2. Scope check: If agent is restricted, owner must belong to agent's commune
    if (actorUser.communeId && owner.person.communeId && actorUser.communeId !== owner.person.communeId) {
      throw new AppError(
        'Accès refusé. Vous ne pouvez enregistrer un véhicule que pour un propriétaire de votre commune.',
        403,
        'FORBIDDEN_COMMUNE_SCOPE'
      );
    }

    // 3. Duplicate checks
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
      throw new AppError(
        'Un véhicule avec cette immatriculation, carte grise ou numéro de châssis est déjà enregistré.',
        409,
        'VEHICLE_ALREADY_EXISTS'
      );
    }

    // 4. Create Vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: data.ownerId,
        plateNumber: cleanedPlate,
        registrationCardNumber: cleanedCard,
        chassisVin: cleanedVin,
        vehicleType: data.vehicleType,
        make: data.make.trim(),
        model: data.model.trim(),
        year: data.year || null,
        seatingCapacity: data.seatingCapacity || null,
        status: 'EN_ATTENTE_VALIDATION',
      },
      include: {
        owner: { include: { person: true } },
      },
    });

    // 5. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'VEHICLE_ENROLLED',
        targetModule: 'REGISTRATION',
        targetRecordId: vehicle.id,
        newValues: { plateNumber: cleanedPlate, chassisVin: cleanedVin },
      },
    });

    return vehicle;
  }

  /**
   * List Drivers with Pagination and Commune Scope
   */
  static async listDrivers({ page = 1, limit = 20, search = '', communeId = null }, actorUser) {
    const skip = (page - 1) * limit;

    // Filter by scope
    const filterCommuneId = actorUser.communeId || communeId || undefined;

    const where = {
      ...(filterCommuneId ? { person: { communeId: filterCommuneId } } : {}),
      ...(search
        ? {
            OR: [
              { drivingLicenseNumber: { contains: search, mode: 'insensitive' } },
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
          person: { include: { commune: true } },
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
   * List Vehicles with Pagination and Scope
   */
  static async listVehicles({ page = 1, limit = 20, search = '', communeId = null }, actorUser) {
    const skip = (page - 1) * limit;
    const filterCommuneId = actorUser.communeId || communeId || undefined;

    const where = {
      ...(filterCommuneId ? { owner: { person: { communeId: filterCommuneId } } } : {}),
      ...(search
        ? {
            OR: [
              { plateNumber: { contains: search, mode: 'insensitive' } },
              { registrationCardNumber: { contains: search, mode: 'insensitive' } },
              { chassisVin: { contains: search, mode: 'insensitive' } },
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
          owner: { include: { person: true } },
          assignments: {
            where: { isActive: true },
            include: { driver: { include: { person: true } } },
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
}

export default RegistrationService;
