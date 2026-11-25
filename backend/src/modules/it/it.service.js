import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { RevocationRegistry } from '../../middlewares/authMiddleware.js';

const BACKUPS_DIR = path.resolve(process.cwd(), 'prisma', 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export class ITService {
  /**
   * Safe Foreign-Key Resolver for Actor in Audit Logs
   */
  static async resolveActorId(actorId) {
    if (!actorId) return null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true },
      });
      return user ? user.id : null;
    } catch {
      return null;
    }
  }

  /**
   * 1. Overview & Platform Metrics
   */
  static async getOverview() {
    try {
      const [
        totalUsers,
        totalDrivers,
        totalVehicles,
        totalOwners,
        totalPersons,
        totalCommunes,
        totalUnions,
        totalMissions,
        totalInspections,
        totalMissionReports,
        totalDocuments,
        totalValidationRequests,
        totalBadges,
        totalLicences,
        totalAuthorities,
        totalAuditLogs,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.driver.count(),
        prisma.vehicle.count(),
        prisma.owner.count(),
        prisma.person.count(),
        prisma.commune.count(),
        prisma.transportUnion.count(),
        prisma.fieldAssignment.count(),
        prisma.fieldInspection.count(),
        prisma.missionReport.count(),
        prisma.document.count(),
        prisma.validationRequest.count(),
        prisma.driverBadge.count(),
        prisma.transportLicence.count(),
        prisma.authority.count(),
        prisma.auditLog.count(),
      ]);

      // Database physical metrics
      let dbSize = 'N/A';
      let activeConnections = 1;
      let postgisVersion = 'N/A';

      try {
        const sizeRes = await prisma.$queryRawUnsafe(`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size;
        `);
        if (sizeRes && sizeRes[0]) dbSize = sizeRes[0].size;

        const connRes = await prisma.$queryRawUnsafe(`
          SELECT count(*)::int as active_connections 
          FROM pg_stat_activity 
          WHERE datname = current_database();
        `);
        if (connRes && connRes[0]) activeConnections = connRes[0].active_connections;

        const gisRes = await prisma.$queryRawUnsafe(`
          SELECT PostGIS_Version() as postgis;
        `);
        if (gisRes && gisRes[0]) postgisVersion = gisRes[0].postgis;
      } catch (dbMetricErr) {
        logger.warn('Could not query low-level PostgreSQL metrics:', dbMetricErr.message);
      }

      return {
        counts: {
          users: totalUsers,
          drivers: totalDrivers,
          vehicles: totalVehicles,
          owners: totalOwners,
          persons: totalPersons,
          communes: totalCommunes,
          unions: totalUnions,
          missions: totalMissions,
          inspections: totalInspections,
          missionReports: totalMissionReports,
          documents: totalDocuments,
          validationRequests: totalValidationRequests,
          driverBadges: totalBadges,
          transportLicences: totalLicences,
          authorities: totalAuthorities,
          auditLogs: totalAuditLogs,
        },
        database: {
          size: dbSize,
          activeConnections,
          postgisVersion,
          status: 'ONLINE',
          engine: 'PostgreSQL (Supabase)',
        },
        server: {
          uptimeSeconds: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      logger.error('IT getOverview failed:', err);
      throw new AppError(`Erreur lors de la récupération des métriques IT : ${err.message}`, 500);
    }
  }

  /**
   * 2. List Public Tables
   */
  static async getTablesList() {
    try {
      const tables = await prisma.$queryRawUnsafe(`
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC;
      `);
      return tables;
    } catch (err) {
      throw new AppError(`Erreur lors de la liste des tables : ${err.message}`, 500);
    }
  }

  /**
   * 3. Table Schema & Metadata Inspector
   */
  static async getTableSchema(tableName) {
    if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new AppError('Nom de table invalide.', 400);
    }

    try {
      // 1. Columns
      const columns = await prisma.$queryRawUnsafe(`
        SELECT 
          column_name, 
          data_type, 
          udt_name,
          is_nullable, 
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position ASC;
      `);

      if (!columns || columns.length === 0) {
        throw new AppError(`Table "${tableName}" introuvable dans le schéma public.`, 404);
      }

      // 2. Foreign Keys & Constraints
      const constraints = await prisma.$queryRawUnsafe(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = '${tableName}'
        ORDER BY tc.constraint_type, tc.constraint_name;
      `);

      // 3. Indexes
      const indexes = await prisma.$queryRawUnsafe(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = '${tableName}';
      `);

      // 4. Approximate or Exact Row Count
      const rowCountRes = await prisma.$queryRawUnsafe(`
        SELECT count(*)::bigint as total FROM "${tableName}";
      `);

      return {
        tableName,
        totalRows: Number(rowCountRes[0]?.total || 0),
        columns,
        constraints,
        indexes,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Erreur inspection schéma "${tableName}" : ${err.message}`, 500);
    }
  }

  /**
   * 4. Table Records Browser (Paginated)
   */
  static async getTableRecords(tableName, { page = 1, limit = 25, search = '', sortBy = 'id', sortOrder = 'desc' }) {
    if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new AppError('Nom de table invalide.', 400);
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (safePage - 1) * safeLimit;
    const safeOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Verify table exists
    const checkTable = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}';
    `);
    if (!checkTable || checkTable.length === 0) {
      throw new AppError(`Table "${tableName}" introuvable.`, 404);
    }

    // Verify sortBy column exists in table
    const checkCol = await prisma.$queryRawUnsafe(`
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' AND column_name = '${sortBy.replace(/[^a-zA-Z0-9_]/g, '')}';
    `);
    const validSortCol = checkCol && checkCol.length > 0 ? sortBy.replace(/[^a-zA-Z0-9_]/g, '') : null;

    try {
      const countRes = await prisma.$queryRawUnsafe(`SELECT count(*)::bigint as total FROM "${tableName}";`);
      const total = Number(countRes[0]?.total || 0);

      const orderClause = validSortCol ? `ORDER BY "${validSortCol}" ${safeOrder}` : '';
      const rows = await prisma.$queryRawUnsafe(`
        SELECT * FROM "${tableName}"
        ${orderClause}
        LIMIT ${safeLimit} OFFSET ${offset};
      `);

      return {
        tableName,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        rows,
      };
    } catch (err) {
      throw new AppError(`Erreur lecture table "${tableName}" : ${err.message}`, 500);
    }
  }

  /**
   * 5. Guarded SQL Console Execution
   */
  static async executeSQLQuery({ query, reason, requireConfirmation, actorId, ipAddress, userAgent }) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new AppError('Requête SQL obligatoire.', 400);
    }

    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();

    // 1. Guardrail against completely catastrophic commands
    const blockedKeywords = [
      'DROP DATABASE',
      'DROP SCHEMA',
      'TRUNCATE TABLE',
      'TRUNCATE ',
      'DROP TABLE',
    ];

    for (const kw of blockedKeywords) {
      if (upperQuery.includes(kw)) {
        logger.warn('IT SQL Console blocked catastrophic command', { actorId, query: trimmedQuery, blockedKeyword: kw });
        throw new AppError(
          `L'instruction "${kw}" est formellement bloquée via la console IT pour protéger la base de production. Contactez le DBA principal.`,
          403,
          'DANGEROUS_SQL_BLOCKED'
        );
      }
    }

    // 2. Identify statement type
    const isSelect = upperQuery.startsWith('SELECT') || upperQuery.startsWith('EXPLAIN') || upperQuery.startsWith('SHOW') || upperQuery.startsWith('WITH');
    const isMutation = upperQuery.startsWith('INSERT') || upperQuery.startsWith('UPDATE') || upperQuery.startsWith('DELETE') || upperQuery.startsWith('ALTER');

    if (isMutation) {
      if (!requireConfirmation) {
        throw new AppError(
          'Cette requête modifie la base de données de production. Vous devez cocher la case de confirmation explicite.',
          400,
          'CONFIRMATION_REQUIRED'
        );
      }
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        throw new AppError(
          'Un motif technique obligatoire (minimum 5 caractères) est requis pour toute modification de la base de données.',
          400,
          'REASON_REQUIRED'
        );
      }
    }

    const startTime = Date.now();

    try {
      let result;
      let rowCount = 0;

      if (isSelect) {
        // Enforce safe upper limit on SELECT without LIMIT
        let executableQuery = trimmedQuery;
        if (!upperQuery.includes('LIMIT ') && upperQuery.startsWith('SELECT')) {
          executableQuery = `${trimmedQuery.replace(/;$/, '')} LIMIT 200;`;
        }
        result = await prisma.$queryRawUnsafe(executableQuery);
        rowCount = Array.isArray(result) ? result.length : 1;
      } else {
        rowCount = await prisma.$executeRawUnsafe(trimmedQuery);
        result = { affectedRows: rowCount };
      }

      const executionTimeMs = Date.now() - startTime;

      // 3. Mandatory Audit Record for Mutations
      if (isMutation) {
        try {
          const validActorId = await ITService.resolveActorId(actorId);
          await prisma.auditLog.create({
            data: {
              actor: validActorId ? { connect: { id: validActorId } } : undefined,
              action: 'DATABASE_SQL_MUTATION',
              targetModule: 'DATABASE',
              targetRecordId: 'SQL_CONSOLE',
              reason: `[IT-SQL] ${reason.trim()} | Requête: ${trimmedQuery.substring(0, 500)} | Lignes affectées: ${rowCount}`,
              newValues: {
                query: trimmedQuery,
                rowCount,
                executionTimeMs,
                operatorIdentifier: validActorId ? undefined : actorId,
              },
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
            },
          });
        } catch (auditErr) {
          logger.error('Failed to create audit log for SQL console mutation:', auditErr.message);
        }
      }

      return {
        query: trimmedQuery,
        queryType: isSelect ? 'SELECT' : 'MUTATION',
        rowCount,
        executionTimeMs,
        rows: isSelect ? result : null,
        affectedRows: isMutation ? rowCount : null,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      logger.error('IT SQL execution failed:', { error: err.message, query: trimmedQuery });
      throw new AppError(`Erreur d'exécution SQL : ${err.message}`, 400);
    }
  }

  /**
   * 6. List Backups
   */
  static async listBackups() {
    try {
      const files = fs.readdirSync(BACKUPS_DIR);
      const backupList = [];

      for (const file of files) {
        if (!file.endsWith('.json') && !file.endsWith('.sql')) continue;
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);

        let metadata = null;
        if (file.endsWith('.json')) {
          try {
            const previewContent = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(previewContent);
            metadata = {
              description: parsed.description || null,
              counts: parsed.counts || (parsed.data ? Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])) : null),
              createdAt: parsed.createdAt || stats.birthtime.toISOString(),
            };
          } catch {
            // Non-fatal parse failure
          }
        }

        backupList.push({
          fileName: file,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          modifiedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString(),
          metadata,
        });
      }

      backupList.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
      return backupList;
    } catch (err) {
      throw new AppError(`Erreur lors de la lecture des sauvegardes : ${err.message}`, 500);
    }
  }

  /**
   * 7. Create Instant Database Backup
   */
  static async createBackup({ reason = 'Sauvegarde manuelle IT', actorId, ipAddress, userAgent }) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `aotuc_manual_backup_${timestamp}.json`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    logger.info('Starting manual database backup by IT...', { actorId, reason });

    try {
      const [
        communes,
        roles,
        users,
        userRoles,
        persons,
        drivers,
        owners,
        vehicles,
        vehicleInspections,
        vehicleAssignments,
        unions,
        authorities,
        documents,
        validationRequests,
        validationSteps,
        driverBadges,
        transportLicences,
        fieldAssignments,
        fieldInspections,
        missionReports,
        missionReportVersions,
      ] = await Promise.all([
        prisma.commune.findMany(),
        prisma.role.findMany(),
        prisma.user.findMany({ select: { id: true, email: true, phoneNumber: true, firstName: true, lastName: true, jobTitle: true, isActive: true, accountStatus: true, communeId: true, unionId: true, createdAt: true, updatedAt: true } }),
        prisma.userRole.findMany(),
        prisma.person.findMany(),
        prisma.driver.findMany(),
        prisma.owner.findMany(),
        prisma.vehicle.findMany(),
        prisma.vehicleInspection.findMany(),
        prisma.vehicleAssignment.findMany(),
        prisma.transportUnion.findMany(),
        prisma.authority.findMany(),
        prisma.document.findMany(),
        prisma.validationRequest.findMany(),
        prisma.validationStep.findMany(),
        prisma.driverBadge.findMany(),
        prisma.transportLicence.findMany(),
        prisma.fieldAssignment.findMany(),
        prisma.fieldInspection.findMany(),
        prisma.missionReport.findMany(),
        prisma.missionReportVersion.findMany(),
      ]);

      const backupData = {
        createdAt: new Date().toISOString(),
        description: `Sauvegarde complète initiée par IT: ${reason}`,
        createdById: actorId || null,
        counts: {
          communes: communes.length,
          roles: roles.length,
          users: users.length,
          userRoles: userRoles.length,
          persons: persons.length,
          drivers: drivers.length,
          owners: owners.length,
          vehicles: vehicles.length,
          vehicleInspections: vehicleInspections.length,
          vehicleAssignments: vehicleAssignments.length,
          unions: unions.length,
          authorities: authorities.length,
          documents: documents.length,
          validationRequests: validationRequests.length,
          validationSteps: validationSteps.length,
          driverBadges: driverBadges.length,
          transportLicences: transportLicences.length,
          fieldAssignments: fieldAssignments.length,
          fieldInspections: fieldInspections.length,
          missionReports: missionReports.length,
          missionReportVersions: missionReportVersions.length,
        },
        data: {
          communes,
          roles,
          users,
          userRoles,
          persons,
          drivers,
          owners,
          vehicles,
          vehicleInspections,
          vehicleAssignments,
          unions,
          authorities,
          documents,
          validationRequests,
          validationSteps,
          driverBadges,
          transportLicences,
          fieldAssignments,
          fieldInspections,
          missionReports,
          missionReportVersions,
        },
      };

      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
      const stats = fs.statSync(backupFilePath);

      // Audit Log
      try {
        const validActorId = await ITService.resolveActorId(actorId);
        await prisma.auditLog.create({
          data: {
            actor: validActorId ? { connect: { id: validActorId } } : undefined,
            action: 'BACKUP_CREATED',
            targetModule: 'DATABASE',
            targetRecordId: backupFileName,
            reason: `[IT] Création de sauvegarde: ${reason}`,
            newValues: {
              fileName: backupFileName,
              sizeBytes: stats.size,
              counts: backupData.counts,
              operatorIdentifier: validActorId ? undefined : actorId,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });
      } catch (auditErr) {
        logger.error('Failed to log audit for backup creation:', auditErr.message);
      }

      return {
        fileName: backupFileName,
        filePath: backupFilePath,
        sizeBytes: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        counts: backupData.counts,
        createdAt: backupData.createdAt,
      };
    } catch (err) {
      logger.error('Backup creation failed:', err);
      throw new AppError(`Échec de la création de la sauvegarde : ${err.message}`, 500);
    }
  }

  /**
   * 8. Targeted Data Recovery from Backup
   */
  static async restoreTargeted({ backupFileName, entityType, reason, actorId, ipAddress, userAgent }) {
    if (!backupFileName || !/^[a-zA-Z0-9_\-\.]+\.json$/.test(backupFileName)) {
      throw new AppError('Nom de fichier de sauvegarde invalide.', 400);
    }
    if (!reason || reason.trim().length < 5) {
      throw new AppError('Motif obligatoire (au moins 5 caractères) pour la restauration ciblée.', 400);
    }

    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);
    if (!fs.existsSync(backupFilePath)) {
      throw new AppError(`Fichier de sauvegarde introuvable : ${backupFileName}`, 404);
    }

    const allowedEntities = ['driver', 'vehicle', 'owner', 'person'];
    if (!allowedEntities.includes(entityType)) {
      throw new AppError(`Type d'entité non pris en charge pour la restauration ciblée. Types valides : ${allowedEntities.join(', ')}`, 400);
    }

    try {
      const backupContent = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const recordsToInspect = backupContent.data?.[entityType] || backupContent.data?.[`${entityType}s`] || [];

      if (!Array.isArray(recordsToInspect) || recordsToInspect.length === 0) {
        return { restoredCount: 0, message: `Aucun enregistrement de type "${entityType}" trouvé dans cette sauvegarde.` };
      }

      let restoredCount = 0;
      const restoredIds = [];

      // Check existing IDs in DB to restore only missing records without overwriting
      for (const rec of recordsToInspect) {
        if (!rec.id) continue;

        if (entityType === 'person') {
          const exists = await prisma.person.findUnique({ where: { id: rec.id } });
          if (!exists) {
            await prisma.person.create({ data: rec });
            restoredCount++;
            restoredIds.push(rec.id);
          }
        } else if (entityType === 'owner') {
          const exists = await prisma.owner.findUnique({ where: { id: rec.id } });
          if (!exists) {
            await prisma.owner.create({ data: rec });
            restoredCount++;
            restoredIds.push(rec.id);
          }
        } else if (entityType === 'driver') {
          const exists = await prisma.driver.findUnique({ where: { id: rec.id } });
          if (!exists) {
            // Ensure referenced person exists
            if (rec.personId) {
              const personExists = await prisma.person.findUnique({ where: { id: rec.personId } });
              if (!personExists) {
                const personInBackup = (backupContent.data?.person || []).find((p) => p.id === rec.personId);
                if (personInBackup) {
                  await prisma.person.create({ data: personInBackup });
                }
              }
            }
            await prisma.driver.create({ data: rec });
            restoredCount++;
            restoredIds.push(rec.id);
          }
        } else if (entityType === 'vehicle') {
          const exists = await prisma.vehicle.findUnique({ where: { id: rec.id } });
          if (!exists) {
            await prisma.vehicle.create({ data: rec });
            restoredCount++;
            restoredIds.push(rec.id);
          }
        }
      }

      // Audit Log
      try {
        const validActorId = await ITService.resolveActorId(actorId);
        await prisma.auditLog.create({
          data: {
            actor: validActorId ? { connect: { id: validActorId } } : undefined,
            action: 'BACKUP_TARGETED_RESTORE',
            targetModule: 'DATABASE',
            targetRecordId: backupFileName,
            reason: `[IT] Restauration ciblée (${entityType}): ${reason} | Restaurés: ${restoredCount}`,
            newValues: {
              backupFileName,
              entityType,
              restoredCount,
              restoredIds,
              operatorIdentifier: validActorId ? undefined : actorId,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });
      } catch (auditErr) {
        logger.error('Failed to log audit for targeted restore:', auditErr.message);
      }

      return {
        backupFileName,
        entityType,
        restoredCount,
        restoredIds,
        message: `Restauration ciblée terminée : ${restoredCount} enregistrement(s) restauré(s).`,
      };
    } catch (err) {
      logger.error('Targeted restore error:', err);
      throw new AppError(`Échec de la restauration ciblée : ${err.message}`, 500);
    }
  }

  /**
   * 9. Migration History
   */
  static async getMigrationHistory() {
    try {
      const migrations = await prisma.$queryRawUnsafe(`
        SELECT 
          id,
          checksum,
          finished_at,
          migration_name,
          logs,
          rolled_back_at,
          started_at,
          applied_steps_count
        FROM _prisma_migrations
        ORDER BY started_at DESC;
      `);
      return migrations;
    } catch (err) {
      logger.warn('Could not read _prisma_migrations table:', err.message);
      return [];
    }
  }

  /**
   * 10. System Diagnostics & Error Monitoring
   */
  static async getDiagnostics() {
    try {
      // 1. Database latency test
      const t0 = Date.now();
      await prisma.$queryRawUnsafe(`SELECT 1;`);
      const dbLatencyMs = Date.now() - t0;

      // 2. Recent Audit Trail of Sensitive Operations
      const recentAudits = await prisma.auditLog.findMany({
        take: 30,
        orderBy: { timestamp: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });

      return {
        system: {
          status: 'OPERATIONAL',
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptimeSeconds: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          pid: process.pid,
        },
        database: {
          latencyMs: dbLatencyMs,
          status: 'CONNECTED',
        },
        recentAudits,
      };
    } catch (err) {
      throw new AppError(`Erreur diagnostics système : ${err.message}`, 500);
    }
  }

  /**
   * 11. Safe User Deletion with Attribution & Historical Record Preservation
   * Mandatory: Deleting a user must never delete their created records, missions, inspections or audit logs.
   */
  static async deleteUserSafely({ userId, reason, actorId, ipAddress, userAgent }) {
    if (!userId) {
      throw new AppError('Identifiant utilisateur manquant.', 400);
    }
    if (!reason || reason.trim().length < 5) {
      throw new AppError('Un motif de suppression obligatoire (au moins 5 caractères) est requis.', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new AppError('Utilisateur introuvable.', 404);
    }

    if (user.id === actorId) {
      throw new AppError('Impossible de supprimer votre propre compte utilisateur actif.', 400);
    }

    try {
      // 1. Immediately revoke session in memory
      RevocationRegistry.deactivateUser(userId);

      // 2. Remove refresh tokens
      await prisma.refreshToken.deleteMany({ where: { userId } });

      // 3. Remove assigned roles
      await prisma.userRole.deleteMany({ where: { userId } });

      // 4. Archive & deactivate the user record, scrambling credentials while preserving
      // all foreign key references in missions, inspections, validation steps, receipts, and audits.
      const timestamp = Date.now();
      const archivedEmail = user.email ? `deleted_${timestamp}_${user.email}` : null;
      const archivedPhone = `del_${timestamp}_${user.phoneNumber}`;
      const scrambledHash = crypto.randomBytes(32).toString('hex');

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          accountStatus: 'INACTIVE',
          email: archivedEmail,
          phoneNumber: archivedPhone,
          passwordHash: scrambledHash,
          firstName: `[ARCHIVÉ] ${user.firstName}`,
          lastName: `[SUPPRIMÉ] ${user.lastName}`,
          jobTitle: user.jobTitle ? `[DÉSACTIVÉ] ${user.jobTitle}` : '[DÉSACTIVÉ]',
        },
      });

      // 5. Audit Log
      try {
        const validActorId = await ITService.resolveActorId(actorId);
        await prisma.auditLog.create({
          data: {
            actor: validActorId ? { connect: { id: validActorId } } : undefined,
            action: 'USER_DELETED_SAFE_ARCHIVE',
            targetModule: 'USERS',
            targetRecordId: userId,
            reason: `[IT] Suppression/Archivage sécurisé de l'utilisateur ${user.firstName} ${user.lastName} (${user.phoneNumber}): ${reason}`,
            previousValues: {
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              email: user.email,
              roles: user.roles.map((r) => r.role.name),
            },
            newValues: {
              isActive: false,
              accountStatus: 'INACTIVE',
              archivedAt: new Date().toISOString(),
              operatorIdentifier: validActorId ? undefined : actorId,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });
      } catch (auditErr) {
        logger.error('Failed to log audit for safe user deletion:', auditErr.message);
      }

      return {
        success: true,
        message: `Compte de ${user.firstName} ${user.lastName} supprimé et archivé en toute sécurité. Les historiques opérationnels et d'audit ont été rigoureusement préservés.`,
        userId: updatedUser.id,
      };
    } catch (err) {
      logger.error('Safe user deletion failed:', err);
      throw new AppError(`Échec de la suppression sécurisée de l'utilisateur : ${err.message}`, 500);
    }
  }

  /**
   * 12. Safe Operational Record Deletion with Audit Logging
   */
  static async deleteOperationalRecord({ entityType, recordId, reason, actorId, ipAddress, userAgent }) {
    if (!recordId) throw new AppError('Identifiant d enregistrement manquant.', 400);
    if (!reason || reason.trim().length < 5) {
      throw new AppError('Motif obligatoire (au moins 5 caractères) pour supprimer un enregistrement opérationnel.', 400);
    }

    const validEntities = ['driver', 'vehicle', 'owner', 'transportUnion', 'fieldAssignment', 'authority'];
    if (!validEntities.includes(entityType)) {
      throw new AppError(`Type d entité "${entityType}" non autorisé pour suppression directe.`, 400);
    }

    let deletedRecord = null;

    try {
      if (entityType === 'driver') {
        const existing = await prisma.driver.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Chauffeur introuvable.', 404);
        deletedRecord = await prisma.driver.delete({ where: { id: recordId } });
      } else if (entityType === 'vehicle') {
        const existing = await prisma.vehicle.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Véhicule introuvable.', 404);
        deletedRecord = await prisma.vehicle.delete({ where: { id: recordId } });
      } else if (entityType === 'owner') {
        const existing = await prisma.owner.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Propriétaire introuvable.', 404);
        deletedRecord = await prisma.owner.delete({ where: { id: recordId } });
      } else if (entityType === 'transportUnion') {
        const existing = await prisma.transportUnion.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Syndicat introuvable.', 404);
        deletedRecord = await prisma.transportUnion.delete({ where: { id: recordId } });
      } else if (entityType === 'fieldAssignment') {
        const existing = await prisma.fieldAssignment.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Mission de terrain introuvable.', 404);
        deletedRecord = await prisma.fieldAssignment.delete({ where: { id: recordId } });
      } else if (entityType === 'authority') {
        const existing = await prisma.authority.findUnique({ where: { id: recordId } });
        if (!existing) throw new AppError('Autorité introuvable.', 404);
        deletedRecord = await prisma.authority.delete({ where: { id: recordId } });
      }

      // Mandatory Audit Record
      try {
        const validActorId = await ITService.resolveActorId(actorId);
        await prisma.auditLog.create({
          data: {
            actor: validActorId ? { connect: { id: validActorId } } : undefined,
            action: `RECORD_DELETED_${entityType.toUpperCase()}`,
            targetModule: 'RECORDS',
            targetRecordId: recordId,
            reason: `[IT] Suppression enregistrement ${entityType}: ${reason}`,
            previousValues: deletedRecord,
            newValues: {
              operatorIdentifier: validActorId ? undefined : actorId,
            },
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          },
        });
      } catch (auditErr) {
        logger.error('Failed to log audit for record deletion:', auditErr.message);
      }

      return {
        success: true,
        message: `Enregistrement ${entityType} (${recordId}) supprimé avec succès.`,
        deletedRecord,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Operational record deletion failed:', err);
      throw new AppError(`Échec de la suppression de l'enregistrement : ${err.message}`, 500);
    }
  }
}

export default ITService;
