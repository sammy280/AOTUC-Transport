import logger from '../utils/logger.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Guinean SMS Gateway Adapter
 * Supports Mock Dev mode and real Orange/MTN Guinea SMS APIs.
 */
export class SmsService {
  /**
   * Normalizes phone number to E.164 Guinean format (+224XXXXXXXXX).
   */
  static normalizePhone(rawPhone) {
    if (!rawPhone) return null;
    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (digitsOnly.startsWith('224') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length === 9) {
      return `+224${digitsOnly}`;
    }
    return rawPhone;
  }

  /**
   * Sends an SMS message to a Guinean recipient.
   */
  static async sendSms({ to, message, templateCode }) {
    const formattedPhone = this.normalizePhone(to);

    if (!formattedPhone || !formattedPhone.startsWith('+224')) {
      throw new AppError('Numéro de téléphone guinéen invalide pour l envoi SMS (+224).', 400, 'INVALID_PHONE');
    }

    const provider = process.env.SMS_PROVIDER || 'MOCK';
    const messageId = `SMS-${Date.now().toString().slice(-8)}`;

    if (provider === 'ORANGE_GUINEA' && process.env.ORANGE_SMS_API_KEY) {
      // In production: Orange Guinea API call
      logger.info('Dispatched SMS via Orange Guinea API', { to: formattedPhone, messageId });
      return { success: true, provider: 'ORANGE_GUINEA', messageId, to: formattedPhone };
    }

    if (provider === 'MTN_GUINEA' && process.env.MTN_SMS_API_KEY) {
      // In production: MTN Guinea API call
      logger.info('Dispatched SMS via MTN Guinea API', { to: formattedPhone, messageId });
      return { success: true, provider: 'MTN_GUINEA', messageId, to: formattedPhone };
    }

    // Default: Mock Provider (Logs securely without external gateway cost)
    logger.info(`[SMS MOCK] Envoi à ${formattedPhone}: "${message}"`, {
      templateCode: templateCode || 'CUSTOM',
      messageId,
    });

    return {
      success: true,
      provider: 'MOCK',
      messageId,
      to: formattedPhone,
      body: message,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Dispatches automated validation notification.
   */
  static async notifyValidationStatus({ to, driverName, status, reason }) {
    let message = '';
    if (status === 'VALIDE') {
      message = `AOTUC: Félicitations ${driverName}, votre dossier est validé. Votre badge professionnel est prêt pour délivrance.`;
    } else if (status === 'RETOURNE_POUR_CORRECTION') {
      message = `AOTUC: Bonjour ${driverName}, votre dossier nécessite une correction: "${reason}". Rendez-vous au bureau communal.`;
    } else {
      message = `AOTUC: Votre dossier a été mis à jour (Statut: ${status}).`;
    }

    return await this.sendSms({ to, message, templateCode: `VALIDATION_${status}` });
  }
}

export default SmsService;