import crypto from 'crypto';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../middlewares/errorHandler.js';
import SocketService from '../../services/socketService.js';

export class MissionReportsService {
  /**
   * Generate sequential report reference (e.g. RAP-2026-00042).
   */
  static async generateReportReference() {
    const year = new Date().getFullYear();
    const count = await prisma.missionReport.count();
    const seq = String(count + 1).padStart(5, '0');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `RAP-${year}-${seq}-${randomSuffix}`;
  }

  /**
   * List mission reports with territory scoping.
   */
  static async listReports(user, query = {}) {
    const {
      page = 1,
      limit = 50,
      status,
      communeId,
      search,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      where.OR = [
        { leadAuthorId: user.id },
        {
          assignment: {
            OR: [
              { assignedUserId: user.id },
              { assignedAgents: { some: { agentUserId: user.id } } },
            ],
          },
        },
      ];
    } else if (isChef) {
      where.assignment = { communeId: user.communeId };
    } else if (communeId) {
      where.assignment = { communeId };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      const searchConditions = [
        { reference: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { assignment: { reference: { contains: search, mode: 'insensitive' } } },
        { assignment: { title: { contains: search, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [reports, total] = await Promise.all([
      prisma.missionReport.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          leadAuthor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          assignment: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              commune: { select: { id: true, code: true, name: true } },
            },
          },
          _count: {
            select: { versions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.missionReport.count({ where }),
    ]);

    return {
      items: reports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Retrieve report by ID with all historical versions and contributions.
   */
  static async getReportById(user, id) {
    const report = await prisma.missionReport.findUnique({
      where: { id },
      include: {
        leadAuthor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            phoneNumber: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignment: {
          include: {
            commune: { select: { id: true, code: true, name: true } },
            assignedAgents: {
              include: {
                agentUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                    jobTitle: true,
                  },
                },
              },
            },
            inspections: {
              include: {
                agentUser: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
                documents: true,
              },
              orderBy: { inspectedAt: 'desc' },
            },
          },
        },
        versions: {
          include: {
            submittedByUser: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
            reviewedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!report) {
      throw new AppError('Rapport de mission introuvable.', 404, 'REPORT_NOT_FOUND');
    }

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      const isAssigned = report.leadAuthorId === user.id ||
        report.assignment.assignedUserId === user.id ||
        report.assignment.assignedAgents?.some((a) => a.agentUserId === user.id);
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous n êtes pas autorisé à consulter ce rapport.', 403, 'FORBIDDEN');
      }
    } else if (isChef) {
      if (report.assignment.communeId !== user.communeId) {
        throw new AppError('Accès interdit : ce rapport appartient à une autre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
    }

    return report;
  }

  /**
   * Retrieve report by Assignment/Mission ID.
   */
  static async getReportByAssignmentId(user, assignmentId) {
    const report = await prisma.missionReport.findUnique({
      where: { assignmentId },
      include: {
        leadAuthor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignment: {
          include: {
            commune: { select: { id: true, code: true, name: true } },
            assignedAgents: {
              include: {
                agentUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                  },
                },
              },
            },
            inspections: true,
          },
        },
        versions: {
          include: {
            submittedByUser: { select: { id: true, firstName: true, lastName: true } },
            reviewedByUser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!report) {
      return null;
    }

    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');

    if (isAgent) {
      const isAssigned = report.leadAuthorId === user.id ||
        report.assignment.assignedUserId === user.id ||
        report.assignment.assignedAgents?.some((a) => a.agentUserId === user.id);
      if (!isAssigned) {
        throw new AppError('Accès refusé : vous n êtes pas autorisé à consulter ce rapport.', 403, 'FORBIDDEN');
      }
    } else if (isChef) {
      if (report.assignment.communeId !== user.communeId) {
        throw new AppError('Accès interdit : ce rapport appartient à une autre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
    }

    return report;
  }

  /**
   * Save draft or submit a shared mission report.
   * Lead agent coordinates; other assigned agents can contribute.
   */
  static async saveOrSubmitReport(user, data, isSubmit = false) {
    const targetMissionId = data.assignmentId || data.missionId;
    if (!targetMissionId) {
      throw new AppError('Identifiant de la mission requis.', 400, 'MISSION_ID_REQUIRED');
    }

    const assignment = await prisma.fieldAssignment.findUnique({
      where: { id: targetMissionId },
      include: {
        assignedAgents: true,
        inspections: true,
      },
    });

    if (!assignment) {
      throw new AppError('Mission de rattachement introuvable.', 404, 'MISSION_NOT_FOUND');
    }

    if (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED') {
      throw new AppError(
        `Impossible de soumettre un rapport pour une mission ${assignment.status === 'COMPLETED' ? 'terminée' : 'annulée'}.`,
        400,
        'MISSION_TERMINATED'
      );
    }

    // Agent assignment verification
    const isAgent = user.roles?.includes('AGENT_TERRAIN') && !user.roles?.includes('CHEF_SERVICE') && !user.roles?.includes('SUPER_ADMIN') && !user.roles?.includes('DIRECTOR');
    if (isAgent) {
      const assignedRecord = assignment.assignedAgents.find((a) => a.agentUserId === user.id);
      const isLead = (assignedRecord && assignedRecord.roleInMission === 'LEAD') || assignment.assignedUserId === user.id;

      if (!assignedRecord && assignment.assignedUserId !== user.id) {
        throw new AppError('Accès refusé : vous n êtes pas assigné à cette mission.', 403, 'FORBIDDEN_ASSIGNMENT');
      }

      // Only the LEAD agent can formally submit the report for review
      if (isSubmit && !isLead) {
        throw new AppError(
          'Seul l agent désigné CHEF DE MISSION (LEAD) peut soumettre officiellement le rapport de mission.',
          403,
          'LEAD_AGENT_REQUIRED'
        );
      }
    }

    // Auto-calculate inspections and violations count from real PostgreSQL records
    const inspectionsCount = assignment.inspections.length;
    let violationsCount = 0;
    for (const insp of assignment.inspections) {
      if (insp.outcome === 'NON_CONFORME' || insp.outcome === 'IMMOBILISATION' || insp.outcome === 'AVEC_RESERVES') {
        violationsCount++;
      }
    }

    const existingReport = await prisma.missionReport.findUnique({
      where: { assignmentId: assignment.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    const reportStatus = isSubmit ? 'SUBMITTED' : (existingReport ? existingReport.status : 'DRAFT');

    const result = await prisma.$transaction(async (tx) => {
      let report;
      let versionToCreate = null;

      if (!existingReport) {
        const reference = await this.generateReportReference();
        report = await tx.missionReport.create({
          data: {
            reference,
            assignmentId: assignment.id,
            leadAuthorId: user.id,
            currentVersion: 1,
            status: reportStatus,
            summary: data.executiveSummary || data.summary || 'Rapport de mission de terrain AOTUC',
            objectivesAssessed: data.objectivesAssessed || null,
            inspectionsCount,
            violationsCount,
            observations: data.observations || null,
            recommendations: data.recommendations || null,
            conclusions: data.conclusions || null,
            contributors: data.contributors || [
              { userId: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim(), role: 'LEAD', timestamp: new Date().toISOString() },
            ],
            evidencePhotos: data.evidencePhotos || [],
            submittedAt: isSubmit ? new Date() : null,
          },
        });

        if (isSubmit) {
          versionToCreate = 1;
        }
      } else {
        // If report was previously CHANGES_REQUESTED or REJECTED and is being resubmitted, bump version
        let nextVersion = existingReport.currentVersion;
        if (isSubmit && existingReport.status === 'CHANGES_REQUESTED') {
          nextVersion = existingReport.currentVersion + 1;
        }

        report = await tx.missionReport.update({
          where: { id: existingReport.id },
          data: {
            currentVersion: nextVersion,
            status: reportStatus,
            summary: data.executiveSummary !== undefined ? data.executiveSummary : (data.summary !== undefined ? data.summary : existingReport.summary),
            objectivesAssessed: data.objectivesAssessed !== undefined ? data.objectivesAssessed : existingReport.objectivesAssessed,
            inspectionsCount,
            violationsCount,
            observations: data.observations !== undefined ? data.observations : existingReport.observations,
            recommendations: data.recommendations !== undefined ? data.recommendations : existingReport.recommendations,
            conclusions: data.conclusions !== undefined ? data.conclusions : existingReport.conclusions,
            contributors: data.contributors || existingReport.contributors,
            evidencePhotos: data.evidencePhotos || existingReport.evidencePhotos,
            submittedAt: isSubmit ? new Date() : existingReport.submittedAt,
          },
        });

        if (isSubmit) {
          versionToCreate = nextVersion;
        }
      }

      // Create snapshot version upon submission
      if (isSubmit && versionToCreate) {
        await tx.missionReportVersion.upsert({
          where: {
            reportId_versionNumber: {
              reportId: report.id,
              versionNumber: versionToCreate,
            },
          },
          update: {
            summary: report.summary,
            objectivesAssessed: report.objectivesAssessed,
            inspectionsCount: report.inspectionsCount,
            violationsCount: report.violationsCount,
            observations: report.observations,
            recommendations: report.recommendations,
            conclusions: report.conclusions,
            contributors: report.contributors,
            evidencePhotos: report.evidencePhotos,
            submittedByUserId: user.id,
            submittedAt: new Date(),
          },
          create: {
            reportId: report.id,
            versionNumber: versionToCreate,
            summary: report.summary,
            objectivesAssessed: report.objectivesAssessed,
            inspectionsCount: report.inspectionsCount,
            violationsCount: report.violationsCount,
            observations: report.observations,
            recommendations: report.recommendations,
            conclusions: report.conclusions,
            contributors: report.contributors,
            evidencePhotos: report.evidencePhotos,
            submittedByUserId: user.id,
            submittedAt: new Date(),
          },
        });

        // Synchronize Mission Status to SUBMITTED
        await tx.fieldAssignment.update({
          where: { id: assignment.id },
          data: { status: 'SUBMITTED' },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: isSubmit ? 'MISSION_REPORT_SUBMITTED' : 'MISSION_REPORT_DRAFT_SAVED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: report.id,
          newValues: {
            reference: report.reference,
            assignmentId: assignment.id,
            version: report.currentVersion,
            status: report.status,
            isSubmit,
          },
        },
      });

      return report;
    });

    if (isSubmit) {
      SocketService.emitNotification(
        `commune:${assignment.communeId}`,
        'field:report_submitted',
        {
          id: result.id,
          reference: result.reference,
          assignmentId: assignment.id,
          author: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        }
      );
    }

    return result;
  }

  /**
   * Allow contributing agents to add observations and evidence to the shared mission report.
   * Every observation retains original author and timestamp.
   */
  static async contributeObservation(user, reportId, data) {
    const report = await prisma.missionReport.findUnique({
      where: { id: reportId },
      include: {
        assignment: {
          include: {
            assignedAgents: true,
          },
        },
      },
    });

    if (!report) {
      throw new AppError('Rapport de mission introuvable.', 404, 'REPORT_NOT_FOUND');
    }

    if (report.status === 'APPROVED') {
      throw new AppError('Impossible d ajouter des observations à un rapport déjà approuvé.', 400, 'REPORT_ALREADY_APPROVED');
    }

    // Scoping check: user must be assigned to the mission
    const isAssigned = report.assignment.assignedUserId === user.id ||
      report.assignment.assignedAgents?.some((a) => a.agentUserId === user.id) ||
      user.roles?.includes('SUPER_ADMIN') ||
      user.roles?.includes('CHEF_SERVICE');

    if (!isAssigned) {
      throw new AppError('Accès refusé : vous devez être membre de la mission pour y contribuer.', 403, 'FORBIDDEN');
    }

    const observationText = data.text || data.observation;
    if (!observationText || observationText.trim().length < 3) {
      throw new AppError('Le texte de l observation est requis (au moins 3 caractères).', 400, 'TEXT_REQUIRED');
    }

    const authorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const observationEntry = {
      id: crypto.randomUUID(),
      authorId: user.id,
      authorName,
      employeeNumber: user.employeeNumber || null,
      text: observationText.trim(),
      observation: observationText.trim(),
      photos: data.photos || [],
      timestamp: new Date().toISOString(),
    };

    const existingContributors = Array.isArray(report.contributors) ? report.contributors : [];
    existingContributors.push(observationEntry);

    const formattedNote = `\n[${new Date().toISOString()}] Contribution de ${authorName} :\n${observationText.trim()}`;
    const mergedObservations = report.observations ? `${report.observations}\n${formattedNote}` : formattedNote;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.missionReport.update({
        where: { id: reportId },
        data: {
          observations: mergedObservations,
          contributors: existingContributors,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: 'MISSION_REPORT_CONTRIBUTION_ADDED',
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: reportId,
          newValues: {
            observationId: observationEntry.id,
            authorId: user.id,
          },
        },
      });

      return res;
    });

    return {
      success: true,
      contribution: observationEntry,
      report: updated,
    };
  }

  /**
   * Supervisor Review Workflow: APPROVED | REJECTED | CHANGES_REQUESTED
   * Strictly enforces mandatory review notes and records version snapshot decision.
   */
  static async reviewReport(user, reportId, data) {
    const isSuperOrDirector = user.roles?.includes('SUPER_ADMIN') || user.roles?.includes('DIRECTOR');
    const isChef = user.roles?.includes('CHEF_SERVICE');

    if (!isSuperOrDirector && !isChef) {
      throw new AppError('Seuls les superviseurs et administrateurs peuvent valider un rapport de mission.', 403, 'FORBIDDEN');
    }

    const decision = data.decision;
    const reviewNotes = (data.reviewNotes || data.notes || data.supervisorComments || '').trim();
    if (!['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(decision)) {
      throw new AppError('Décision invalide. Valeurs acceptées: APPROVED, REJECTED, CHANGES_REQUESTED.', 400, 'INVALID_DECISION');
    }

    if (!reviewNotes || reviewNotes.length < 3) {
      throw new AppError('Les observations et motifs de revue sont obligatoires (au moins 3 caractères).', 400, 'REVIEW_NOTES_REQUIRED');
    }

    const report = await prisma.missionReport.findUnique({
      where: { id: reportId },
      include: {
        assignment: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!report) {
      throw new AppError('Rapport de mission introuvable.', 404, 'REPORT_NOT_FOUND');
    }

    if (isChef && !isSuperOrDirector) {
      if (report.assignment.communeId !== user.communeId) {
        throw new AppError('Accès refusé : ce rapport appartient à une autre commune.', 403, 'FORBIDDEN_COMMUNE_MISMATCH');
      }
    }

    if (report.status === 'DRAFT') {
      throw new AppError('Impossible de statuer sur un rapport qui n a pas encore été soumis.', 400, 'REPORT_NOT_SUBMITTED');
    }

    const decisionTime = new Date();
    const latestVersion = report.versions[0];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update active mission report
      const updatedReport = await tx.missionReport.update({
        where: { id: reportId },
        data: {
          status: decision,
          supervisorNotes: reviewNotes.trim(),
          reviewedByUserId: user.id,
          reviewedAt: decisionTime,
        },
      });

      // 2. Update active version snapshot decision
      if (latestVersion) {
        await tx.missionReportVersion.update({
          where: { id: latestVersion.id },
          data: {
            decision,
            reviewedByUserId: user.id,
            supervisorComments: reviewNotes.trim(),
            decisionAt: decisionTime,
          },
        });
      }

      // 3. Update Mission Assignment status
      let missionStatus = decision;
      if (decision === 'APPROVED') {
        missionStatus = 'COMPLETED';
      } else if (decision === 'REJECTED') {
        missionStatus = 'REJECTED';
      } else if (decision === 'CHANGES_REQUESTED') {
        missionStatus = 'CHANGES_REQUESTED';
      }

      await tx.fieldAssignment.update({
        where: { id: report.assignmentId },
        data: {
          status: missionStatus,
          supervisorNotes: `[${decisionTime.toISOString()}] Décision rapport (${decision}) par ${user.firstName || ''} ${user.lastName || ''} : ${reviewNotes.trim()}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: user?.id ? { connect: { id: user.id } } : undefined,
          action: `MISSION_REPORT_REVIEWED_${decision}`,
          targetModule: 'FIELD_OPERATIONS',
          targetRecordId: reportId,
          reason: reviewNotes.trim(),
          previousValues: { status: report.status },
          newValues: {
            status: decision,
            reviewedByUserId: user.id,
            decisionAt: decisionTime,
          },
        },
      });

      return updatedReport;
    });

    SocketService.emitNotification(
      `user:${report.leadAuthorId}`,
      'field:report_reviewed',
      {
        id: result.id,
        reference: result.reference,
        assignmentId: report.assignmentId,
        decision,
        supervisorNotes: reviewNotes.trim(),
      }
    );

    return result;
  }
}

export default MissionReportsService;
