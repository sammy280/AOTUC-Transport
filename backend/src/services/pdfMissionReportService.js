import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AOTUC_BRANDING } from '../config/branding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OFFICIAL_LOGO_PATH = path.resolve(__dirname, '../../assets/aotuc-logo.png');

export class PdfMissionReportService {
  /**
   * Generates an official, publication-quality A4 PDF for an AOTUC Mission Report.
   * Includes Republic of Guinea branding, official insignia, brigade roster,
   * executive summary, inspection KPIs, multi-agent observations log, and validation stamp.
   * @param {Object} report Full report database object with assignment, leadAuthor, etc.
   * @returns {Promise<Buffer>}
   */
  static async generateReportPdf(report) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 36, left: 40, right: 40 },
        info: {
          Title: `AOTUC - Rapport de Mission ${report.reference}`,
          Author: 'AOTUC Guinée',
          Subject: report.assignment?.title || 'Rapport de Mission de Terrain',
          Keywords: 'AOTUC, Guinée, Transport, Rapport, Contrôle',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = 595.28;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // 1. Guinea Flag Tricolor Top Stripe (Red, Yellow, Green)
      const stripeWidth = pageWidth / 3;
      doc.rect(0, 0, stripeWidth, 5).fill(AOTUC_BRANDING.colors.accentRed);
      doc.rect(stripeWidth, 0, stripeWidth, 5).fill(AOTUC_BRANDING.colors.accentYellow);
      doc.rect(stripeWidth * 2, 0, stripeWidth, 5).fill(AOTUC_BRANDING.colors.accentGreen);

      let y = 20;

      // 2. Official Institutional Header
      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, margin, y, { width: 44, height: 44 });
        } catch (_) {}
      }

      // Left Header: Republic of Guinea
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#1E293B')
        .text('RÉPUBLIQUE DE GUINÉE', margin + 52, y, { align: 'left' })
        .font('Helvetica-Oblique')
        .fontSize(7.5)
        .fillColor('#64748B')
        .text('Travail — Justice — Solidarité', margin + 52, y + 12)
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#0F172A')
        .text('MINISTÈRE DES TRANSPORTS', margin + 52, y + 23);

      // Right Header: AOTUC Official Header
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(AOTUC_BRANDING.colors.primaryNavy)
        .text(AOTUC_BRANDING.fullName, margin + 200, y, {
          width: contentWidth - 200,
          align: 'right',
        })
        .font('Helvetica-Oblique')
        .fontSize(7)
        .fillColor(AOTUC_BRANDING.colors.mottoSky)
        .text(AOTUC_BRANDING.mottoQuote, margin + 200, y + 24, {
          width: contentWidth - 200,
          align: 'right',
        });

      y += 50;

      // Divider Line
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).strokeColor('#CBD5E1').lineWidth(0.8).stroke();
      y += 12;

      // 3. Document Title Banner
      doc.rect(margin, y, contentWidth, 32).fill(AOTUC_BRANDING.colors.primaryNavy);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#FFFFFF')
        .text("RAPPORT OFFICIEL D'OPÉRATION & CONTRÔLE ROUTIER", margin, y + 6, {
          width: contentWidth,
          align: 'center',
        })
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('Brigades de terrain • Supervision des transports urbains de Conakry', margin, y + 20, {
          width: contentWidth,
          align: 'center',
        });

      y += 42;

      // 4. Mission & Report Identification Card
      doc.rect(margin, y, contentWidth, 68).fill('#F8FAFC');
      doc.rect(margin, y, contentWidth, 68).strokeColor('#E2E8F0').lineWidth(0.8).stroke();

      // Top bar in card
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('RÉFÉRENCE RAPPORT :', margin + 10, y + 8)
        .font('Courier-Bold')
        .fontSize(9)
        .fillColor(AOTUC_BRANDING.colors.primaryNavy)
        .text(report.reference || 'N/A', margin + 115, y + 7);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('VERSION :', margin + 300, y + 8)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#0284C7')
        .text(`v${report.currentVersion || 1}`, margin + 355, y + 8);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('STATUT :', margin + 420, y + 8)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(report.status === 'APPROVED' ? '#059669' : '#D97706')
        .text(report.status || 'DRAFT', margin + 465, y + 8);

      // Row 2: Mission Title & Commune
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('MISSION ASSOCIÉE :', margin + 10, y + 23)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0F172A')
        .text(report.assignment?.title || 'Non spécifiée', margin + 115, y + 23, { width: 340 });

      // Row 3: Commune & Location
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('COMMUNE & LIEU :', margin + 10, y + 38)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0F172A')
        .text(
          `${report.assignment?.commune?.name || 'Conakry'} • ${report.assignment?.locationName || 'Zone d intervention'}`,
          margin + 115,
          y + 38
        );

      // Row 4: Author / Lead Agent
      const leadName = report.leadAuthor
        ? `${report.leadAuthor.firstName} ${report.leadAuthor.lastName} (${report.leadAuthor.employeeNumber || 'Agent Lead'})`
        : 'Agent Chef de Mission';

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('AUTEUR PRINCIPAL :', margin + 10, y + 53)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0F172A')
        .text(leadName, margin + 115, y + 53);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#334155')
        .text('DATE D ÉMISSION :', margin + 340, y + 53)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0F172A')
        .text(
          new Date(report.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }),
          margin + 430,
          y + 53
        );

      y += 78;

      // 5. Operational Statistics Summary (KPIs)
      const kpiBoxWidth = (contentWidth - 24) / 4;
      const kpis = [
        { label: 'CONTRÔLES MENÉS', value: report.inspectionsCount || 0, color: '#0F172A' },
        { label: 'INFRACTIONS CONSTATÉES', value: report.violationsCount || 0, color: '#DC2626' },
        {
          label: 'OBSERVATIONS REÇUES',
          value: Array.isArray(report.contributors) ? report.contributors.length : 0,
          color: '#2563EB',
        },
        {
          label: 'TAUX CONFORMITÉ',
          value:
            report.inspectionsCount > 0
              ? `${Math.round(((report.inspectionsCount - (report.violationsCount || 0)) / report.inspectionsCount) * 100)}%`
              : '100%',
          color: '#059669',
        },
      ];

      kpis.forEach((kpi, idx) => {
        const xPos = margin + idx * (kpiBoxWidth + 8);
        doc.rect(xPos, y, kpiBoxWidth, 38).fill('#F1F5F9');
        doc.rect(xPos, y, kpiBoxWidth, 38).strokeColor('#E2E8F0').lineWidth(0.6).stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor(kpi.color)
          .text(String(kpi.value), xPos, y + 6, { width: kpiBoxWidth, align: 'center' })
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#64748B')
          .text(kpi.label, xPos, y + 24, { width: kpiBoxWidth, align: 'center' });
      });

      y += 48;

      // 6. Executive Summary Section
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor(AOTUC_BRANDING.colors.primaryNavy)
        .text('1. RÉSUMÉ EXÉCUTIF & DÉROULEMENT OPÉRATIONNEL', margin, y);

      y += 14;
      doc.rect(margin, y, contentWidth, 75).fill('#FAFAFA');
      doc.rect(margin, y, contentWidth, 75).strokeColor('#E2E8F0').lineWidth(0.6).stroke();

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#334155')
        .text(report.summary || 'Aucun résumé renseigné.', margin + 8, y + 8, {
          width: contentWidth - 16,
          lineGap: 3,
        });

      y += 85;

      // 7. Recommendations & Conclusions
      if (report.recommendations || report.conclusions) {
        const halfWidth = (contentWidth - 10) / 2;

        // Recommendations box
        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor(AOTUC_BRANDING.colors.primaryNavy)
          .text('2. RECOMMANDATIONS DU LEAD', margin, y);

        doc.rect(margin, y + 12, halfWidth, 55).fill('#FAFAFA');
        doc.rect(margin, y + 12, halfWidth, 55).strokeColor('#E2E8F0').lineWidth(0.6).stroke();

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#334155')
          .text(report.recommendations || 'Aucune recommandation particulière.', margin + 6, y + 18, {
            width: halfWidth - 12,
            lineGap: 2,
          });

        // Conclusions box
        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor(AOTUC_BRANDING.colors.primaryNavy)
          .text('3. CONCLUSIONS GÉNÉRALES', margin + halfWidth + 10, y);

        doc.rect(margin + halfWidth + 10, y + 12, halfWidth, 55).fill('#FAFAFA');
        doc.rect(margin + halfWidth + 10, y + 12, halfWidth, 55).strokeColor('#E2E8F0').lineWidth(0.6).stroke();

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#334155')
          .text(report.conclusions || 'Objectifs de contrôle atteints.', margin + halfWidth + 16, y + 18, {
            width: halfWidth - 12,
            lineGap: 2,
          });

        y += 76;
      }

      // 8. Multi-Agent Field Observations Log
      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor(AOTUC_BRANDING.colors.primaryNavy)
        .text("4. JOURNAL CHRONOLOGIQUE DES OBSERVATIONS MULTI-AGENTS", margin, y);

      y += 14;

      const observations = Array.isArray(report.contributors) ? report.contributors.slice(0, 4) : [];
      if (observations.length > 0) {
        observations.forEach((obs) => {
          const obsTime = obs.timestamp ? new Date(obs.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
          const authorLabel = obs.authorName || obs.agentName || 'Agent Terrain';

          doc.rect(margin, y, contentWidth, 24).fill('#F8FAFC');
          doc.rect(margin, y, contentWidth, 24).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

          doc
            .font('Helvetica-Bold')
            .fontSize(7)
            .fillColor(AOTUC_BRANDING.colors.primaryNavy)
            .text(`[${obsTime}] ${authorLabel} :`, margin + 6, y + 5)
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#334155')
            .text(obs.observation || '—', margin + 6, y + 13, { width: contentWidth - 12, ellipsis: true });

          y += 28;
        });
      } else {
        doc.rect(margin, y, contentWidth, 22).fill('#FAFAFA');
        doc.rect(margin, y, contentWidth, 22).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        doc
          .font('Helvetica-Oblique')
          .fontSize(7.5)
          .fillColor('#94A3B8')
          .text('Aucune observation terrain additionnelle consignée.', margin, y + 7, {
            width: contentWidth,
            align: 'center',
          });
        y += 28;
      }

      y += 6;

      // 9. Supervisor Review & Formal Authorization Seal Block
      const reviewBoxHeight = 65;
      doc.rect(margin, y, contentWidth, reviewBoxHeight).fill('#F0FDF4'); // Subtle emerald tint
      doc.rect(margin, y, contentWidth, reviewBoxHeight).strokeColor('#86EFAC').lineWidth(0.8).stroke();

      const reviewerName = report.reviewedByUser
        ? `${report.reviewedByUser.firstName} ${report.reviewedByUser.lastName}`
        : 'Chef de Service Territorial';

      const decisionText =
        report.status === 'APPROVED'
          ? 'RAPPORT VALIDÉ & CLÔTURÉ'
          : report.status === 'CHANGES_REQUESTED'
          ? 'CORRECTIONS DEMANDÉES'
          : report.status === 'REJECTED'
          ? 'RAPPORT REJETÉ'
          : 'EN COURS D EXAMEN';

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#166534')
        .text(`5. DÉCISION HIÉRARCHIQUE : ${decisionText}`, margin + 10, y + 8)
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#14532D')
        .text(`Superviseur : ${reviewerName} • Décision arrêtée au statut officiel.`, margin + 10, y + 20)
        .font('Helvetica-Oblique')
        .fontSize(7.5)
        .fillColor('#15803D')
        .text(`Remarques : ${report.supervisorNotes || 'Conforme aux directives opérationnelles de l AOTUC.'}`, margin + 10, y + 32, {
          width: contentWidth - 140,
        });

      // Digital Signature Box
      const sigBoxX = margin + contentWidth - 120;
      doc.rect(sigBoxX, y + 6, 110, 52).fill('#FFFFFF');
      doc.rect(sigBoxX, y + 6, 110, 52).strokeColor('#15803D').lineWidth(0.8).stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor('#15803D')
        .text('VISA AOTUC CONAKRY', sigBoxX, y + 10, { width: 110, align: 'center' })
        .font('Helvetica')
        .fontSize(6)
        .fillColor('#334155')
        .text('Signature Électronique', sigBoxX, y + 20, { width: 110, align: 'center' })
        .font('Courier-Bold')
        .fontSize(6)
        .fillColor('#059669')
        .text(`AUTH-${(report.id || '').slice(0, 8).toUpperCase()}`, sigBoxX, y + 30, {
          width: 110,
          align: 'center',
        })
        .font('Helvetica-Oblique')
        .fontSize(5.5)
        .fillColor('#64748B')
        .text(new Date().toLocaleDateString('fr-FR'), sigBoxX, y + 42, {
          width: 110,
          align: 'center',
        });

      y += reviewBoxHeight + 14;

      // 10. Document Footer
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor('#94A3B8')
        .text(
          `${AOTUC_BRANDING.shortName} • Immeuble des Transports, Kaloum, Conakry, République de Guinée • Document généré automatiquement le ${new Date().toLocaleString('fr-FR')}`,
          margin,
          pageWidth > 500 ? 790 : y,
          { width: contentWidth, align: 'center' }
        );

      doc.end();
    });
  }
}

export default PdfMissionReportService;
