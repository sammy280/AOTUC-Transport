import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import GisCalculationService from '../../services/gisCalculationService.js';

export class TransportLinesService {
  /**
   * Creates a new urban transport route line with calculated geodesic length.
   */
  static async createLine(data, actorUser) {
    const cleanedCode = data.code.trim().toUpperCase();

    // 1. Check duplicate code
    const existing = await prisma.transportLine.findUnique({
      where: { code: cleanedCode },
    });

    if (existing) {
      throw new AppError(`Une ligne avec le code "${cleanedCode}" existe déjà.`, 409, 'LINE_CODE_EXISTS');
    }

    // 2. Calculate polyline distance and estimated travel time
    const distanceKm = GisCalculationService.calculatePolylineDistanceKm(data.pathCoordinates);
    const estimatedMinutes = GisCalculationService.estimateTravelMinutes(distanceKm);

    // 3. Save line
    const line = await prisma.transportLine.create({
      data: {
        code: cleanedCode,
        name: data.name.trim(),
        colorHex: data.colorHex || '#2563EB',
        description: data.description || null,
        originName: data.originName.trim(),
        destinationName: data.destinationName.trim(),
        distanceKm,
        estimatedMinutes,
        pathCoordinates: data.pathCoordinates,
        isActive: true,
      },
    });

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'TRANSPORT_LINE_CREATED',
        targetModule: 'TRANSPORT_LINES',
        targetRecordId: line.id,
        newValues: { code: cleanedCode, distanceKm, estimatedMinutes },
      },
    });

    return line;
  }

  /**
   * Creates an official bus/taxi stop.
   */
  static async createStop(data, actorUser) {
    const cleanedCode = data.code.trim().toUpperCase();

    const existing = await prisma.transportStop.findUnique({
      where: { code: cleanedCode },
    });

    if (existing) {
      throw new AppError(`Un arrêt avec le code "${cleanedCode}" existe déjà.`, 409, 'STOP_CODE_EXISTS');
    }

    const stop = await prisma.transportStop.create({
      data: {
        code: cleanedCode,
        name: data.name.trim(),
        communeId: data.communeId || null,
        latitude: data.latitude,
        longitude: data.longitude,
        isSheltered: data.isSheltered || false,
      },
      include: {
        commune: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorUser.id,
        action: 'TRANSPORT_STOP_CREATED',
        targetModule: 'TRANSPORT_LINES',
        targetRecordId: stop.id,
        newValues: { code: cleanedCode, latitude: data.latitude, longitude: data.longitude },
      },
    });

    return stop;
  }

  /**
   * Assigns ordered stops to a line.
   */
  static async assignStopsToLine({ lineId, stops }, actorUser) {
    const line = await prisma.transportLine.findUnique({ where: { id: lineId } });
    if (!line) throw new AppError('Ligne introuvable.', 404, 'LINE_NOT_FOUND');

    return await prisma.$transaction(async (tx) => {
      // Clear existing stops for direction and replace
      for (const item of stops) {
        await tx.lineStop.upsert({
          where: {
            lineId_stopId_direction: {
              lineId,
              stopId: item.stopId,
              direction: item.direction || 'ALLER',
            },
          },
          update: {
            stopOrder: item.stopOrder,
          },
          create: {
            lineId,
            stopId: item.stopId,
            stopOrder: item.stopOrder,
            direction: item.direction || 'ALLER',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actorUser.id,
          action: 'LINE_STOPS_UPDATED',
          targetModule: 'TRANSPORT_LINES',
          targetRecordId: lineId,
          newValues: { stopsCount: stops.length },
        },
      });

      return { success: true, count: stops.length };
    });
  }

  /**
   * Returns all active transport lines serialized as GeoJSON FeatureCollection.
   */
  static async getLinesGeoJson() {
    const lines = await prisma.transportLine.findMany({
      where: { isActive: true },
      include: {
        stops: {
          include: { stop: true },
          orderBy: { stopOrder: 'asc' },
        },
      },
    });

    return {
      type: 'FeatureCollection',
      features: lines.map((line) => GisCalculationService.toGeoJsonFeature(line)),
    };
  }

  /**
   * Returns all bus stops serialized as GeoJSON FeatureCollection.
   */
  static async getStopsGeoJson() {
    const stops = await prisma.transportStop.findMany({
      include: { commune: true },
      orderBy: { name: 'asc' },
    });

    return GisCalculationService.stopsToGeoJson(stops);
  }

  /**
   * List lines with assigned vehicles and stops.
   */
  static async listLines() {
    return await prisma.transportLine.findMany({
      include: {
        _count: { select: { stops: true, assignments: true } },
      },
      orderBy: { code: 'asc' },
    });
  }
}

export default TransportLinesService;
