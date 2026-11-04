import { z } from 'zod';

export const createTariffSchema = z.object({
  code: z
    .string({ required_error: 'Le code tarif est obligatoire.' })
    .min(2, 'Le code tarif doit comporter au moins 2 caractères.')
    .max(20, 'Le code tarif ne doit pas dépasser 20 caractères.'),
  name: z
    .string({ required_error: 'Le libellé du tarif est obligatoire.' })
    .min(3, 'Le libellé doit comporter au moins 3 caractères.')
    .max(100),
  priceGnf: z
    .number({ required_error: 'Le prix unitaire en GNF est obligatoire.' })
    .int('Le prix doit être un entier.')
    .positive('Le prix unitaire en GNF doit être strictement positif.'),
  vehicleCategory: z.string().optional(),
});

export const createBatchSchema = z.object({
  batchNumber: z
    .string({ required_error: 'Le numéro de lot est obligatoire.' })
    .min(3)
    .max(50),
  tariffId: z.string().min(1, 'Identifiant tarif obligatoire.'),
  startSerial: z
    .number({ required_error: 'Le numéro de série de départ est obligatoire.' })
    .int()
    .positive(),
  endSerial: z
    .number({ required_error: 'Le numéro de série de fin est obligatoire.' })
    .int()
    .positive(),
}).refine((data) => data.endSerial >= data.startSerial, {
  message: 'Le numéro de série de fin doit être supérieur ou égal au numéro de début.',
  path: ['endSerial'],
});

export const allocateBatchSchema = z.object({
  batchId: z.string().min(1, 'Identifiant de lot obligatoire.'),
  distributorUserId: z.string().min(1, 'Identifiant distributeur obligatoire.'),
});

export const recordSaleSchema = z.object({
  tariffId: z.string().min(1, 'Identifiant tarif obligatoire.'),
  batchId: z.string().min(1, 'Identifiant de carnet obligatoire.'),
  quantitySold: z
    .number({ required_error: 'La quantité vendue est obligatoire.' })
    .int()
    .positive('La quantité vendue doit être au moins 1 ticket.'),
  paymentMethod: z.enum(['ESPECES', 'ORANGE_MONEY', 'MTN_MOMO', 'VIREMENT_BANCAIRE'], {
    errorMap: () => ({ message: 'Mode de paiement non reconnu (ESPECES, ORANGE_MONEY, MTN_MOMO, VIREMENT_BANCAIRE).' }),
  }),
  paymentRef: z.string().max(100).optional(),
  buyerName: z.string().max(120).optional(),
  buyerPhone: z.string().max(30).optional(),
});

export const ledgerEntrySchema = z.object({
  debitAccountId: z.string().min(1, 'Compte de débit obligatoire.'),
  creditAccountId: z.string().min(1, 'Compte de crédit obligatoire.'),
  amountGnf: z
    .number({ required_error: 'Le montant en GNF est obligatoire.' })
    .int()
    .positive('Le montant doit être strictement supérieur à zéro.'),
  transactionType: z.enum(
    ['ALLOCATION_DISTRIBUTEUR', 'VENTE_TICKETS_DIRECTE', 'ENCAISSEMENT_MOBILE_MONEY', 'VERSEMENT_BANQUE_BCRG', 'REGULARISATION_COMPTABLE'],
    { errorMap: () => ({ message: 'Type de transaction comptable invalide.' }) }
  ),
  referenceCode: z.string().min(2).max(100),
  description: z.string().min(3).max(255),
}).refine((data) => data.debitAccountId !== data.creditAccountId, {
  message: 'Le compte débit et le compte crédit doivent être strictement distincts en partie double.',
  path: ['creditAccountId'],
});
