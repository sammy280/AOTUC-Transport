import MissionReportsService from './mission-reports.service.js';
import PdfMissionReportService from '../../services/pdfMissionReportService.js';
import {
  submitReportSchema,
  reviewReportSchema,
} from './field-operations.schemas.js';

export class MissionReportsController {
  static async listReports(req, res, next) {
    try {
      const result = await MissionReportsService.listReports(req.user, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async getReportById(req, res, next) {
    try {
      const report = await MissionReportsService.getReportById(req.user, req.params.id);
      return res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  static async getReportByAssignmentId(req, res, next) {
    try {
      const report = await MissionReportsService.getReportByAssignmentId(req.user, req.params.assignmentId);
      return res.status(200).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  static async saveDraft(req, res, next) {
    try {
      const validatedBody = submitReportSchema.parse(req.body);
      const report = await MissionReportsService.saveOrSubmitReport(req.user, validatedBody, false);
      return res.status(200).json({
        success: true,
        message: 'Brouillon de rapport sauvegardé avec succès.',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  static async submitReport(req, res, next) {
    try {
      const validatedBody = submitReportSchema.parse(req.body);
      const report = await MissionReportsService.saveOrSubmitReport(req.user, validatedBody, true);
      return res.status(201).json({
        success: true,
        message: 'Rapport de mission soumis avec succès pour revue hiérarchique.',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  static async contributeObservation(req, res, next) {
    try {
      const result = await MissionReportsService.contributeObservation(req.user, req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Observation ajoutée avec succès au rapport partagé.',
        data: result.report,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reviewReport(req, res, next) {
    try {
      const validatedBody = reviewReportSchema.parse(req.body);
      const report = await MissionReportsService.reviewReport(req.user, req.params.id, validatedBody);
      return res.status(200).json({
        success: true,
        message: `Rapport de mission statué avec succès : ${report.status}.`,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadReportPdf(req, res, next) {
    try {
      const report = await MissionReportsService.getReportById(req.user, req.params.id);
      const pdfBuffer = await PdfMissionReportService.generateReportPdf(report);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="RAPPORT_${report.reference || report.id}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export default MissionReportsController;
