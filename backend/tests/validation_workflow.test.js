import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import ValidationStateMachine from '../src/modules/validation/validation.machine.js';

describe('Milestone 3 — Multi-Level Validation Workflow & Integrity Gates', () => {
  let agentToken;
  let chefMatotoToken;
  let chefKaloumToken;
  let directorToken;

  beforeAll(() => {
    agentToken = jwt.sign(
      { sub: 'agent-matoto-01', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefMatotoToken = jwt.sign(
      { sub: 'chef-matoto-01', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    chefKaloumToken = jwt.sign(
      { sub: 'chef-kaloum-01', roles: ['CHEF_SERVICE'], communeId: 'commune-kaloum' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    directorToken = jwt.sign(
      { sub: 'director-01', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );
  });

  describe('1. State Machine Unit Rules', () => {
    it('should permit Level 1 Agent to submit a draft to Level 2', () => {
      const evaluation = ValidationStateMachine.evaluate({
        currentStatus: 'BROUILLON',
        action: 'SUBMIT',
        reviewerUser: { id: 'agent-matoto-01', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
        submitterId: 'agent-matoto-01',
        comment: null,
        requestCommuneId: 'commune-matoto',
      });

      expect(evaluation.newStatus).toBe('SOUMIS_NIVEAU2');
      expect(evaluation.newLevel).toBe(2);
    });

    it('should permit Level 2 Chef de Service to forward a dossier to Level 3', () => {
      const evaluation = ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'FORWARD_TO_L3',
        reviewerUser: { id: 'chef-matoto-01', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto' },
        submitterId: 'agent-matoto-01', // Different actor
        comment: null,
        requestCommuneId: 'commune-matoto',
      });

      expect(evaluation.newStatus).toBe('EN_ATTENTE_NIVEAU3');
      expect(evaluation.newLevel).toBe(3);
    });

    it('should permit Level 3 Director to grant final validation (VALIDE)', () => {
      const evaluation = ValidationStateMachine.evaluate({
        currentStatus: 'EN_ATTENTE_NIVEAU3',
        action: 'APPROVE_FINAL',
        reviewerUser: { id: 'director-01', roles: ['DIRECTOR'], communeId: null },
        submitterId: 'agent-matoto-01',
        comment: null,
        requestCommuneId: 'commune-matoto',
      });

      expect(evaluation.newStatus).toBe('VALIDE');
      expect(evaluation.newLevel).toBe(3);
    });
  });

  describe('2. Anti-Fraud & Self-Approval Prevention', () => {
    it('STRICTLY PROHIBITS a user from approving their own submission (403)', () => {
      // Submitter agent becomes reviewer
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'FORWARD_TO_L3',
          reviewerUser: { id: 'agent-matoto-01', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto' },
          submitterId: 'agent-matoto-01', // SAME ACTOR!
          comment: null,
          requestCommuneId: 'commune-matoto',
        });
      }).toThrow('Conflit d intérêt : vous ne pouvez pas approuver');
    });
  });

  describe('3. Level Skipping & Illegal Transitions', () => {
    it('PROHIBITS skipping Level 2 (Director attempting to approve a Level 2 pending file directly)', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2', // Still awaiting Level 2!
          action: 'APPROVE_FINAL',
          reviewerUser: { id: 'director-01', roles: ['DIRECTOR'], communeId: null },
          submitterId: 'agent-matoto-01',
          comment: null,
          requestCommuneId: 'commune-matoto',
        });
      }).toThrow('Transition impossible');
    });

    it('PROHIBITS returning a file for correction without a mandatory comment', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'RETURN_FOR_CORRECTION',
          reviewerUser: { id: 'chef-matoto-01', roles: ['CHEF_SERVICE'], communeId: 'commune-matoto' },
          submitterId: 'agent-matoto-01',
          comment: '', // Empty comment!
          requestCommuneId: 'commune-matoto',
        });
      }).toThrow('Un motif circonstancié (au moins 5 caractères) est obligatoire');
    });
  });

  describe('4. Territorial Commune Scope Isolation', () => {
    it('STRICTLY REJECTS Chef de Service of Kaloum attempting to review a Matoto dossier', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'FORWARD_TO_L3',
          reviewerUser: { id: 'chef-kaloum-01', roles: ['CHEF_SERVICE'], communeId: 'commune-kaloum' },
          submitterId: 'agent-matoto-01',
          comment: null,
          requestCommuneId: 'commune-matoto', // DIFFERENT COMMUNE!
        });
      }).toThrow('Accès refusé. Vous ne pouvez valider que les dossiers rattachés à votre commune');
    });
  });

  describe('5. API Endpoint Guards', () => {
    it('rejects unauthenticated request to /api/v1/validation/requests with 401', async () => {
      const res = await request(app).get('/api/v1/validation/requests');
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects validation creation with invalid entity type with 400', async () => {
      const res = await request(app)
        .post('/api/v1/validation/requests')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          entityType: 'INVALID_TYPE',
          targetEntityId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
