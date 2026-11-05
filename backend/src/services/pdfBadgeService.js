import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OFFICIAL_LOGO_PATH = path.resolve(__dirname, '../../assets/logo-guinee.png');

function formatDateDash(date) {
  if (!date) return '30-10-2027';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '30-10-2027';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

function formatDateSlash(date) {
  if (!date) return '31/12/2027';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '31/12/2027';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export class PdfBadgeService {
  /**
   * Generates official AOTUC CR80 PVC Driver Identification Card PDF (85.6mm x 53.98mm).
   * Exact official layout matching AOTUC 2026 specs.
   */
  static async generateDriverBadgePdf({
    badgeNumber = 'CH-2026-1452',
    driverName = 'CAMARA Moussa',
    licenseNumber = 'DL-9844-GN',
    category = 'B, D1',
    routeName = 'L-01 Kaloum-Lambandji',
    issuedAt = '2024-10-30',
    expiresAt = '2027-10-30',
    status = 'VALID',
    qrPayload = 'AOTUC1.aotuc-2026-v1.CH-2026-1452.DRIVER_BADGE.d1.1730246400.1824854400.sig',
  }) {
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 100,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const expDateStr = formatDateDash(expiresAt);
    const issueDateStr = formatDateDash(issuedAt);

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
      // 0. Base card background
      doc.rect(0, 0, 242.65, 153).fill('#FFFFFF');

      // Faint security watermark pattern across background
      doc.save();
      doc.fillColor('#F1F5F9').font('Helvetica-Bold').fontSize(6);
      for (let y = 34; y < 145; y += 18) {
        doc.text('AOTUC - SÉCURISÉ    AOTUC - SÉCURISÉ    AOTUC - SÉCURISÉ', 10, y, { width: 230 });
      }
      doc.restore();

      // 1. Header Tricolor Bar
      // Upper red stripe
      doc.rect(0, 0, 242.65, 2.5).fill('#CE1126');

      // Yellow banner
      doc.rect(0, 2.5, 242.65, 18).fill('#FCD116');

      // Bus circular badge in yellow banner
      doc.circle(13, 11.5, 6).fillAndStroke('#FCD116', '#009460');
      // Stylized bus icon in circle
      doc.rect(9.5, 8.5, 7, 6).fillAndStroke('#FFFFFF', '#009460');
      doc.rect(10.5, 9.5, 5, 2).fill('#009460');
      doc.circle(11, 13.5, 0.8).fill('#009460');
      doc.circle(15, 13.5, 0.8).fill('#009460');

      // "AOTUC" text
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#008751')
        .text('AOTUC', 23, 6);

      // Subtitle next to AOTUC
      doc.fontSize(4.2).font('Helvetica-Bold').fillColor('#065F46')
        .text('AGENCE DE TRANSPORT\nDE L\'UNION DE CONAKRY', 78, 5.5, { lineGap: 0.5 });

      // Lower green stripe
      doc.rect(0, 20.5, 242.65, 2.5).fill('#009460');

      // Sub-ribbon
      doc.rect(0, 23, 242.65, 9).fill('#E2E8F0');
      doc.fontSize(4.8).font('Helvetica-Bold').fillColor('#0F172A')
        .text('BADGE CONDUCTEUR PROFESSIONNEL • CONAKRY - RÉPUBLIQUE DE GUINÉE', 0, 25.2, {
          align: 'center',
          width: 242.65,
        });

      // 2. Photo Area (Left)
      doc.roundedRect(10, 36, 52, 48, 3).fillAndStroke('#F1F5F9', '#CBD5E1');
      // Silhouette icon inside photo frame
      doc.circle(36, 54, 8).fill('#CBD5E1');
      doc.roundedRect(26, 64, 20, 14, 4).fill('#CBD5E1');
      doc.fontSize(4.2).font('Helvetica-Bold').fillColor('#64748B')
        .text('PHOTO DU CONDUCTEUR', 10, 86, { align: 'center', width: 52 });

      // 3. QR Code Area (Bottom Left)
      doc.image(qrBuffer, 13, 93, { width: 46, height: 46 });
      doc.fontSize(4).font('Helvetica-Bold').fillColor('#64748B')
        .text('QR CODE', 13, 140, { align: 'center', width: 46 });

      // 4. Right Column: Driver Data & Fields
      // Status pill at top-right
      const isStatusValid = (status || 'VALID').toUpperCase().includes('VAL');
      const statusBg = isStatusValid ? '#DC2626' : '#64748B';
      doc.roundedRect(174, 35, 58, 10.5, 5.25).fill(statusBg);
      doc.fontSize(5.2).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('VALID / VALIDE', 174, 37.8, { align: 'center', width: 58 });

      // Field 1: NOM / NAME
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#64748B').text('NOM / NAME', 68, 36);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0B1E36')
        .text(driverName.toUpperCase(), 68, 42, { width: 104 });

      // Field 2: BADGE N°
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#64748B').text('BADGE N°', 68, 55);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(badgeNumber, 68, 61);

      // Field 3: LIGNE / LINE
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#64748B').text('LIGNE / LINE', 68, 76);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0B1E36').text(routeName, 68, 82);

      // Field 4: EXPIRATION
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#64748B').text('EXPIRATION', 68, 93);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text(expDateStr, 68, 99);

      // 5. Security Hologram Seal & Green Stamp
      // Gold Hologram Medallion
      doc.circle(150, 122, 9.5).fillAndStroke('#FCD116', '#D97706');
      doc.circle(150, 122, 6.5).lineWidth(0.5).stroke('#B45309');
      // 5-point star inside medallion
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#92400E')
        .text('★', 147, 118);

      // Green Approval Oval Stamp
      doc.roundedRect(172, 114, 60, 16, 8).fillAndStroke('#DCFCE7', '#16A34A');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#15803D')
        .text('AUTORISÉ', 172, 118, { align: 'center', width: 60 });

      // 6. Footer Legal Notice
      doc.fontSize(3.1).font('Helvetica').fillColor('#475569')
        .text(
          `Délivré le ${issueDateStr} • Port du badge obligatoire • Ce badge est la propriété de l'AOTUC — Toute falsification est punie par la loi`,
          65,
          142,
          { width: 172 }
        );

      // Bottom Tricolor Stripe
      doc.rect(0, 149.5, 80.88, 3.5).fill('#CE1126');
      doc.rect(80.88, 149.5, 80.88, 3.5).fill('#FCD116');
      doc.rect(161.76, 149.5, 80.89, 3.5).fill('#009460');

      // --- VERSO (BACK) ---
      doc.addPage();
      doc.rect(0, 0, 242.65, 153).fill('#F8FAFC');

      doc.fontSize(6).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('CONDITIONS D UTILISATION RÉGLEMENTAIRES', 8, 10, { align: 'center', width: 226.65 });

      doc.fontSize(5).font('Helvetica').fillColor('#334155')
        .text('1. Cette carte est strictement personnelle, incessible et demeure la propriété de l AOTUC.', 12, 24, { width: 218 });
      doc.text('2. Le conducteur doit obligatoirement la porter de manière visible durant l exercice de son activité.', 12, 36, { width: 218 });
      doc.text('3. Tout badge suspendu, falsifié ou expiré entraîne l immobilisation immédiate du véhicule.', 12, 48, { width: 218 });
      doc.text('4. En cas de perte ou de vol, aviser sans délai l AOTUC et les autorités de police.', 12, 60, { width: 218 });

      // Verification seal box
      doc.rect(12, 78, 218, 58).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
      doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0F172A')
        .text('SIGNATURE DE L AUTORITÉ ÉMETTRICE', 12, 84, { align: 'center', width: 218 });
      doc.fontSize(5).font('Helvetica').fillColor('#64748B')
        .text('Directeur Général de l AOTUC — République de Guinée', 12, 92, { align: 'center', width: 218 });
      doc.fontSize(4.5).font('Helvetica-Oblique').fillColor('#94A3B8')
        .text('[Signature Électronique Certifiée & Sceau République de Guinée RFC 8032]', 12, 116, { align: 'center', width: 218 });

      doc.end();
    });
  }

  /**
   * Generates official printable Windshield Transport Licence Sticker PDF (Écusson de Licence, 100mm x 100mm).
   * Exact official layout matching AOTUC 2026 specs.
   */
  static async generateLicenceStickerPdf({
    licenceNumber = 'LC-2026-0895',
    plateNumber = 'RC-1234-AB',
    lineCode = 'L-01 • KALOUM — LAMBANDJI',
    vehicleType = 'MINIBUS_URBAIN',
    validYear = 2027,
    expiresAt = '2027-12-31',
    qrPayload = 'AOTUC1.aotuc-2026-v1.LC-2026-0895.TRANSPORT_LICENCE.v1.1730246400.1830211200.sig',
  }) {
    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 140,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const expDateStr = formatDateSlash(expiresAt);

    return new Promise((resolve, reject) => {
      // 100mm x 100mm = 283.46pt x 283.46pt
      const doc = new PDFDocument({
        size: [283.46, 283.46],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `AOTUC-Licence-${licenceNumber}`,
          Author: 'AOTUC Guinée',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Base background
      doc.rect(0, 0, 283.46, 283.46).fill('#FFFFFF');

      // 1. Red Header Banner (Route designation)
      doc.rect(0, 0, 283.46, 46).fill('#CE1126');
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text(lineCode.toUpperCase(), 0, 16, { align: 'center', width: 283.46 });

      // 2. Upper White Section (Agency Brand)
      doc.rect(0, 46, 283.46, 44).fill('#FFFFFF');

      // Circular AOTUC Seal on Left
      doc.circle(38, 68, 16).fillAndStroke('#FFFFFF', '#0B1E36');
      doc.circle(38, 68, 13).lineWidth(0.5).stroke('#0B1E36');
      // Stylized bus icon in seal
      doc.rect(32, 63, 12, 8).fillAndStroke('#FFFFFF', '#0B1E36');
      doc.rect(34, 64.5, 8, 2.5).fill('#0B1E36');
      doc.circle(34.5, 70, 1).fill('#0B1E36');
      doc.circle(41.5, 70, 1).fill('#0B1E36');
      doc.fontSize(3.8).font('Helvetica-Bold').fillColor('#0B1E36')
        .text('AOTUC', 32, 73);

      // Text on Right of Seal
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1E3A8A')
        .text('ECUSSON DE LICENCE\nTRANSPORT URBAIN', 68, 52, { lineGap: 1.5 });

      // 3. Middle Yellow Band (Licence & Immatriculation)
      doc.rect(0, 90, 283.46, 54).fill('#FCD116');

      // Guilloche top line
      doc.moveTo(0, 90).lineTo(283.46, 90).strokeColor('#CA8A04').lineWidth(1).stroke();

      doc.fontSize(16.5).font('Helvetica-Bold').fillColor('#000000')
        .text(`LICENCE N° ${licenceNumber}`, 0, 96, { align: 'center', width: 283.46 });

      doc.fontSize(15).font('Helvetica-Bold').fillColor('#047857')
        .text(`IMMATRICULATION : ${plateNumber}`, 0, 118, { align: 'center', width: 283.46 });

      // 4. Lower White Section (Validity & QR Code)
      doc.rect(0, 144, 283.46, 62).fill('#FFFFFF');

      // QR Code on Left
      doc.image(qrBuffer, 24, 147, { width: 56, height: 56 });

      // Validity Information on Right
      doc.fontSize(15).font('Helvetica-Bold').fillColor('#DC2626')
        .text(`VALIDITÉ : ${expDateStr}`, 88, 154);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
        .text(`VALABLE POUR L'ANNÉE ${validYear}`, 88, 176);

      // 5. Micro-text Security Ribbon
      doc.rect(0, 206, 283.46, 8).fill('#F1F5F9');
      doc.fontSize(3.8).font('Helvetica-Bold').fillColor('#475569')
        .text(
          'RÉPUBLIQUE DE GUINÉE • AOTUC • SÉCURITÉ • CONTRÔLE - 2026 • RÉPUBLIQUE DE GUINÉE • AOTUC • SÉCURITÉ • CONTRÔLE - 2026',
          0,
          208.5,
          { align: 'center', width: 283.46 }
        );

      // 6. Bottom Green Banner (Footer, Hologram & Guinea Flag)
      doc.rect(0, 214, 283.46, 69.46).fill('#047857');

      // Left: Gold Security Hologram Rosette
      doc.circle(28, 248, 13).fillAndStroke('#FCD116', '#B45309');
      doc.circle(28, 248, 9).lineWidth(0.5).stroke('#78350F');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#78350F')
        .text('★', 25, 244);
      doc.fontSize(2.8).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('HOLOGRAMME\nSÉCURISÉ', 15, 263, { align: 'center', width: 26 });

      // Center: CONAKRY TRANSPORT PUBLIC AUTORISÉ
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('—— CONAKRY ——', 50, 222, { align: 'center', width: 184 });

      doc.fontSize(11.5).font('Helvetica-Bold').fillColor('#FCD116')
        .text('TRANSPORT PUBLIC AUTORISÉ', 50, 233, { align: 'center', width: 184 });

      doc.fontSize(4.6).font('Helvetica').fillColor('#FFFFFF')
        .text('CE DOCUMENT EST SÉCURISÉ - TOUTE CONTREFAÇON EST PUNIE PAR LA LOI', 50, 252, {
          align: 'center',
          width: 184,
        });

      // Right: Guinea National Flag
      doc.rect(244, 236, 9.33, 18).fill('#CE1126');
      doc.rect(253.33, 236, 9.33, 18).fill('#FCD116');
      doc.rect(262.66, 236, 9.34, 18).fill('#009460');

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
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('AGENCE ORGANISATRICE DU TRANSPORT URBAIN DE CONAKRY — AOTUC', 0, 389, { align: 'center', width: 210 });

      doc.end();
    });
  }
}

export default PdfBadgeService;
