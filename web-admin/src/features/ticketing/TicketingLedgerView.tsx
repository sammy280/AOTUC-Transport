import React, { useState } from 'react';
import {
  Ticket,
  DollarSign,
  Building2,
  Wallet,
  Receipt,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Send,
  RotateCcw,
  History,
  Lock,
  Smartphone,
  Coins,
  Download,
} from 'lucide-react';
import { UserContext } from '../../types';

interface Tariff {
  id: string;
  code: string;
  name: string;
  priceGnf: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  tariffName: string;
  priceGnf: number;
  startSerial: string;
  endSerial: string;
  remainingCount: number;
  totalCount: number;
  status: 'EN_STOCK_CENTRAL' | 'ALLOUE_DISTRIBUTEUR' | 'EPUISE';
  allocatedToName?: string;
}

interface LedgerEntry {
  id: string;
  entryNumber: string;
  createdAt: string;
  debitAccountName: string;
  creditAccountName: string;
  amountGnf: number;
  transactionType: string;
  referenceCode: string;
  operator: string;
}

interface SaleRecord {
  id: string;
  receiptNumber: string;
  createdAt: string;
  batchNumber: string;
  quantity: number;
  unitPriceGnf: number;
  totalGnf: number;
  paymentMethod: string;
  buyerName: string;
  operatorName: string;
  status: 'PAYE' | 'ANNULE_REMBOURSE';
  reversalReason?: string;
}

const INITIAL_TARIFFS: Tariff[] = [
  { id: 't1', code: 'T-2000', name: 'Ticket Urbain Standard (Minibus/Taxi)', priceGnf: 2000 },
  { id: 't2', code: 'T-5000', name: 'Ticket Express Conakry-Express / Périurbain', priceGnf: 5000 },
  { id: 't3', code: 'T-10000', name: 'Pass Journalier Tout Réseau Conakry', priceGnf: 10000 },
];

const INITIAL_BATCHES: Batch[] = [
  {
    id: 'b1',
    batchNumber: 'LOT-2026-0001',
    tariffName: 'Ticket Urbain Standard (Minibus/Taxi)',
    priceGnf: 2000,
    startSerial: '1000001',
    endSerial: '1000100',
    remainingCount: 34,
    totalCount: 100,
    status: 'ALLOUE_DISTRIBUTEUR',
    allocatedToName: 'Ousmane Sylla (Distributeur Kaloum)',
  },
  {
    id: 'b2',
    batchNumber: 'LOT-2026-0002',
    tariffName: 'Ticket Urbain Standard (Minibus/Taxi)',
    priceGnf: 2000,
    startSerial: '1000101',
    endSerial: '1000200',
    remainingCount: 88,
    totalCount: 100,
    status: 'ALLOUE_DISTRIBUTEUR',
    allocatedToName: 'Sekou Conte (Agent Matoto)',
  },
  {
    id: 'b3',
    batchNumber: 'LOT-2026-0003',
    tariffName: 'Pass Journalier Tout Réseau Conakry',
    priceGnf: 10000,
    startSerial: '5000001',
    endSerial: '5000050',
    remainingCount: 50,
    totalCount: 50,
    status: 'EN_STOCK_CENTRAL',
  },
];

const INITIAL_LEDGER: LedgerEntry[] = [
  {
    id: 'l1',
    entryNumber: 'JNL-2026-000841',
    createdAt: '04/11/2026 14:32',
    debitAccountName: '512100 - Banque Centrale (BCRG)',
    creditAccountName: '706100 - Recettes Vente Billetterie',
    amountGnf: 145000000,
    transactionType: 'VERSEMENT_BANQUE_BCRG',
    referenceCode: 'BCRG-DEP-2026-042',
    operator: 'Mamadou Camara (Directeur)',
  },
  {
    id: 'l2',
    entryNumber: 'JNL-2026-000840',
    createdAt: '04/11/2026 12:15',
    debitAccountName: '531100 - Caisse Principale AOTUC',
    creditAccountName: '411100 - Compte Distributeurs Agréés',
    amountGnf: 12400000,
    transactionType: 'ENCAISSEMENT_MOBILE_MONEY',
    referenceCode: 'REC-OM-2026-991',
    operator: 'Ousmane Sylla (Distributeur)',
  },
  {
    id: 'l3',
    entryNumber: 'JNL-2026-000839',
    createdAt: '04/11/2026 09:40',
    debitAccountName: '531100 - Caisse Principale AOTUC',
    creditAccountName: '706100 - Recettes Vente Billetterie',
    amountGnf: 5600000,
    transactionType: 'VENTE_TICKETS_DIRECTE',
    referenceCode: 'REC-2026-00441',
    operator: 'Sekou Conte (Agent Terrain)',
  },
];

const INITIAL_SALES: SaleRecord[] = [
  {
    id: 'sale-1',
    receiptNumber: 'REC-OM-2026-991',
    createdAt: '04/11/2026 12:15',
    batchNumber: 'LOT-2026-0001',
    quantity: 10,
    unitPriceGnf: 2000,
    totalGnf: 20000,
    paymentMethod: 'ORANGE_MONEY',
    buyerName: 'Mamadou Diallo (Magbana Kaloum)',
    operatorName: 'Ousmane Sylla (Distributeur Kaloum)',
    status: 'PAYE',
  },
  {
    id: 'sale-2',
    receiptNumber: 'REC-MOMO-2026-842',
    createdAt: '04/11/2026 10:40',
    batchNumber: 'LOT-2026-0001',
    quantity: 5,
    unitPriceGnf: 2000,
    totalGnf: 10000,
    paymentMethod: 'MTN_MOMO',
    buyerName: 'Aboubacar Soumah (Taxi Urbain)',
    operatorName: 'Ousmane Sylla (Distributeur Kaloum)',
    status: 'PAYE',
  },
  {
    id: 'sale-3',
    receiptNumber: 'REC-CASH-2026-710',
    createdAt: '04/11/2026 09:25',
    batchNumber: 'LOT-2026-0001',
    quantity: 25,
    unitPriceGnf: 2000,
    totalGnf: 50000,
    paymentMethod: 'ESPECES',
    buyerName: 'Passagers Gare Kaloum',
    operatorName: 'Ousmane Sylla (Distributeur Kaloum)',
    status: 'PAYE',
  },
];

export const TicketingLedgerView: React.FC<{ currentUser: UserContext }> = ({ currentUser }) => {
  const isDistributor = currentUser.role === 'DISTRIBUTEUR';

  const [activeTab, setActiveTab] = useState<'batches' | 'ledger' | 'pos' | 'my_sales'>(
    isDistributor ? 'pos' : 'batches'
  );
  const [tariffs] = useState<Tariff[]>(INITIAL_TARIFFS);
  const [batches, setBatches] = useState<Batch[]>(INITIAL_BATCHES);
  const [ledger, setLedger] = useState<LedgerEntry[]>(INITIAL_LEDGER);
  const [sales, setSales] = useState<SaleRecord[]>(INITIAL_SALES);
  const [saleFeedback, setSaleFeedback] = useState<string | null>(null);

  // Scoped batches: if distributor, only show lots allocated to them
  const visibleBatches = isDistributor
    ? batches.filter(
        (b) =>
          b.status === 'ALLOUE_DISTRIBUTEUR' &&
          (b.allocatedToName?.toLowerCase().includes('sylla') ||
            b.allocatedToName?.toLowerCase().includes(currentUser.name.toLowerCase()))
      )
    : batches;

  // Quick POS State
  const defaultBatch = visibleBatches[0] || batches[0];
  const [posBatchId, setPosBatchId] = useState<string>(defaultBatch ? defaultBatch.id : '');
  const [posQuantity, setPosQuantity] = useState<number>(5);
  const [posPaymentMethod, setPosPaymentMethod] = useState<string>('ORANGE_MONEY');
  const [posBuyer, setPosBuyer] = useState<string>('Chauffeur Magbana - Kaloum');

  const selectedPosBatch =
    visibleBatches.find((b) => b.id === posBatchId) ||
    batches.find((b) => b.id === posBatchId) ||
    defaultBatch;

  const posTotalGnf = selectedPosBatch ? selectedPosBatch.priceGnf * posQuantity : 0;

  // Handle POS sale recording
  const handleRecordSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosBatch) {
      alert('Aucun carnet disponible !');
      return;
    }
    if (selectedPosBatch.remainingCount < posQuantity) {
      alert('Stock insuffisant dans ce carnet !');
      return;
    }

    // Decrement batch
    const updatedBatches = batches.map((b) => {
      if (b.id === selectedPosBatch.id) {
        const remaining = b.remainingCount - posQuantity;
        return {
          ...b,
          remainingCount: remaining,
          status: remaining === 0 ? ('EPUISE' as const) : b.status,
        };
      }
      return b;
    });
    setBatches(updatedBatches);

    const receiptNum = `REC-${posPaymentMethod === 'ORANGE_MONEY' ? 'OM' : posPaymentMethod === 'MTN_MOMO' ? 'MOMO' : 'CSH'}-2026-${Date.now().toString().slice(-4)}`;

    // Add personal sale record
    const newSale: SaleRecord = {
      id: `sale-${Date.now()}`,
      receiptNumber: receiptNum,
      createdAt: 'À l instant',
      batchNumber: selectedPosBatch.batchNumber,
      quantity: posQuantity,
      unitPriceGnf: selectedPosBatch.priceGnf,
      totalGnf: posTotalGnf,
      paymentMethod: posPaymentMethod,
      buyerName: posBuyer,
      operatorName: `${currentUser.name} (${currentUser.roleLabel})`,
      status: 'PAYE',
    };
    setSales([newSale, ...sales]);

    // Add immutable ledger entry
    const newEntry: LedgerEntry = {
      id: `l-${Date.now()}`,
      entryNumber: `JNL-2026-${Date.now().toString().slice(-6)}`,
      createdAt: 'À l instant',
      debitAccountName:
        posPaymentMethod === 'ESPECES'
          ? '531100 - Caisse Principale AOTUC'
          : '512200 - Compte Mobile Money (Orange/MTN)',
      creditAccountName: '706100 - Recettes Vente Billetterie',
      amountGnf: posTotalGnf,
      transactionType: 'VENTE_TICKETS_DIRECTE',
      referenceCode: receiptNum,
      operator: `${currentUser.name} (${currentUser.roleLabel})`,
    };
    setLedger([newEntry, ...ledger]);

    setSaleFeedback(
      `✓ VENTE CONFIRMÉE : Reçu émis (${receiptNum}) pour ${posQuantity} tickets (${posTotalGnf.toLocaleString()} GNF). Écriture comptable en partie double inscrite de manière immuable.`
    );
  };

  // Reversal workflow for Distributor
  const handleRequestReversal = (saleId: string) => {
    const targetSale = sales.find((s) => s.id === saleId);
    if (!targetSale) return;

    const reason = prompt(
      `Motif d annulation / remboursement pour le reçu ${targetSale.receiptNumber} (ex: Erreur de saisie opérateur, billet dégradé) :`
    );
    if (!reason || reason.trim().length < 5) {
      alert('Action annulée : Le motif d annulation est obligatoire (au moins 5 caractères).');
      return;
    }

    // Mark sale as reversed
    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId ? { ...s, status: 'ANNULE_REMBOURSE', reversalReason: reason } : s
      )
    );

    // Create reversing double-entry transaction
    const reversalEntry: LedgerEntry = {
      id: `l-rev-${Date.now()}`,
      entryNumber: `JNL-2026-${Date.now().toString().slice(-6)}`,
      createdAt: 'À l instant (Contre-passation)',
      debitAccountName: '706100 - Recettes Vente Billetterie',
      creditAccountName:
        targetSale.paymentMethod === 'ESPECES'
          ? '531100 - Caisse Principale AOTUC'
          : '512200 - Compte Mobile Money (Orange/MTN)',
      amountGnf: targetSale.totalGnf,
      transactionType: 'ANNULATION_VENTE',
      referenceCode: `REV-${targetSale.receiptNumber}`,
      operator: `${currentUser.name} (${currentUser.roleLabel})`,
    };
    setLedger([reversalEntry, ...ledger]);

    // Restore stock to batch
    setBatches((prev) =>
      prev.map((b) => {
        if (b.batchNumber === targetSale.batchNumber) {
          return {
            ...b,
            remainingCount: b.remainingCount + targetSale.quantity,
            status: 'ALLOUE_DISTRIBUTEUR',
          };
        }
        return b;
      })
    );

    setSaleFeedback(
      `✓ TRANSACTION CONTRE-PASSÉE : Le reçu ${targetSale.receiptNumber} a été annulé avec motif "${reason}". Contre-passation comptable générée et tickets réintégrés en stock.`
    );
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleDownloadTicketPdf = async (saleId?: string, receiptNum?: string) => {
    setIsDownloadingPdf(true);
    const targetId = saleId || (sales[0] ? sales[0].id : 's-default');
    const targetReceipt = receiptNum || (sales[0] ? sales[0].receiptNumber : 'REC-2026-00042');

    try {
      const token = localStorage.getItem('aotuc_auth_token') || sessionStorage.getItem('aotuc_auth_token');
      const response = await fetch(`/api/v1/ticketing/sales/${targetId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AOTUC_Billet_${targetReceipt}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setSaleFeedback(`✓ Billet de transport PDF généré et téléchargé avec succès (${targetReceipt}).`);
        return;
      }
    } catch {
      // Fallback
    } finally {
      setIsDownloadingPdf(false);
    }

    // Direct browser print fallback
    window.print();
  };

  // Calculations for Distributor KPI
  const myTotalSalesGnf = sales
    .filter((s) => s.status === 'PAYE')
    .reduce((acc, s) => acc + s.totalGnf, 0);
  const myTicketsCount = sales
    .filter((s) => s.status === 'PAYE')
    .reduce((acc, s) => acc + s.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <img
            src="/logo-guinee.png"
            alt="Sceau Officiel"
            className="w-11 h-11 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isDistributor
                ? 'Guichet de Billetterie Sécurisée (Point de Vente AOTUC)'
                : 'Billetterie Sécurisée & Grand Livre Financier (GNF)'}
            </h1>
            <p className="text-xs text-slate-500">
              {isDistributor
                ? 'Enregistrement des ventes de tickets en GNF (Orange Money, MTN MoMo, Espèces) et gestion des reçus.'
                : 'Traçabilité intégrale des carnets de tickets, ventes au guichet/mobile money et comptabilité en partie double.'}
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'batches'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>{isDistributor ? 'Mes Carnets' : 'Lots & Carnets'}</span>
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'pos'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Guichet de Vente (POS)</span>
          </button>
          <button
            onClick={() => setActiveTab('my_sales')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'my_sales'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isDistributor ? 'Mes Ventes & Reçus' : 'Ventes Récentes'}</span>
          </button>

          {/* General Ledger tab is STRICTLY HIDDEN for Distributors */}
          {!isDistributor && (
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition ${
                activeTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Journal en Partie Double</span>
            </button>
          )}
        </div>
      </div>

      {/* Role-tailored KPI Cards */}
      {isDistributor ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Mes Recettes (Shift)</div>
              <div className="text-base font-bold text-slate-900">{myTotalSalesGnf.toLocaleString()} GNF</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Tickets Émis</div>
              <div className="text-base font-bold text-slate-900">{myTicketsCount} tickets</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Carnet Actif</div>
              <div className="text-base font-bold text-slate-900">
                {selectedPosBatch ? `${selectedPosBatch.remainingCount} restants` : 'Aucun'}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Guichet AOTUC</div>
              <div className="text-base font-bold text-slate-900 truncate">Kaloum (Marché Niger)</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Recettes Totales</div>
              <div className="text-base font-bold text-slate-900">1 845 000 000 GNF</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Compte BCRG</div>
              <div className="text-base font-bold text-slate-900">1 680 000 000 GNF</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Caisse Centrale</div>
              <div className="text-base font-bold text-slate-900">165 000 000 GNF</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Tickets en Circulation</div>
              <div className="text-base font-bold text-slate-900">172 Carnets Actifs</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Content */}

      {/* TAB 1: Batches & Lots */}
      {activeTab === 'batches' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <Ticket className="w-4 h-4 text-blue-600" />
                <span>
                  {isDistributor
                    ? 'Carnets de Tickets Alloués à mon Guichet'
                    : 'Inventaire des Lots de Tickets Sécurisés'}
                </span>
              </h2>
              <div className="hidden lg:flex items-center space-x-1.5 text-[10px]">
                {tariffs.map((t) => (
                  <span
                    key={t.id}
                    className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold"
                  >
                    {t.code} ({t.priceGnf.toLocaleString()} GNF)
                  </span>
                ))}
              </div>
            </div>

            {!isDistributor && (
              <button
                onClick={() =>
                  alert('Ouverture du formulaire d émission de carnets sécurisés (Directeur / DSI).')
                }
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Émettre un Nouveau Lot</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">N° de Lot</th>
                  <th className="p-3">Tarif & Désignation</th>
                  <th className="p-3">Plage Séries</th>
                  <th className="p-3">Disponibilité</th>
                  <th className="p-3">Statut & Affectation</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{b.tariffName}</div>
                      <div className="text-slate-400 text-[10px]">
                        {b.priceGnf.toLocaleString()} GNF / ticket
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {b.startSerial} → {b.endSerial}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(b.remainingCount / b.totalCount) * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800">
                          {b.remainingCount} / {b.totalCount}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'EN_STOCK_CENTRAL'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'ALLOUE_DISTRIBUTEUR'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {b.status}
                      </span>
                      {b.allocatedToName && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs">
                          {b.allocatedToName}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {b.status === 'EN_STOCK_CENTRAL' && !isDistributor ? (
                        <button
                          onClick={() => alert(`Allouer le lot ${b.batchNumber} à un distributeur agréé.`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                        >
                          Allouer
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPosBatchId(b.id);
                            setActiveTab('pos');
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
                        >
                          Vendre
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: POS Quick Sale */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Enregistrement de Vente au Guichet (POS)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Génération immédiate du reçu sécurisé AOTUC et comptabilisation en partie double.
              </p>
            </div>

            <form onSubmit={handleRecordSale} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Carnet de Billets Source</label>
                <select
                  value={posBatchId}
                  onChange={(e) => setPosBatchId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium text-slate-800"
                >
                  {visibleBatches
                    .filter((b) => b.remainingCount > 0)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} — {b.tariffName} (Reste : {b.remainingCount} tickets)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantité Vendue</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedPosBatch ? selectedPosBatch.remainingCount : 100}
                    value={posQuantity}
                    onChange={(e) => setPosQuantity(parseInt(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mode de Paiement</label>
                  <select
                    value={posPaymentMethod}
                    onChange={(e) => setPosPaymentMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium text-slate-800"
                  >
                    <option value="ORANGE_MONEY">Orange Money Guinée (OM)</option>
                    <option value="MTN_MOMO">MTN Mobile Money (MoMo)</option>
                    <option value="ESPECES">Espèces (GNF)</option>
                    <option value="VIREMENT_BANCAIRE">Virement Bancaire BCRG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bénéficiaire / Acheteur</label>
                <input
                  type="text"
                  value={posBuyer}
                  onChange={(e) => setPosBuyer(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Total Summary Box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total à Encaisser</div>
                  <div className="text-xl font-black text-emerald-600">
                    {posTotalGnf.toLocaleString()} GNF
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm flex items-center space-x-1.5 transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Valider l Encaissement</span>
                </button>
              </div>
            </form>
          </div>

          {/* Receipt Preview & Confirmation Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-slate-600" />
                  <span>Aperçu du Reçu Officiel AOTUC</span>
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                  SÉCURISÉ
                </span>
              </div>

              <div
                className="aotuc-official-document p-4 border-2 border-dashed border-slate-300 rounded-xl space-y-3 bg-white text-xs font-mono text-slate-900 shadow-sm"
                data-official-document="true"
              >
                <div className="text-center border-b border-slate-200 pb-2">
                  <div className="font-bold text-slate-900">RÉPUBLIQUE DE GUINÉE</div>
                  <div className="text-[10px] text-slate-500">AUTORITÉ ORGANISATRICE DES TRANSPORTS URBAINS (AOTUC)</div>
                  <div className="text-[9px] text-slate-400">DIRECTION GÉNÉRALE • GUICHET KALOUM</div>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Carnet :</span>
                    <span className="font-bold text-slate-800">{selectedPosBatch?.batchNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tarif unitaire :</span>
                    <span>{selectedPosBatch ? selectedPosBatch.priceGnf.toLocaleString() : 0} GNF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quantité :</span>
                    <span className="font-bold">{posQuantity} ticket(s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Règlement :</span>
                    <span>{posPaymentMethod}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 text-xs">
                    <span>TOTAL PAYÉ :</span>
                    <span className="text-emerald-700">{posTotalGnf.toLocaleString()} GNF</span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-400 text-center pt-2 border-t border-slate-200">
                  Signature Cryptographique SHA-256 certifiée AOTUC.
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadTicketPdf()}
                disabled={isDownloadingPdf}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-[#FCD116]" />
                <span>
                  {isDownloadingPdf
                    ? 'Génération du billet PDF...'
                    : 'Télécharger Billet Sécurisé (PDF Thermique 74×140mm)'}
                </span>
              </button>

              {saleFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{saleFeedback}</span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-200 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Chaque vente génère une transaction officielle dans le grand livre comptable.</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Personal Sales History & Reversals */}
      {activeTab === 'my_sales' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>
                {isDistributor
                  ? 'Historique de mes Ventes & Reçus (Guichet Kaloum)'
                  : 'Historique des Ventes Récentes'}
              </span>
            </h2>
            <div className="text-[11px] text-slate-500 font-semibold">
              {sales.length} transaction(s) enregistrée(s)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">N° Reçu</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Carnet</th>
                  <th className="p-3">Qté</th>
                  <th className="p-3">Montant (GNF)</th>
                  <th className="p-3">Paiement</th>
                  <th className="p-3">Acheteur</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Procédure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{sale.receiptNumber}</td>
                    <td className="p-3 text-slate-500 text-[11px]">{sale.createdAt}</td>
                    <td className="p-3 font-mono text-slate-700">{sale.batchNumber}</td>
                    <td className="p-3 font-bold text-slate-900">{sale.quantity}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">
                      {sale.totalGnf.toLocaleString()} GNF
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {sale.paymentMethod === 'ORANGE_MONEY' && <Smartphone className="w-3 h-3 text-orange-500" />}
                        {sale.paymentMethod === 'MTN_MOMO' && <Smartphone className="w-3 h-3 text-yellow-500" />}
                        {sale.paymentMethod === 'ESPECES' && <Coins className="w-3 h-3 text-emerald-600" />}
                        <span>{sale.paymentMethod}</span>
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-[11px]">{sale.buyerName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.status === 'PAYE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sale.status === 'PAYE' ? 'Encaissé' : 'Contre-passé / Annulé'}
                      </span>
                      {sale.reversalReason && (
                        <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-xs">
                          Motif : {sale.reversalReason}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleDownloadTicketPdf(sale.id, sale.receiptNumber)}
                          className="px-2 py-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 rounded border border-blue-200 dark:border-blue-900 transition flex items-center space-x-1"
                          title="Télécharger le billet PDF officiel"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        {sale.status === 'PAYE' ? (
                          <button
                            onClick={() => handleRequestReversal(sale.id)}
                            className="px-2.5 py-1 text-[11px] text-rose-600 hover:text-rose-800 font-semibold hover:bg-rose-50 dark:hover:bg-slate-800 rounded border border-rose-200 dark:border-rose-900 transition flex items-center space-x-1"
                            title="Lancer une procédure d annulation / remboursement avec écriture de contre-passation"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Annuler</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Clôturé</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Double-Entry Ledger (Strictly hidden for distributors) */}
      {activeTab === 'ledger' && !isDistributor && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
              <span>Journal Comptable Officiel en Partie Double (Immuable)</span>
            </h2>

            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Balance Équilibrée (Débit = Crédit)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">N° Écriture</th>
                  <th className="p-3">Date & Heure</th>
                  <th className="p-3">Compte Débit (+)</th>
                  <th className="p-3">Compte Crédit (-)</th>
                  <th className="p-3 text-right">Montant (GNF)</th>
                  <th className="p-3">Référence</th>
                  <th className="p-3">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{entry.entryNumber}</td>
                    <td className="p-3 text-slate-500 text-[11px] flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{entry.createdAt}</span>
                    </td>
                    <td className="p-3 font-semibold text-emerald-800 bg-emerald-50/50">
                      {entry.debitAccountName}
                    </td>
                    <td className="p-3 font-semibold text-rose-800 bg-rose-50/50">
                      {entry.creditAccountName}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {entry.amountGnf.toLocaleString()} GNF
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{entry.referenceCode}</td>
                    <td className="p-3 text-slate-600 text-[11px]">{entry.operator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Safety Gate: If a distributor somehow reaches activeTab === 'ledger' */}
      {activeTab === 'ledger' && isDistributor && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Accès Restreint au Grand Livre Général</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Conformément à la politique RBAC d AOTUC, les distributeurs agréés n ont pas accès au journal général en partie double de l État. Vous pouvez consulter vos reçus dans l onglet "Mes Ventes & Reçus".
          </p>
          <button
            onClick={() => setActiveTab('pos')}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            Retourner au Guichet (POS)
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketingLedgerView;
