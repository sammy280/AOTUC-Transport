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
    badgeNumber = 'CH-2026-1452',
    driverName = 'CAMARA Moussa',
    licenseNumber = 'DL-9844-GN',
    category = 'B, D1',
    routeName = 'L-01 Kaloum-Lambandji',
    issueDate = '30-10-2024',
    expiresAt = new Date('2027-10-30'),
    qrPayload = 'AOTUC1.aotuc-2026-v1.CH-2026-1452.DRIVER_BADGE.d1.1730246400.1824854400.sig_Camara_Moussa_Valid_2027',
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
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
      // 1. Top Red Stripe
      doc.rect(0, 0, 242.65, 3).fill('#CE1126');

      // 2. Yellow Header Ribbon with AOTUC
      doc.rect(0, 3, 242.65, 18).fill('#FCD116');
      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, 8, 4.5, { width: 15, height: 15 });
        } catch (_) {}
      }
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#008751').text('AOTUC', 26, 7);
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#065F46')
        .text('AGENCE DE TRANSPORT DE L UNION DE CONAKRY', 60, 9, { align: 'right', width: 174 });

      // 3. Green Stripe
      doc.rect(0, 21, 242.65, 2.5).fill('#009460');

      // 4. Sub-ribbon
      doc.rect(0, 23.5, 242.65, 8).fill('#E2E8F0');
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#1E293B')
        .text('BADGE CONDUCTEUR PROFESSIONNEL • CONAKRY - RÉPUBLIQUE DE GUINÉE', 0, 25.5, { align: 'center', width: 242.65 });

      // 5. Card Background (White)
      doc.rect(0, 31.5, 242.65, 115).fill('#FFFFFF');

      // 6. Photo Box (Left)
      doc.rect(10, 36, 50, 62).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#64748B')
        .text('PHOTO DU', 10, 60, { align: 'center', width: 50 });
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#64748B')
        .text('CONDUCTEUR', 10, 68, { align: 'center', width: 50 });

      // QR Code below Photo
      doc.image(qrBuffer, 16, 102, { width: 38, height: 38 });
      doc.fontSize(3.5).font('Helvetica-Bold').fillColor('#64748B')
        .text('QR CODE', 10, 141, { align: 'center', width: 50 });

      // 7. Right Details
      // Red Status Pill
      doc.rect(170, 36, 62, 10).fill('#DC2626');
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('VALID / VALIDE', 170, 38.5, { align: 'center', width: 62 });

      const detailsX = 66;
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#94A3B8').text('NOM / NAME', detailsX, 48);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0B1E36').text(driverName.toUpperCase(), detailsX, 54, { width: 165 });

      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#94A3B8').text('BADGE N°', detailsX, 67);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0F172A').text(badgeNumber, detailsX, 73);

      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#94A3B8').text('LIGNE / LINE', detailsX, 86);
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#0F172A').text(routeName, detailsX, 92);

      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#94A3B8').text('EXPIRATION', detailsX, 104);
      const expStr = typeof expiresAt === 'string' ? expiresAt : new Date(expiresAt).toLocaleDateString('fr-FR');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text(expStr, detailsX, 110);

      // Gold Hologram Rosette & Green Stamp
      doc.circle(182, 120, 9).fillAndStroke('#FCD116', '#D97706');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#78350F').text('★', 178, 114);

      doc.rect(198, 113, 34, 14).fillAndStroke('#DCFCE7', '#16A34A');
      doc.fontSize(6).font('Helvetica-Bold').fillColor('#15803D')
        .text('AUTORISÉ', 198, 117, { align: 'center', width: 34 });

      // 8. Legal Notice & Bottom Tricolor Stripe
      doc.fontSize(3.8).font('Helvetica').fillColor('#64748B')
        .text(`Délivré le ${issueDate} • Port du badge obligatoire • Propriété exclusive de l AOTUC — Falsification punie par la loi`, 0, 144, { align: 'center', width: 242.65 });

      doc.rect(0, 150, 80.88, 3).fill('#CE1126');
      doc.rect(80.88, 150, 80.88, 3).fill('#FCD116');
      doc.rect(161.76, 150, 80.89, 3).fill('#009460');

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
    licenceNumber = 'LC-2026-0895',
    plateNumber = 'RC-1234-AB',
    lineCode = 'L-01 • KALOUM — LAMBANDJI',
    vehicleType = 'MINIBUS_URBAIN',
    expiresAt = new Date('2027-12-31'),
    qrPayload = 'AOTUC1.aotuc-2026-v1.LC-2026-0895.TRANSPORT_LICENCE.v1.1730246400.1830211200.sig_LC_2026_0895_Valid_2027',
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
        margins: { top: 6, bottom: 6, left: 6, right: 6 },
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

      // 1. Top Red Header Banner: Line Code
      doc.rect(6, 6, 271.46, 28).fill('#CE1126');
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text(lineCode || 'L-01 • KALOUM — LAMBANDJI', 6, 14, { align: 'center', width: 271.46 });

      // 2. Upper White Section: AOTUC Seal + Agency Title
      doc.rect(6, 34, 271.46, 36).fill('#FFFFFF');
      if (fs.existsSync(OFFICIAL_LOGO_PATH)) {
        try {
          doc.image(OFFICIAL_LOGO_PATH, 16, 37, { width: 30, height: 30 });
        } catch (_) {}
      }
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A')
        .text('ECUSSON DE LICENCE', 56, 40);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A')
        .text('TRANSPORT URBAIN', 56, 53);

      // 3. Middle Yellow Banner (Exclusively Yellow)
      doc.rect(6, 70, 271.46, 40).fill('#FCD116');
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0F172A')
        .text(`LICENCE N° ${licenceNumber}`, 6, 78, { align: 'center', width: 271.46 });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#047857')
        .text(`IMMATRICULATION : ${plateNumber}`, 6, 94, { align: 'center', width: 271.46 });

      // 4. Lower White Section: QR Code + Validity
      doc.rect(6, 110, 271.46, 122).fill('#FFFFFF');
      doc.image(qrBuffer, 16, 116, { width: 110, height: 110 });

      const expDate = typeof expiresAt === 'string' ? expiresAt : new Date(expiresAt).toLocaleDateString('fr-FR');
      const validYear = typeof expiresAt === 'string' ? '2027' : new Date(expiresAt).getFullYear();

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#DC2626')
        .text(`VALIDITÉ : ${expDate}`, 134, 150);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0F172A')
        .text(`VALABLE POUR L ANNÉE ${validYear}`, 134, 168);

      // 5. Security Micro-text Ribbon
      doc.rect(6, 232, 271.46, 8).fill('#F1F5F9');
      doc.fontSize(4).font('Helvetica-Bold').fillColor('#475569')
        .text('RÉPUBLIQUE DE GUINÉE • AOTUC • SÉCURITÉ • CONTRÔLE - 2026', 6, 234.5, { align: 'center', width: 271.46 });

      // 6. Bottom Green Banner: Gold Hologram + CONAKRY TRANSPORT PUBLIC AUTORISÉ + Flag
      doc.rect(6, 240, 271.46, 37.46).fill('#047857');
      doc.circle(24, 258, 10).fillAndStroke('#FCD116', '#B45309');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#78350F').text('★', 21, 253);

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('—— CONAKRY ——', 6, 244, { align: 'center', width: 271.46 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#FCD116')
        .text('TRANSPORT PUBLIC AUTORISÉ', 6, 253, { align: 'center', width: 271.46 });
      doc.fontSize(4.5).font('Helvetica').fillColor('#FFFFFF')
        .text('CE DOCUMENT EST SÉCURISÉ - TOUTE CONTREFAÇON EST PUNIE PAR LA LOI', 6, 267, { align: 'center', width: 271.46 });

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
