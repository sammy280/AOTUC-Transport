import request from 'supertest';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';

describe('Notifications Module — Real-Time Alert & Notification Delivery', () => {
  const mockDirectorToken = jwt.sign(
    {
      sub: 'usr-dir-001',
      roles: ['DIRECTOR'],
      communeId: null,
    },
    config.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );

  describe('1. Authentication Gate', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Notification Retrieval & Simulation', () => {
    it('should fetch notifications for authenticated director', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${mockDirectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should dispatch a simulated notification via Socket.IO hub', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/simulate')
        .set('Authorization', `Bearer ${mockDirectorToken}`)
        .send({
          title: 'Test Alerte AOTUC',
          message: 'Dossier validé avec succès.',
          category: 'VALIDATION',
          priority: 'SUCCESS',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Alerte AOTUC');
      expect(res.body.data.category).toBe('VALIDATION');
    });

    it('should mark a notification as read', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/notif-1234/read')
        .set('Authorization', `Bearer ${mockDirectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('notif-1234');
    });
  });
});
