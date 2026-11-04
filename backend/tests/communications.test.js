import SmsService from '../src/services/smsService.js';
import SocketService from '../src/services/socketService.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';

describe('Milestone 8 — Communications: SMS Gateway & Real-Time Socket.IO Hub', () => {
  describe('1. Guinean Phone Normalization & SMS Dispatching', () => {
    it('should normalize 9-digit local mobile numbers to E.164 (+224)', () => {
      const normalized = SmsService.normalizePhone('622112233');
      expect(normalized).toBe('+224622112233');
    });

    it('should normalize 12-digit national numbers to E.164 (+224)', () => {
      const normalized = SmsService.normalizePhone('224628445566');
      expect(normalized).toBe('+224628445566');
    });

    it('should send validation approval SMS notification in French', async () => {
      const result = await SmsService.notifyValidationStatus({
        to: '+224622112233',
        driverName: 'Abdoulaye Bah',
        status: 'VALIDE',
      });

      expect(result.success).toBe(true);
      expect(result.to).toBe('+224622112233');
      expect(result.body).toContain('Félicitations Abdoulaye Bah');
      expect(result.body).toContain('badge professionnel est prêt');
      expect(result.messageId).toMatch(/^SMS-/);
    });

    it('should send correction required SMS notification with detailed reason', async () => {
      const result = await SmsService.notifyValidationStatus({
        to: '+224628990011',
        driverName: 'Mohamed Diallo',
        status: 'RETOURNE_POUR_CORRECTION',
        reason: 'Permis de conduire illisible',
      });

      expect(result.success).toBe(true);
      expect(result.body).toContain('Permis de conduire illisible');
      expect(result.body).toContain('Rendez-vous au bureau communal');
    });

    it('should REJECT invalid non-Guinean phone numbers', async () => {
      await expect(
        SmsService.sendSms({
          to: '0612345678', // French local without country code
          message: 'Test',
        })
      ).rejects.toThrow('Numéro de téléphone guinéen invalide');
    });
  });

  describe('2. Socket.IO Real-Time Dispatch Hub', () => {
    it('should initialize WebSocket server and provide singleton accessor', () => {
      const mockServer = http.createServer();
      const io = SocketService.init(mockServer);

      expect(io).toBeDefined();
      expect(SocketService.getIO()).toBe(io);
    });
  });
});
