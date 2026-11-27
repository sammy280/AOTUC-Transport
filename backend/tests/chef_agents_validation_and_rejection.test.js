import request from 'supertest';
import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import ValidationStateMachine from '../src/modules/validation/validation.machine.js';
import ValidationService from '../src/modules/validation/validation.service.js';
import prisma from '../src/utils/prisma.js';

describe('Chef des Agents Validation Workflow & Rejection Remarks Suite', () => {
  let agentMatotoToken;
  let chefMatotoToken;
  let chefKaloumToken;
  let directorToken;

  const agentUser = {
    id: 'test-agent-matoto-uuid',
    roles: ['AGENT_TERRAIN'],
    communeId: 'test-matoto-commune-id',
  };

  const chefMatotoUser = {
    id: 'test-chef-matoto-uuid',
    roles: ['CHEF_SERVICE'],
    communeId: 'test-matoto-commune-id',
  };

  const chefKaloumUser = {
    id: 'test-chef-kaloum-uuid',
    roles: ['CHEF_SERVICE'],
    communeId: 'test-kaloum-commune-id',
  };

  const directorUser = {
    id: 'test-director-uuid',
    roles: ['DIRECTOR'],
    communeId: null,
  };

  beforeAll(() => {
    jest.setTimeout(45000);
    agentMatotoToken = jwt.sign(
      { sub: agentUser.id, roles: agentUser.roles, communeId: agentUser.communeId },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    chefMatotoToken = jwt.sign(
      { sub: chefMatotoUser.id, roles: chefMatotoUser.roles, communeId: chefMatotoUser.communeId },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    chefKaloumToken = jwt.sign(
      { sub: chefKaloumUser.id, roles: chefKaloumUser.roles, communeId: chefKaloumUser.communeId },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    directorToken = jwt.sign(
      { sub: directorUser.id, roles: directorUser.roles, communeId: directorUser.communeId },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. State Machine: Transfer of Chauffeur & Vehicle Validation to Chef des Agents', () => {
    it('allows Chef des Agents (CHEF_SERVICE) to APPROVE_FINAL a chauffeur dossier from SOUMIS_NIVEAU2', () => {
      const result = ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'APPROVE_FINAL',
        reviewerUser: chefMatotoUser,
        submitterId: agentUser.id,
        comment: null,
        requestCommuneId: 'test-matoto-commune-id',
        entityType: 'DRIVER_ENROLMENT',
      });

      expect(result.newStatus).toBe('VALIDE');
      expect(result.newLevel).toBe(2);
    });

    it('allows Chef des Agents (CHEF_SERVICE) to APPROVE_FINAL a vehicle dossier from SOUMIS_NIVEAU2', () => {
      const result = ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'APPROVE_FINAL',
        reviewerUser: chefMatotoUser,
        submitterId: agentUser.id,
        comment: null,
        requestCommuneId: 'test-matoto-commune-id',
        entityType: 'VEHICLE_ENROLMENT',
      });

      expect(result.newStatus).toBe('VALIDE');
      expect(result.newLevel).toBe(2);
    });

    it('STRICTLY BLOCKS the Director from validating chauffeur dossiers (FORBIDDEN_DIRECTOR_VALIDATION)', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'APPROVE_FINAL',
          reviewerUser: directorUser,
          submitterId: agentUser.id,
          comment: null,
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('La validation des dossiers chauffeurs et véhicules est attribuée exclusivement au Chef des Agents');
    });

    it('STRICTLY BLOCKS the Director from validating vehicle dossiers (FORBIDDEN_DIRECTOR_VALIDATION)', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'APPROVE_FINAL',
          reviewerUser: directorUser,
          submitterId: agentUser.id,
          comment: null,
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'VEHICLE_ENROLMENT',
        });
      }).toThrow('La validation des dossiers chauffeurs et véhicules est attribuée exclusivement au Chef des Agents');
    });

    it('STRICTLY BLOCKS unauthorized roles (e.g. AGENT_TERRAIN) from executing APPROVE_FINAL', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'APPROVE_FINAL',
          reviewerUser: agentUser,
          submitterId: 'another-agent-uuid',
          comment: null,
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('Permissions insuffisantes');
    });

    it('blocks self-approval when Chef des Agents submitted the dossier themselves', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'APPROVE_FINAL',
          reviewerUser: chefMatotoUser,
          submitterId: chefMatotoUser.id, // SAME ACTOR
          comment: null,
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('Conflit d intérêt : vous ne pouvez pas approuver');
    });

    it('enforces territorial commune scope: Chef of Kaloum cannot review Matoto dossier', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'APPROVE_FINAL',
          reviewerUser: chefKaloumUser,
          submitterId: agentUser.id,
          comment: null,
          requestCommuneId: 'test-matoto-commune-id', // Matoto != Kaloum
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('Accès refusé. Vous ne pouvez valider que les dossiers rattachés aux agents de votre commune');
    });
  });

  describe('2. Rejection Remarks & Explanations Integrity', () => {
    it('STRICTLY BLOCKS rejecting a dossier when no comment is provided', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'REJECT',
          reviewerUser: chefMatotoUser,
          submitterId: agentUser.id,
          comment: '', // Empty
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('Un motif circonstancié (au moins 5 caractères) est obligatoire');
    });

    it('STRICTLY BLOCKS rejecting a dossier when comment is too short (< 5 chars)', () => {
      expect(() => {
        ValidationStateMachine.evaluate({
          currentStatus: 'SOUMIS_NIVEAU2',
          action: 'REJECT',
          reviewerUser: chefMatotoUser,
          submitterId: agentUser.id,
          comment: 'bad', // only 3 chars
          requestCommuneId: 'test-matoto-commune-id',
          entityType: 'DRIVER_ENROLMENT',
        });
      }).toThrow('Un motif circonstancié (au moins 5 caractères) est obligatoire');
    });

    it('allows Chef des Agents to REJECT with a valid explanation (>= 5 chars)', () => {
      const result = ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'REJECT',
        reviewerUser: chefMatotoUser,
        submitterId: agentUser.id,
        comment: 'Photo de permis tronquée et illisible. Date de validité échue.',
        requestCommuneId: 'test-matoto-commune-id',
        entityType: 'DRIVER_ENROLMENT',
      });

      expect(result.newStatus).toBe('REJETE');
      expect(result.newLevel).toBe(2);
    });

    it('allows Chef des Agents to RETURN_FOR_CORRECTION with a valid explanation', () => {
      const result = ValidationStateMachine.evaluate({
        currentStatus: 'SOUMIS_NIVEAU2',
        action: 'RETURN_FOR_CORRECTION',
        reviewerUser: chefMatotoUser,
        submitterId: agentUser.id,
        comment: 'Veuillez re-téléverser la carte grise avec le cachet lisible.',
        requestCommuneId: 'test-matoto-commune-id',
        entityType: 'VEHICLE_ENROLMENT',
      });

      expect(result.newStatus).toBe('RETOURNE_POUR_CORRECTION');
      expect(result.newLevel).toBe(1); // Sent back to Level 1 agent
    });
  });

  describe('3. API Endpoints & Dossier Enrichment', () => {
    it('returns 400 when attempting transition without required comment', async () => {
      // Find a pending request in database
      const pendingReq = await prisma.validationRequest.findFirst({
        where: { currentStatus: 'SOUMIS_NIVEAU2' },
      });

      if (pendingReq) {
        const res = await request(app)
          .post(`/api/v1/validation/requests/${pendingReq.id}/transition`)
          .set('Authorization', `Bearer ${chefMatotoToken}`)
          .send({ action: 'REJECT', comment: '' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/motif circonstancié/i);
      }
    });

    it('returns 403 when Director attempts to execute transition on chauffeur dossier', async () => {
      const driverReq = await prisma.validationRequest.findFirst({
        where: { currentStatus: 'SOUMIS_NIVEAU2', entityType: 'DRIVER_ENROLMENT' },
      });

      if (driverReq) {
        const res = await request(app)
          .post(`/api/v1/validation/requests/${driverReq.id}/transition`)
          .set('Authorization', `Bearer ${directorToken}`)
          .send({ action: 'APPROVE_FINAL' });

        expect(res.statusCode).toBe(403);
        expect(res.body.message).toMatch(/Chef des Agents/i);
      }
    });

    it('enriches validation requests list with applicant details and documents', async () => {
      // Test the service enrichment directly
      const listResult = await ValidationService.listRequests(
        { page: 1, limit: 5 },
        { id: 'admin', roles: ['SUPER_ADMIN'], communeId: null }
      );

      expect(listResult).toBeDefined();
      expect(Array.isArray(listResult.items)).toBe(true);

      if (listResult.items.length > 0) {
        const first = listResult.items[0];
        expect(first.applicantName).toBeDefined();
        expect(first.targetDetails).toBeDefined();
        expect(first.communeName).toBeDefined();
        expect(Array.isArray(first.documents)).toBe(true);
        expect(Array.isArray(first.history)).toBe(true);
      }
    }, 30000);
  });
});
