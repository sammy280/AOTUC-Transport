import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import prisma from '../src/utils/prisma.js';

describe('Milestone 7 — Ticketing & Immutable Double-Entry Financial Ledger (GNF)', () => {
  let directorToken;
  let distributorToken;
  let agentToken;

  const mockTariff = {
    id: 'tariff-uuid-001',
    code: 'T-2000',
    name: 'Ticket Minibus Urbain 2 000 GNF',
    priceGnf: 2000,
    vehicleCategory: 'MINIBUS_URBAIN',
    isActive: true,
  };

  const mockBatch = {
    id: 'batch-uuid-001',
    batchNumber: 'LOT-2026-0001',
    tariffId: 'tariff-uuid-001',
    startSerial: BigInt(1000001),
    endSerial: BigInt(1000100),
    totalCount: 100,
    remainingCount: 100,
    status: 'EN_STOCK_CENTRAL',
    tariff: mockTariff,
  };

  const mockAccountDebit = {
    id: 'acc-uuid-caisse',
    accountCode: '531100',
    name: 'Caisse Centrale AOTUC',
    balanceGnf: BigInt(15000000),
    currency: 'GNF',
    isActive: true,
  };

  const mockAccountCredit = {
    id: 'acc-uuid-produit',
    accountCode: '706100',
    name: 'Recettes Billetterie Urbaine',
    balanceGnf: BigInt(45000000),
    currency: 'GNF',
    isActive: true,
  };

  beforeAll(() => {
    directorToken = jwt.sign(
      { sub: 'dir-001', roles: ['DIRECTOR'], communeId: null },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    distributorToken = jwt.sign(
      { sub: 'dst-001', roles: ['DISTRIBUTEUR'], communeId: 'commune-kaloum' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    agentToken = jwt.sign(
      { sub: 'agt-001', roles: ['AGENT_TERRAIN'], communeId: 'commune-matoto' },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // Mock Prisma queries for testing without an active PostgreSQL network connection
    jest.spyOn(prisma.ticketTariff, 'findUnique').mockImplementation(async ({ where }) => {
      if (where.code === 'T-2000' || where.id === 'tariff-uuid-001') return mockTariff;
      return null;
    });

    jest.spyOn(prisma.ticketTariff, 'findMany').mockResolvedValue([mockTariff]);

    jest.spyOn(prisma.ticketTariff, 'create').mockImplementation(async ({ data }) => {
      return { id: 'tariff-uuid-new', ...data };
    });

    jest.spyOn(prisma.ticketBatch, 'findUnique').mockImplementation(async ({ where }) => {
      if (where.batchNumber === 'LOT-2026-0001' || where.id === 'batch-uuid-001') return mockBatch;
      return null;
    });

    jest.spyOn(prisma.ticketBatch, 'findMany').mockResolvedValue([mockBatch]);

    jest.spyOn(prisma.ticketBatch, 'create').mockImplementation(async ({ data }) => {
      return {
        id: 'batch-uuid-created',
        ...data,
        tariff: mockTariff,
      };
    });

    jest.spyOn(prisma.ticketBatch, 'update').mockImplementation(async ({ data }) => {
      return {
        ...mockBatch,
        ...data,
        startSerial: mockBatch.startSerial,
        endSerial: mockBatch.endSerial,
        tariff: mockTariff,
        allocatedToUser: { id: 'dst-001', firstName: 'Ousmane', lastName: 'Sylla', email: 'distrib@aotuc.gn' },
      };
    });

    jest.spyOn(prisma.financialAccount, 'findUnique').mockImplementation(async ({ where }) => {
      if (where.id === 'acc-uuid-caisse') return mockAccountDebit;
      if (where.id === 'acc-uuid-produit') return mockAccountCredit;
      return null;
    });

    jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([mockAccountDebit, mockAccountCredit]);

    jest.spyOn(prisma.financialLedgerEntry, 'findMany').mockResolvedValue([]);

    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-mock-id' });

    // Mock Prisma transactions
    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
      const mockTx = {
        ticketBatch: {
          update: jest.fn().mockResolvedValue(mockBatch),
        },
        ticketSale: {
          create: jest.fn().mockImplementation(async ({ data }) => ({
            id: 'sale-uuid-001',
            ...data,
            tariff: mockTariff,
            batch: mockBatch,
          })),
        },
        financialAccount: {
          update: jest.fn().mockResolvedValue({}),
        },
        financialLedgerEntry: {
          create: jest.fn().mockImplementation(async ({ data }) => ({
            id: 'entry-uuid-001',
            ...data,
            debitAccount: mockAccountDebit,
            creditAccount: mockAccountCredit,
          })),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'audit-tx-id' }),
        },
      };
      return await callback(mockTx);
    });
  });

  describe('1. Ticket Tariffs & Physical Batches (Carnets)', () => {
    it('should allow Director to list active tariffs', async () => {
      const res = await request(app)
        .get('/api/v1/ticketing/tariffs')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should REJECT negative or zero tariff price (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/tariffs')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          code: 'T-NEGATIVE',
          name: 'Tarif Erroné',
          priceGnf: -500, // Invalid negative
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should REJECT Field Agent attempting to create an official tariff (403)', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/tariffs')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          code: 'T-UNAUTH',
          name: 'Tarif Non Autorisé',
          priceGnf: 3000,
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('should REJECT batch creation when endSerial is less than startSerial', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/batches')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          batchNumber: 'LOT-INVALIDE-01',
          tariffId: '11111111-1111-1111-1111-111111111111',
          startSerial: 500,
          endSerial: 200, // Invalid!
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Ticket Sales & Automatic Inventory Decrement', () => {
    it('should allow Authorized Distributor to record a ticket sale', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/sales')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          tariffId: '11111111-1111-1111-1111-111111111111',
          batchId: 'batch-uuid-001',
          quantitySold: 10,
          paymentMethod: 'ORANGE_MONEY',
          paymentRef: 'OM-CI-2026-99882',
          buyerName: 'Syndicat Matoto',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptNumber).toMatch(/^REC-/);
      expect(res.body.data.quantitySold).toBe(10);
      expect(res.body.data.totalAmountGnf).toBe('20000'); // 10 * 2000 GNF
    });

    it('should REJECT sale when quantity exceeds available batch stock', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/sales')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          tariffId: '11111111-1111-1111-1111-111111111111',
          batchId: 'batch-uuid-001',
          quantitySold: 9999, // Stock is only 100!
          paymentMethod: 'ESPECES',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('3. Immutable Double-Entry Financial Ledger (Partie Double)', () => {
    it('should REJECT identical debit and credit accounts in ledger posting', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/ledger/entries')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          debitAccountId: 'acc-uuid-caisse',
          creditAccountId: 'acc-uuid-caisse', // Identical! Violates double-entry fundamental law
          amountGnf: 500000,
          transactionType: 'VENTE_TICKETS_DIRECTE',
          referenceCode: 'REC-2026-001',
          description: 'Vente directe carnet',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully post balanced double-entry ledger transaction', async () => {
      const res = await request(app)
        .post('/api/v1/ticketing/ledger/entries')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          debitAccountId: 'acc-uuid-caisse',
          creditAccountId: 'acc-uuid-produit',
          amountGnf: 2000000,
          transactionType: 'VERSEMENT_BANQUE_BCRG',
          referenceCode: 'BCRG-DEP-2026-042',
          description: 'Dépôt recettes billetterie à la Banque Centrale',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amountGnf).toBe('2000000');
      expect(res.body.data.entryNumber).toMatch(/^JNL-/);
    });

    it('should allow Director to query treasury balances and recent ledger entries', async () => {
      const res = await request(app)
        .get('/api/v1/ticketing/ledger/summary')
        .set('Authorization', `Bearer ${directorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accounts');
      expect(res.body.data).toHaveProperty('recentEntries');
    });
  });
});