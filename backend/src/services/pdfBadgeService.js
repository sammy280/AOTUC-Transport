import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AOTUC_BRANDING } from '../config/branding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OFFICIAL_SEAL_PATH = path.resolve(__dirname, '../../assets/aotuc-official-seal.png');
const OFFICIAL_LOGO_PATH = path.resolve(__dirname, '../../assets/aotuc-logo.png');

export class PdfBadgeService {
  /**
   * Generates a printable CR80 PVC Driver Identification Card PDF (85.6mm x 53.98mm).
   * Returns a Buffer containing the complete PDF document.
   */
  static async generateDriverBadgePdf({
    badgeNumber = 'BDG-2026-00042',
    driverName = 'Abdoulaye Bah',
    licenseNumber = 'PC-GN-2015-8841',
    category = 'B, C1',
    expiresAt = new Date('2028-02-15'),
    qrPayload = 'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah',
  }) {
    // Generate QR code data buffer
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 120,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return new Promise((resolve, reject) => {
      // CR80 dimensions: 242.65pt x 153pt (85.6mm x 53.98mm)
      const doc = new PDFDocument({
        size: [242.65, 153],
        margins: { top: 6, bottom: 6, left: 8, right: 8 },
        info: {
          Title: `AOTUC-Badge-${badgeNumber}`,
          Author: 'AOTUC Guinée',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // --- RECTO (FRONT) ---
      // 1. Guinea Flag Tricolor Top Stripe
      doc.rect(0, 0, 80.88, 4).fill('#CE1126');
      doc.rect(80.88, 0, 80.88, 4).fill('#FCD116');
      doc.rect(161.76, 0, 80.89, 4).fill('#009460');

      // 2. Header
      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, 10, 6, { width: 15, height: 15 });
        } catch (_) {}
      }

      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS', 8, 8, { align: 'center', width: 226.65 });
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#CE1126')
        .text('AOTUC — CARTE PROFESSIONNELLE DE CONDUCTEUR', 8, 15, { align: 'center', width: 226.65 });

      // Subtle dividing line
      doc.moveTo(8, 24).lineTo(234.65, 24).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

      // 3. Photo Box (Left)
      doc.rect(8, 28, 52, 65).fillAndStroke('#F1F5F9', '#CBD5E1');
      doc.fontSize(6).fillColor('#64748B').text('PHOTO', 8, 55, { align: 'center', width: 52 });

      // 4. Details (Center)
      const leftCol = 66;
      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('NOM & PRÉNOM', leftCol, 28);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0F172A').text(driverName.toUpperCase(), leftCol, 34, { width: 100 });

      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('N° DE BADGE', leftCol, 48);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0B1E36').text(badgeNumber, leftCol, 54);

      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('PERMIS DE CONDUIRE', leftCol, 66);
      doc.fontSize(6.5).font('Helvetica').fillColor('#0F172A').text(`Cat. ${category} • N° ${licenseNumber}`, leftCol, 72);

      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('VALIDE JUSQU AU', leftCol, 82);
      const expDate = new Date(expiresAt).toLocaleDateString('fr-FR');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#009460').text(expDate, leftCol, 88);

      // 5. Scannable QR Code (Right)
      doc.image(qrBuffer, 172, 28, { width: 62, height: 62 });
      doc.fontSize(4).font('Helvetica').fillColor('#64748B')
        .text('Scannable Hors-Ligne', 172, 92, { align: 'center', width: 62 });

      // 6. Security Footer Bar
      doc.rect(0, 145, 242.65, 8).fill('#0B1E36');
      doc.fontSize(4.5).font('Helvetica').fillColor('#FFFFFF')
        .text('Titulaire autorisé au transport public urbain dans la Région Spéciale de Conakry', 0, 147, { align: 'center', width: 242.65 });

      // --- VERSO (BACK) ---
      doc.addPage();
      doc.rect(0, 0, 242.65, 153).fill('#F8FAFC');

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('CONDITIONS D UTILISATION RÉGLEMENTAIRES', 8, 12, { align: 'center', width: 226.65 });

      doc.fontSize(5).font('Helvetica').fillColor('#334155')
        .text('1. Cette carte est strictement personnelle, incessible et demeure la propriété de l AOTUC.', 12, 26, { width: 218 });
      doc.text('2. Le conducteur doit obligatoirement la porter de manière visible durant l exercice de son activité.', 12, 38, { width: 218 });
      doc.text('3. Tout badge suspendu, falsifié ou expiré entraîne l immobilisation immédiate du véhicule.', 12, 50, { width: 218 });
      doc.text('4. En cas de perte ou de vol, aviser sans délai l AOTUC et les autorités de police.', 12, 62, { width: 218 });

      // Verification seal box
      doc.rect(12, 80, 218, 55).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0F172A')
        .text('SIGNATURE DE L AUTORITÉ ÉMETTRICE', 12, 86, { align: 'center', width: 218 });
      doc.fontSize(5).font('Helvetica').fillColor('#64748B')
        .text('Directeur Général de l AOTUC', 12, 94, { align: 'center', width: 218 });
      doc.fontSize(4.5).font('Helvetica-Oblique').fillColor('#94A3B8')
        .text('[Signature Électronique Certifiée & Sceau République]', 12, 118, { align: 'center', width: 218 });

      doc.end();
    });
  }

  /**
   * Generates a printable Windshield Transport Licence Sticker PDF (100mm x 100mm).
   */
  static async generateLicenceStickerPdf({
    licenceNumber = 'LIC-2026-00188',
    plateNumber = 'RC-9844-AB',
    lineCode = 'L-01 KALOUM — MATOTO',
    vehicleType = 'MINIBUS_URBAIN',
    expiresAt = new Date('2026-12-31'),
    qrPayload = 'AOTUC1.ed25519_2026_01.lic-001.LICENCE.VEH_RC9844AB',
  }) {
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 150,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return new Promise((resolve, reject) => {
      // 100mm x 100mm = 283.46pt x 283.46pt
      const doc = new PDFDocument({
        size: [283.46, 283.46],
        margins: { top: 8, bottom: 8, left: 8, right: 8 },
        info: {
          Title: `AOTUC-Licence-${licenceNumber}`,
          Author: 'AOTUC Guinée',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Outer border (Adhesive cut line)
      doc.rect(4, 4, 275.46, 275.46).strokeColor('#0B1E36').lineWidth(2).stroke();

      // Top Header
      doc.rect(6, 6, 271.46, 32).fill('#0B1E36');

      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, 10, 8, { width: 26, height: 26 });
        } catch (_) {}
      }

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS', 6, 12, { align: 'center', width: 271.46 });
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#FCD116')
        .text('AOTUC — LICENCE D EXPLOITATION URBAINE', 6, 23, { align: 'center', width: 271.46 });

      // Route Code Badge
      doc.rect(20, 48, 80, 36).fill('#CE1126');
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#FFFFFF').text('LIGNE AFFECTÉE', 20, 52, { align: 'center', width: 80 });
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF').text(lineCode || 'TOUS AXES', 20, 62, { align: 'center', width: 80 });

      // Plate & Details
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748B').text('IMMATRICULATION', 110, 48);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0F172A').text(plateNumber, 110, 56);
      doc.fontSize(6).font('Helvetica').fillColor('#64748B').text(`Type : ${vehicleType}`, 110, 74);

      // Central High-Contrast QR Code
      doc.image(qrBuffer, 66, 92, { width: 150, height: 150 });

      // Footer: Licence Number & Expiry
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748B')
        .text('N° DE LICENCE : ' + licenceNumber, 8, 248, { align: 'center', width: 267.46 });

      const expDate = new Date(expiresAt).toLocaleDateString('fr-FR');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#009460')
        .text('EXPIRATION : ' + expDate, 8, 258, { align: 'center', width: 267.46 });

      doc.end();
    });
  }

  /**
   * Generates a printable Secure Transport Ticket PDF (Thermal Ticket 74mm x 140mm = 210pt x 396pt).
   * Complies with Section 5 product requirements.
   */
  static async generateTicketPdf({
    ticketNumber,
    routeName = 'L-01 KALOUM — MATOTO',
    departure = 'Gare Centrale de Kaloum',
    destination = 'Rond-Point de Matoto',
    fareGnf = 2000,
    paymentMethod = 'ORANGE_MONEY',
    paymentRef = 'OM-GN-2026-9841',
    buyerName = 'Passager Urbain',
    operatorName = 'Guichet Kaloum Express',
    issuedAt = new Date(),
    status = 'PAYÉ & VALIDE',
    qrPayload,
  }) {
    // Generate QR code for ticket
    const qrBuffer = await QRCode.toBuffer(qrPayload || `AOTUC-TICKET-${ticketNumber}`, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 120,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return new Promise((resolve, reject) => {
      // 74mm x 140mm = 210pt x 396pt
      const doc = new PDFDocument({
        size: [210, 396],
        margins: { top: 8, bottom: 8, left: 10, right: 10 },
        info: {
          Title: `AOTUC-Billet-${ticketNumber}`,
          Author: 'AOTUC Guinée',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // 1. National Tricolor Top Stripe
      doc.rect(0, 0, 70, 4).fill('#CE1126');
      doc.rect(70, 0, 70, 4).fill('#FCD116');
      doc.rect(140, 0, 70, 4).fill('#009460');

      // 2. Header
      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, 10, 8, { width: 18, height: 18 });
        } catch (_) {}
      }

      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS', 10, 10, { align: 'center', width: 190 });
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#CE1126')
        .text('AOTUC — TITRE DE TRANSPORT URBAIN', 10, 18, { align: 'center', width: 190 });

      // Dividing Line
      doc.moveTo(10, 29).lineTo(200, 29).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

      // Ticket Number & Status Pill
      doc.rect(10, 33, 190, 22).fill('#F8FAFC');
      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('NUMÉRO DE TITRE', 15, 36);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(ticketNumber, 15, 43);

      doc.rect(130, 36, 65, 15).fill('#DCFCE7');
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#166534')
        .text(status, 130, 41, { align: 'center', width: 65 });

      // Route Details
      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('LIGNE RÉGLEMENTÉE', 10, 62);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#2563EB').text(routeName, 10, 68);

      doc.fontSize(5).font('Helvetica-Bold').fillColor('#64748B').text('ORIGINE → DESTINATION', 10, 80);
      doc.fontSize(6.5).font('Helvetica').fillColor('#0F172A').text(`${departure}  ➔  ${destination}`, 10, 86);

      // Financial Details Table
      doc.rect(10, 98, 190, 38).fill('#F1F5F9');
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#64748B').text('TARIF RÉGLEMENTAIRE (GNF)', 15, 103);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#009460').text(`${fareGnf.toLocaleString()} GNF`, 15, 111);

      doc.fontSize(5).font('Helvetica').fillColor('#475569')
        .text(`Mode : ${paymentMethod} | Réf : ${paymentRef}`, 15, 127);

      // Timestamp & Beneficiary
      const dateStr = new Date(issuedAt).toLocaleString('fr-FR');
      doc.fontSize(5).font('Helvetica').fillColor('#64748B')
        .text(`Date & Heure : ${dateStr}`, 10, 142);
      doc.fontSize(5).font('Helvetica').fillColor('#64748B')
        .text(`Bénéficiaire : ${buyerName} | Émetteur : ${operatorName}`, 10, 150);

      // Central Scannable QR Code
      doc.image(qrBuffer, 45, 165, { width: 120, height: 120 });
      doc.fontSize(5).font('Helvetica').fillColor('#64748B')
        .text('Contrôle de validité par scan QR cryptographique Ed25519', 10, 290, { align: 'center', width: 190 });

      // Watermark Text / Security Notice
      doc.rect(10, 305, 190, 48).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('AVIS DE SÉCURITÉ & CONDITIONS DE VOYAGE', 10, 310, { align: 'center', width: 190 });
      doc.fontSize(4.5).font('Helvetica').fillColor('#475569')
        .text('1. Valable pour 1 trajet direct sur le réseau AOTUC de Conakry.', 15, 318, { width: 180 });
      doc.fontSize(4.5).font('Helvetica')
        .text('2. Ce billet doit être conservé jusqu à la descente du véhicule.', 15, 326, { width: 180 });
      doc.fontSize(4.5).font('Helvetica')
        .text('3. Toute falsification ou réutilisation frauduleuse est passible des peines prévues par le Code Pénal.', 15, 334, { width: 180 });

      // Footer Bar
      doc.rect(0, 386, 210, 10).fill('#0B1E36');
      doc.fontSize(4.2).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('AUTORITÉ ORGANISATRICE DES TRANSPORTS URBAINS DE CONAKRY — AOTUC', 0, 389, { align: 'center', width: 210 });

      doc.end();
    });
  }
}

export default PdfBadgeService;
