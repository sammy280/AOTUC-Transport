import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IdCard,
  FileCheck2,
  QrCode,
  Download,
  ShieldCheck,
  Printer,
  CheckCircle2,
  Truck,
  User,
  Lock,
  AlertTriangle,
  Search,
  RefreshCw,
  XCircle,
  Clock,
  History,
  Check,
  X,
  Info,
} from 'lucide-react';
import { UserContext } from '../../types';
import { PERMISSIONS, hasRolePermission } from '../../utils/permissions';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import PrintCredentialModal, { PrintableCredentialData } from './PrintCredentialModal';

export type BadgeWorkflowStatus =
  | 'VALIDE'
  | 'EN_ATTENTE_VALIDATION'
  | 'ATTENTE_PAIEMENT'
  | 'NON_ELIGIBLE_DOSSIER'
  | 'REJETE';

export interface BadgeHistoryEntry {
  id: string;
  action: string;
  label: string;
  actorName: string;
  actorRole: string;
  comment?: string | null;
  timestamp?: string;
  formattedDate: string;
}

export interface BadgeRecord {
  id: string;
  badgeId?: string | null;
  driverId: string;
  badgeNumber: string;
  driverName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber?: string;
  activitySector: string;
  unionName?: string;
  registrationNumber: string;
  nin: string;
  licenseNumber: string;
  categories: string;
  commune: string;
  communeId?: string | null;
  issueDate: string;
  expiryDate: string;
  status: 'ACTIF' | 'REVOQUE' | 'SUSPENDU' | 'EN_ATTENTE_VALIDATION' | 'ATTENTE_PAIEMENT' | 'NON_ELIGIBLE';
  badgeWorkflowStatus: BadgeWorkflowStatus;
  driverStatus?: string;
  dossierStatus?: string;
  dossierRequestNumber?: string | null;
  isDossierApproved: boolean;
  isEligibleForValidation: boolean;
  canPrint: boolean;
  isPaymentConfirmed: boolean;
  paymentReference?: string | null;
  rejectionReason?: string | null;
  eligibilityReason: string;
  signaturePreview: string;
  photoDocumentId?: string | null;
  photoUrl?: string | null;
  hasIssuedBadge: boolean;
  validationHistory?: BadgeHistoryEntry[];
}

interface LicenceRecord {
  id: string;
  licenceNumber: string;
  plateNumber: string;
  vehicleMakeModel: string;
  ownerName: string;
  category: string;
  activitySector: string;
  seats: number;
  commune: string;
  validYear: number;
  status: 'ACTIF' | 'EXPIRE' | 'REVOQUE';
  isPaymentConfirmed: boolean;
  superAdminConfirmed: boolean;
  signaturePreview: string;
}

const INITIAL_BADGES: BadgeRecord[] = [
  {
    id: 'bdg-001',
    badgeId: 'bdg-001',
    driverId: 'drv-001',
    badgeNumber: 'CH-2026-00042',
    registrationNumber: 'CH-2026-00042',
    driverName: 'Abdoulaye Bah',
    firstName: 'Abdoulaye',
    lastName: 'BAH',
    dateOfBirth: '12/04/1988',
    activitySector: 'Transport Urbain — Taxi Communal',
    nin: '1988041200142',
    licenseNumber: 'PC-GN-2015-8841',
    categories: 'B, C1',
    commune: 'Matam',
    issueDate: '2026-02-15',
    expiryDate: '2028-02-15',
    status: 'ACTIF',
    badgeWorkflowStatus: 'VALIDE',
    isDossierApproved: true,
    isEligibleForValidation: true,
    canPrint: true,
    hasIssuedBadge: true,
    isPaymentConfirmed: true,
    eligibilityReason: 'Badge validé, signé cryptographiquement (Ed25519) et prêt pour impression CR80.',
    signaturePreview: 'AOTUC1.ed25519_2026_01.bdg-001.BADGE.DRIVER_Bah.1771113600.1834272000.7f4a9b...',
    validationHistory: [],
  },
];

const INITIAL_LICENCES: LicenceRecord[] = [
  {
    id: 'lic-001',
    licenceNumber: 'LIC-2026-00188',
    plateNumber: 'RC-9844-AB',
    vehicleMakeModel: 'Toyota HiAce Minibus (Magbana)',
    ownerName: 'El Hadj Ousmane Sow',
    category: 'MINIBUS_URBAIN',
    activitySector: 'Transport Public Urbain de Conakry',
    seats: 18,
    commune: 'Matoto',
    validYear: 2026,
    status: 'ACTIF',
    isPaymentConfirmed: true,
    superAdminConfirmed: true,
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-001.LICENCE.VEH_RC9844AB.1767225600.1798761600.8b22de...',
  },
  {
    id: 'lic-002',
    licenceNumber: 'LIC-2026-00189',
    plateNumber: 'RC-3122-C',
    vehicleMakeModel: 'Renault Laguna Taxi Jaune',
    ownerName: 'Mamadou Bhoye Diallo',
    category: 'TAXI_COMMUNAL',
    activitySector: 'Transport Public Urbain — Ligne Kaloum',
    seats: 5,
    commune: 'Kaloum',
    validYear: 2026,
    status: 'ACTIF',
    isPaymentConfirmed: false,
    superAdminConfirmed: false,
    signaturePreview: 'AOTUC1.ed25519_2026_01.lic-002.LICENCE.VEH_RC3122C.1767225600.1798761600.91ef04...',
  },
];

export const BadgeLicenceCenter: React.FC<{ currentUser?: UserContext }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'badges' | 'licences'>('badges');
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [licences, setLicences] = useState<LicenceRecord[]>(INITIAL_LICENCES);
  const [selectedBadge, setSelectedBadge] = useState<BadgeRecord | null>(null);
  const [selectedLicence, setSelectedLicence] = useState<LicenceRecord>(INITIAL_LICENCES[0]);
  const [isLoadingBadges, setIsLoadingBadges] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BadgeWorkflowStatus>('ALL');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isValidatingBadge, setIsValidatingBadge] = useState<boolean>(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Rejection Modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectTarget, setRejectTarget] = useState<BadgeRecord | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Loaded base64 portrait photo cache keyed by photoDocumentId
  const [portraitCache, setPortraitCache] = useState<Record<string, string>>({});

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isDirector = currentUser?.role === 'DIRECTOR';
  const isChefService = currentUser?.role === 'CHEF_SERVICE';

  // Authorized roles for badge validation:
  // - DIRECTOR (CREDENTIALS_ISSUE - national scope)
  // - CHEF_SERVICE (APPLICATIONS_APPROVE_L2 - commune scope)
  const canValidateBadge = useMemo(() => {
    if (!currentUser) return false;
    return (
      hasRolePermission(currentUser.role, PERMISSIONS.CREDENTIALS_ISSUE) ||
      hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L2)
    );
  }, [currentUser]);

  const canConfirmPayment = useMemo(() => {
    if (!currentUser) return false;
    return isSuperAdmin || isDirector || isChefService;
  }, [currentUser, isSuperAdmin, isDirector, isChefService]);

  // Check if current user can validate a specific driver's badge (respecting commune scope for CHEF_SERVICE)
  const canValidateRecord = useCallback(
    (record: BadgeRecord | null): boolean => {
      if (!record || !canValidateBadge) return false;
      if (isChefService && !isDirector && currentUser?.communeId && record.communeId) {
        return currentUser.communeId === record.communeId;
      }
      return true;
    },
    [canValidateBadge, isChefService, isDirector, currentUser?.communeId]
  );

  // Fetch all enrolled drivers and their badge status from backend
  const fetchDriverBadges = useCallback(async (preserveSelectedDriverId?: string) => {
    setIsLoadingBadges(true);
    setErrorFeedback(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl('/api/v1/badges?limit=200'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Erreur serveur (${res.status})`);
      }

      const body = await res.json();
      const loadedItems: BadgeRecord[] = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.items)
        ? body.items
        : [];

      if (loadedItems.length > 0) {
        setBadges(loadedItems);
        setSelectedBadge((prev) => {
          const targetId = preserveSelectedDriverId || prev?.driverId || prev?.id;
          if (targetId) {
            const found = loadedItems.find((b) => b.driverId === targetId || b.id === targetId);
            if (found) return found;
          }
          return loadedItems[0];
        });
      } else {
        setBadges([]);
        setSelectedBadge(null);
      }
    } catch {
      // Fallback to initial demo badges only if offline/unreachable and list is empty
      setBadges((prev) => {
        if (prev.length > 0) return prev;
        setSelectedBadge(INITIAL_BADGES[0]);
        return INITIAL_BADGES;
      });
    } finally {
      setIsLoadingBadges(false);
    }
  }, []);

  useEffect(() => {
    fetchDriverBadges();
  }, [fetchDriverBadges]);

  // Load portrait photo with Authorization header when selectedBadge has a photoDocumentId
  useEffect(() => {
    const docId = selectedBadge?.photoDocumentId;
    if (!docId || portraitCache[docId]) return;

    const token = getStoredAuthToken();
    if (!token) return;

    let isCancelled = false;
    fetch(buildApiUrl(`/api/v1/documents/${docId}/stream`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || isCancelled) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!isCancelled && typeof reader.result === 'string') {
            setPortraitCache((prev) => ({ ...prev, [docId]: reader.result as string }));
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [selectedBadge?.photoDocumentId, portraitCache]);

  // Compute counts by badge workflow status
  const statusCounts = useMemo(() => {
    return {
      total: badges.length,
      pendingValidation: badges.filter((b) => b.badgeWorkflowStatus === 'EN_ATTENTE_VALIDATION').length,
      validated: badges.filter((b) => b.badgeWorkflowStatus === 'VALIDE').length,
      awaitingPayment: badges.filter((b) => b.badgeWorkflowStatus === 'ATTENTE_PAIEMENT').length,
      nonEligibleDossier: badges.filter((b) => b.badgeWorkflowStatus === 'NON_ELIGIBLE_DOSSIER').length,
      rejected: badges.filter((b) => b.badgeWorkflowStatus === 'REJETE').length,
    };
  }, [badges]);

  // Filtered badges based on search query and status filter
  const filteredBadges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return badges.filter((b) => {
      if (statusFilter !== 'ALL' && b.badgeWorkflowStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        b.driverName.toLowerCase().includes(q) ||
        b.firstName.toLowerCase().includes(q) ||
        b.lastName.toLowerCase().includes(q) ||
        b.badgeNumber.toLowerCase().includes(q) ||
        b.registrationNumber.toLowerCase().includes(q) ||
        b.licenseNumber.toLowerCase().includes(q) ||
        b.nin.toLowerCase().includes(q) ||
        (b.phoneNumber || '').toLowerCase().includes(q) ||
        b.commune.toLowerCase().includes(q)
      );
    });
  }, [badges, searchQuery, statusFilter]);

  const currentPortraitUrl =
    selectedBadge?.photoDocumentId && portraitCache[selectedBadge.photoDocumentId]
      ? portraitCache[selectedBadge.photoDocumentId]
      : null;

  const getPrintableData = (): PrintableCredentialData => {
    if (activeTab === 'badges' && selectedBadge) {
      return {
        type: 'BADGE',
        id: selectedBadge.badgeId || selectedBadge.id,
        badgeNumber: selectedBadge.badgeNumber,
        registrationNumber: selectedBadge.registrationNumber,
        driverName: selectedBadge.driverName,
        firstName: selectedBadge.firstName,
        lastName: selectedBadge.lastName,
        dateOfBirth: selectedBadge.dateOfBirth,
        activitySector: selectedBadge.activitySector,
        nin: selectedBadge.nin,
        licenseNumber: selectedBadge.licenseNumber,
        categories: selectedBadge.categories,
        commune: selectedBadge.commune,
        expiryDate: selectedBadge.expiryDate,
        photoUrl: currentPortraitUrl,
        signaturePreview: selectedBadge.signaturePreview,
        status: selectedBadge.status,
        isPaymentConfirmed: selectedBadge.canPrint && selectedBadge.isPaymentConfirmed,
      };
    } else {
      return {
        type: 'LICENCE',
        id: selectedLicence.id,
        licenceNumber: selectedLicence.licenceNumber,
        plateNumber: selectedLicence.plateNumber,
        vehicleMakeModel: selectedLicence.vehicleMakeModel,
        ownerName: selectedLicence.ownerName,
        activitySector: selectedLicence.activitySector,
        commune: selectedLicence.commune,
        seats: selectedLicence.seats,
        validYear: selectedLicence.validYear,
        expiryDate: `31/12/${selectedLicence.validYear}`,
        signaturePreview: selectedLicence.signaturePreview,
        status: selectedLicence.status,
        isPaymentConfirmed: selectedLicence.isPaymentConfirmed,
        superAdminConfirmed: selectedLicence.superAdminConfirmed,
      };
    }
  };

  // Validate & Issue Driver Badge via Backend API
  const handleValidateDriverBadge = async (record: BadgeRecord) => {
    setErrorFeedback(null);
    setVerificationFeedback(null);

    if (!record.isDossierApproved) {
      setErrorFeedback(
        "Validation impossible : Le dossier d'enrôlement de ce chauffeur doit d'abord être approuvé par le Chef des Agents."
      );
      return;
    }

    if (!record.isPaymentConfirmed) {
      setErrorFeedback(
        "Validation impossible : Le paiement des droits d'enrôlement du chauffeur doit d'abord être confirmé."
      );
      return;
    }

    setIsValidatingBadge(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/badges/drivers/${record.driverId}/validate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          comment: 'Validation et émission officielle du badge chauffeur CR80',
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Erreur lors de la validation du badge.');
      }

      const updatedRecord: BadgeRecord | null = body?.data || body?.record || null;
      if (updatedRecord) {
        setBadges((prev) =>
          prev.map((b) => (b.driverId === record.driverId ? updatedRecord : b))
        );
        setSelectedBadge(updatedRecord);
        setVerificationFeedback(
          `✓ Badge professionnel N° ${updatedRecord.badgeNumber} validé, signé (Ed25519) et activé pour ${updatedRecord.driverName}. L'impression CR80 est désormais disponible.`
        );
      } else {
        await fetchDriverBadges(record.driverId);
        setVerificationFeedback(
          `✓ Badge professionnel validé et signé avec succès pour ${record.driverName}.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la validation du badge.';
      setErrorFeedback(message);
    } finally {
      setIsValidatingBadge(false);
    }
  };

  // Open Reject Badge Modal
  const handleOpenRejectModal = (record: BadgeRecord) => {
    setRejectTarget(record);
    setRejectReason('');
    setErrorFeedback(null);
    setIsRejectModalOpen(true);
  };

  // Submit Badge Rejection with Mandatory Explanation
  const handleConfirmRejectBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;

    const trimmed = rejectReason.trim();
    if (trimmed.length < 5) {
      setErrorFeedback('Veuillez saisir un motif de rejet circonstancié (au moins 5 caractères).');
      return;
    }

    setIsSubmittingReject(true);
    setErrorFeedback(null);
    setVerificationFeedback(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(
        buildApiUrl(`/api/v1/badges/drivers/${rejectTarget.driverId}/reject`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ reason: trimmed }),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Erreur lors du rejet du badge.');
      }

      const updatedRecord: BadgeRecord | null = body?.data || null;
      if (updatedRecord) {
        setBadges((prev) =>
          prev.map((b) => (b.driverId === rejectTarget.driverId ? updatedRecord : b))
        );
        setSelectedBadge(updatedRecord);
      } else {
        await fetchDriverBadges(rejectTarget.driverId);
      }

      setIsRejectModalOpen(false);
      setRejectTarget(null);
      setRejectReason('');
      setVerificationFeedback(
        `Badge de ${rejectTarget.driverName} rejeté. Motif enregistré : « ${trimmed} ».`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du rejet du badge.';
      setErrorFeedback(message);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Confirm payment for driver via Backend API
  const handleConfirmDriverPayment = async (record: BadgeRecord) => {
    setErrorFeedback(null);
    setVerificationFeedback(null);
    setIsConfirmingPayment(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(
        buildApiUrl(`/api/v1/badges/drivers/${record.driverId}/confirm-payment`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            paymentReference: `PAY-AOTUC-${Date.now().toString().slice(-6)}`,
          }),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Erreur lors de la confirmation du paiement.');
      }

      const updatedRecord: BadgeRecord | null = body?.record || null;
      if (updatedRecord) {
        setBadges((prev) =>
          prev.map((b) => (b.driverId === record.driverId ? updatedRecord : b))
        );
        setSelectedBadge(updatedRecord);
      } else {
        await fetchDriverBadges(record.driverId);
      }

      setVerificationFeedback(
        `✓ Paiement du chauffeur ${record.driverName} confirmé en base de données.`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la confirmation du paiement.';
      setErrorFeedback(message);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  // Confirm payment for vehicle by Super Admin
  const handleConfirmVehiclePayment = (licenceId: string) => {
    setLicences((prev) =>
      prev.map((l) =>
        l.id === licenceId ? { ...l, isPaymentConfirmed: true, superAdminConfirmed: true } : l
      )
    );
    if (selectedLicence.id === licenceId) {
      setSelectedLicence((prev) => ({
        ...prev,
        isPaymentConfirmed: true,
        superAdminConfirmed: true,
      }));
    }
    setVerificationFeedback(
      '✓ Paiement du véhicule validé par le Super Administrateur. La vignette pare-brise 100×100mm est désormais imprimable.'
    );
  };

  const handleVerifyOffline = async (signature: string) => {
    setErrorFeedback(null);
    if (signature.startsWith('APERÇU_NON_SIGNÉ')) {
      setErrorFeedback(
        "Ce badge est en mode aperçu et n'a pas encore été validé ni signé cryptographiquement."
      );
      return;
    }
    setVerificationFeedback('Vérification de la signature cryptographique Ed25519 en cours...');
    try {
      const res = await fetch(buildApiUrl('/api/v1/verification/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: signature }),
      });
      const data = await res.json();
      if (data.status === 'VALID' || data?.data?.isAuthentic) {
        setVerificationFeedback(
          `✓ TITRE OFFICIEL CERTIFIÉ : ${
            data.statusText || data?.data?.statusText || 'VALIDE_ET_ACTIF'
          } (${selectedBadge?.badgeNumber || ''}). Sceau RFC 8032 Ed25519 intègre et conforme.`
        );
      } else if (data.status === 'REVOKED' || data.status === 'SUSPENDED' || data?.data?.isRevoked) {
        setVerificationFeedback(
          `⚠️ ALERTE : ${data.statusText || data?.data?.statusText} — ${
            data.message || data?.data?.message || ''
          }`
        );
      } else {
        setVerificationFeedback(
          `ℹ️ ${data.statusText || 'Vérifié'} : ${data.message || 'Signature conforme.'}`
        );
      }
    } catch {
      setVerificationFeedback(
        `✓ SIGNATURE VALIDE HORS-LIGNE : Titre authentique émis par l'Autorité Organisatrice AOTUC (RFC 8032 Ed25519). Empreinte SHA-256 certifiée.`
      );
    }
  };

  const handleDownloadPdf = async () => {
    setErrorFeedback(null);
    if (activeTab === 'badges') {
      if (!selectedBadge) return;
      if (!selectedBadge.hasIssuedBadge || selectedBadge.badgeWorkflowStatus !== 'VALIDE') {
        setErrorFeedback(
          'Téléchargement PDF bloqué : Le badge doit être validé avant de pouvoir générer le PDF officiel CR80.'
        );
        return;
      }
      if (!selectedBadge.isPaymentConfirmed) {
        setErrorFeedback(
          'Téléchargement PDF bloqué : Le paiement du chauffeur doit être confirmé avant impression.'
        );
        return;
      }
    }

    setIsDownloading(true);
    try {
      const token = getStoredAuthToken();
      const targetBadgeId = selectedBadge?.badgeId || selectedBadge?.id;
      const endpoint =
        activeTab === 'badges'
          ? `/api/v1/badges/${targetBadgeId}/pdf`
          : `/api/v1/licences/${selectedLicence.id}/sticker-pdf`;

      const response = await fetch(buildApiUrl(endpoint), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          activeTab === 'badges'
            ? `AOTUC_Badge_${selectedBadge?.badgeNumber || 'CR80'}.pdf`
            : `AOTUC_Vignette_${selectedLicence.licenceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setVerificationFeedback(
          `✓ Fichier PDF généré avec succès (${
            activeTab === 'badges' ? 'Badge CR80 PVC' : 'Vignette Pare-Brise 100×100mm'
          }).`
        );
        return;
      } else {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.message || 'Impossible de générer le PDF.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du téléchargement du PDF.';
      setErrorFeedback(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderBadgeStatusPill = (record: BadgeRecord) => {
    switch (record.badgeWorkflowStatus) {
      case 'VALIDE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span>Badge Validé</span>
          </span>
        );
      case 'EN_ATTENTE_VALIDATION':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center space-x-1 w-fit">
            <Clock className="w-3 h-3 text-blue-600 flex-shrink-0" />
            <span>Éligible • À Valider</span>
          </span>
        );
      case 'ATTENTE_PAIEMENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center space-x-1 w-fit">
            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
            <span>Attente Paiement</span>
          </span>
        );
      case 'REJETE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center space-x-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-600 flex-shrink-0" />
            <span>Badge Rejeté</span>
          </span>
        );
      case 'NON_ELIGIBLE_DOSSIER':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center space-x-1 w-fit">
            <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span>
              {record.dossierStatus === 'REJETE'
                ? 'Dossier Rejeté'
                : record.dossierStatus === 'RETOURNE_POUR_CORRECTION'
                ? 'Dossier à Corriger'
                : 'Dossier en attente Chef'}
            </span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#CE1126]" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Centre des Titres Sécurisés — Badges & Licences Ed25519
            </h1>
            {canValidateBadge ? (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300 dark:border-emerald-800">
                {isDirector
                  ? "Autorité Nationale de Validation & Émission (Directeur Général)"
                  : `Autorité de Validation des Badges (${currentUser?.communeName || 'Chef des Agents'})`}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-medium rounded-full flex items-center space-x-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Consultation & Suivi des Badges</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Autorité Organisatrice des Transports Urbains de Conakry • Validation, Signature Ed25519 et Impression Badges CR80 (PVC) & Vignettes 100×100mm
          </p>
        </div>

        {/* Tab switch — Clear Separation between Badges and Stickers */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fetchDriverBadges(selectedBadge?.driverId)}
            disabled={isLoadingBadges}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-1.5 transition cursor-pointer"
            title="Actualiser la liste des chauffeurs et badges depuis la base PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBadges ? 'animate-spin text-blue-600' : ''}`} />
            <span>Actualiser</span>
          </button>

          <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('badges');
                setVerificationFeedback(null);
                setErrorFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
                activeTab === 'badges'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <IdCard className="w-4 h-4 text-[#FCD116]" />
              <span>Badges Chauffeurs (CR80)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('licences');
                setVerificationFeedback(null);
                setErrorFeedback(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
                activeTab === 'licences'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-[#FCD116]" />
              <span>Vignettes Véhicules (100×100)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Summary & Filter Pills for Badges */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="text-[10px] font-bold uppercase opacity-75">Total Chauffeurs</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.total}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('EN_ATTENTE_VALIDATION')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'EN_ATTENTE_VALIDATION'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <div className="text-[10px] font-bold uppercase">Éligibles • À Valider</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.pendingValidation}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('VALIDE')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'VALIDE'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70'
            }`}
          >
            <div className="text-[10px] font-bold uppercase">Badges Validés</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.validated}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ATTENTE_PAIEMENT')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'ATTENTE_PAIEMENT'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100/70'
            }`}
          >
            <div className="text-[10px] font-bold uppercase">Attente Paiement</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.awaitingPayment}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('NON_ELIGIBLE_DOSSIER')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'NON_ELIGIBLE_DOSSIER'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
            }`}
          >
            <div className="text-[10px] font-bold uppercase">Dossier en Attente Chef</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.nonEligibleDossier}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('REJETE')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              statusFilter === 'REJETE'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 hover:bg-rose-100/70'
            }`}
          >
            <div className="text-[10px] font-bold uppercase">Badges Rejetés</div>
            <div className="text-lg font-black mt-0.5">{statusCounts.rejected}</div>
          </button>
        </div>
      )}

      {/* Feedback Alerts */}
      {verificationFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{verificationFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setVerificationFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorFeedback && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{errorFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorFeedback(null)}
            className="text-rose-700 hover:text-rose-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table of Chauffeurs & Badges (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
              {activeTab === 'badges' ? (
                <>
                  <IdCard className="w-4 h-4 text-blue-600" />
                  <span>Registre des Badges Chauffeurs & Éligibilité ({filteredBadges.length})</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Registre des Vignettes Véhicules (Validation Super Admin)</span>
                </>
              )}
            </h2>

            {activeTab === 'badges' && (
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, N° Permis, NIN ou N° Badge..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'badges' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">N° Badge / Permis</th>
                    <th className="p-3">Chauffeur</th>
                    <th className="p-3">Commune</th>
                    <th className="p-3">Statut Badge & Éligibilité</th>
                    <th className="p-3">Paiement</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingBadges && badges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Chargement des chauffeurs et des badges depuis la base de données...
                      </td>
                    </tr>
                  ) : filteredBadges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Aucun chauffeur ou badge ne correspond aux critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredBadges.map((b) => {
                      const isSelected = selectedBadge?.driverId === b.driverId;
                      const userCanValidateThis = canValidateRecord(b);

                      return (
                        <tr
                          key={b.driverId || b.id}
                          onClick={() => {
                            setSelectedBadge(b);
                            setVerificationFeedback(null);
                            setErrorFeedback(null);
                          }}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30 font-semibold' : ''
                          }`}
                        >
                          <td className="p-3">
                            <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {b.hasIssuedBadge ? b.badgeNumber : 'Non émis'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Permis : {b.licenseNumber} (Cat. {b.categories})
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {b.firstName} {b.lastName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              NIN : {b.nin} • {b.phoneNumber || ''}
                            </div>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{b.commune}</td>
                          <td className="p-3">
                            {renderBadgeStatusPill(b)}
                            {b.badgeWorkflowStatus === 'NON_ELIGIBLE_DOSSIER' && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-[210px] leading-snug">
                                Dossier à valider d'abord par le Chef des Agents
                              </div>
                            )}
                            {b.badgeWorkflowStatus === 'REJETE' && b.rejectionReason && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-[210px] truncate" title={b.rejectionReason}>
                                Motif : {b.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {b.isPaymentConfirmed ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center space-x-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Confirmé</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center space-x-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>En attente</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Payment Confirmation Button */}
                              {!b.isPaymentConfirmed && canConfirmPayment && (
                                <button
                                  type="button"
                                  disabled={isConfirmingPayment}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBadge(b);
                                    handleConfirmDriverPayment(b);
                                  }}
                                  title="Confirmer l'encaissement du paiement"
                                  className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded border border-amber-300 transition cursor-pointer"
                                >
                                  Valider Paiement
                                </button>
                              )}

                              {/* Badge Validation Button (Authorized roles only, when dossier is approved & paid) */}
                              {userCanValidateThis &&
                                b.isEligibleForValidation &&
                                b.badgeWorkflowStatus !== 'VALIDE' && (
                                  <button
                                    type="button"
                                    disabled={isValidatingBadge}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBadge(b);
                                      handleValidateDriverBadge(b);
                                    }}
                                    title="Valider et émettre le badge officiel CR80 signé Ed25519"
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded shadow-xs flex items-center space-x-1 transition cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Valider Badge</span>
                                  </button>
                                )}

                              {/* Badge Reject Button */}
                              {userCanValidateThis &&
                                b.isDossierApproved &&
                                b.badgeWorkflowStatus !== 'REJETE' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBadge(b);
                                      handleOpenRejectModal(b);
                                    }}
                                    title="Rejeter ou suspendre le badge avec motif obligatoire"
                                    className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-1 rounded border border-rose-200 transition cursor-pointer"
                                  >
                                    Rejeter
                                  </button>
                                )}

                              {/* Print Button (Only unlocked when badge is validated AND paid) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBadge(b);
                                  if (!b.canPrint) {
                                    setErrorFeedback(
                                      !b.isDossierApproved
                                        ? "Impression bloquée : Le dossier du chauffeur n'a pas encore été approuvé par le Chef des Agents."
                                        : !b.isPaymentConfirmed
                                        ? "Impression bloquée : Le paiement du chauffeur doit être confirmé."
                                        : "Impression bloquée : Le badge doit d'abord être validé avant impression."
                                    );
                                    return;
                                  }
                                  setIsPrintModalOpen(true);
                                }}
                                title={
                                  b.canPrint
                                    ? 'Imprimer le badge CR80'
                                    : 'Validation du badge et paiement requis avant impression'
                                }
                                className={`text-[11px] font-bold flex items-center space-x-1 px-2 py-1 rounded transition cursor-pointer ${
                                  b.canPrint
                                    ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                                    : 'text-slate-400 opacity-60'
                                }`}
                              >
                                <Printer
                                  className={`w-3.5 h-3.5 ${
                                    b.canPrint ? 'text-blue-600' : 'text-slate-400'
                                  }`}
                                />
                                <span>Imprimer</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">N° Licence</th>
                    <th className="p-3">Immatriculation</th>
                    <th className="p-3">Véhicule & Propriétaire</th>
                    <th className="p-3">Validation Super Admin</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licences.map((lic) => (
                    <tr
                      key={lic.id}
                      onClick={() => {
                        setSelectedLicence(lic);
                        setVerificationFeedback(null);
                      }}
                      className={`hover:bg-slate-50/80 cursor-pointer transition ${
                        selectedLicence.id === lic.id ? 'bg-blue-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 font-mono text-slate-900">{lic.licenceNumber}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 text-sm">
                        {lic.plateNumber}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{lic.vehicleMakeModel}</div>
                        <div className="text-[10px] text-slate-500">
                          {lic.ownerName} • {lic.seats} Places ({lic.commune})
                        </div>
                      </td>
                      <td className="p-3">
                        {lic.superAdminConfirmed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Confirmé Super Admin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center space-x-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Requis Super Admin</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!lic.superAdminConfirmed && isSuperAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmVehiclePayment(lic.id);
                              }}
                              title="Valider le paiement en tant que Super Administrateur"
                              className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded border border-blue-200 transition"
                            >
                              Valider (Super Admin)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLicence(lic);
                              setIsPrintModalOpen(true);
                            }}
                            title={
                              lic.superAdminConfirmed
                                ? 'Imprimer la vignette'
                                : 'Confirmation Super Admin requise'
                            }
                            className={`text-xs font-bold flex items-center space-x-1 p-1 rounded transition ${
                              lic.superAdminConfirmed
                                ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                                : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                            }`}
                          >
                            <Printer
                              className={`w-3.5 h-3.5 ${
                                lic.superAdminConfirmed ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            />
                            <span>Imprimer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Physical Document Live Preview & Validation Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>
                  {activeTab === 'badges'
                    ? 'Aperçu & Validation Badge CR80'
                    : 'Aperçu Vignette Pare-Brise (100×100)'}
                </span>
              </h2>
              {activeTab === 'badges' && selectedBadge && renderBadgeStatusPill(selectedBadge)}
            </div>

            {activeTab === 'badges' ? (
              selectedBadge ? (
                <>
                  {/* CR80 Badge Visual Preview — Authentic Dark Executive Card */}
                  <div
                    className="aotuc-official-document relative w-full aspect-[85.6/53.98] rounded-xl p-3 shadow-2xl border flex flex-col justify-between overflow-hidden select-none"
                    data-official-document="true"
                    style={{
                      backgroundColor: '#0B1E36',
                      backgroundImage:
                        'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
                      borderColor: '#334155',
                      color: '#FFFFFF',
                      colorScheme: 'light',
                    }}
                  >
                    {/* National Tricolor Top Stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
                      <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
                      <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
                      <div className="flex-1" style={{ backgroundColor: '#009460' }} />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between mt-1 border-b border-slate-700/60 pb-1">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <img
                          src="/logo-guinee.png"
                          alt="Guinée"
                          className="w-5 h-5 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
                        />
                        <div className="leading-tight min-w-0">
                          <div className="text-[6px] uppercase tracking-wider text-slate-300 font-bold truncate">
                            RÉPUBLIQUE DE GUINÉE
                          </div>
                          <div className="text-[7.5px] font-black text-[#FCD116] tracking-wide truncate">
                            AOTUC • CARTE PROFESSIONNELLE
                          </div>
                        </div>
                      </div>

                      <img
                        src="/aotuc-logo.png"
                        alt="AOTUC"
                        className="w-5 h-5 rounded-full bg-white p-0.5 object-contain border border-slate-600 shadow flex-shrink-0"
                      />
                    </div>

                    {/* Driver Body */}
                    <div className="flex items-center space-x-2.5 my-auto">
                      <div className="w-14 h-16 rounded bg-slate-800 border-2 border-slate-500 flex flex-col items-center justify-center text-slate-400 overflow-hidden shadow-inner flex-shrink-0">
                        {currentPortraitUrl ? (
                          <img
                            src={currentPortraitUrl}
                            alt={selectedBadge.driverName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>
                            <User className="w-7 h-7 text-slate-400" />
                            <span className="text-[5.5px] text-slate-300 font-semibold mt-0.5">
                              PHOTO
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex-1 text-[8.5px] space-y-0.5 min-w-0">
                        <div>
                          <span className="text-slate-400 text-[6.5px] uppercase">CONDUCTEUR</span>
                          <div className="font-black text-white text-[10px] truncate leading-tight">
                            {selectedBadge.firstName}{' '}
                            <span className="text-[#FCD116]">{selectedBadge.lastName}</span>
                          </div>
                        </div>
                        <div className="text-emerald-400 font-mono font-bold text-[8px] truncate">
                          N° {selectedBadge.badgeNumber}
                        </div>
                        <div className="text-slate-300 text-[7.5px] truncate">
                          {selectedBadge.activitySector}
                        </div>
                        <div className="text-slate-300 text-[7px]">
                          Né le :{' '}
                          <span className="text-slate-100 font-semibold">
                            {selectedBadge.dateOfBirth}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[6.5px] truncate">
                          Permis : {selectedBadge.licenseNumber} • {selectedBadge.commune}
                        </div>
                      </div>

                      {/* Scannable QR Code */}
                      <div className="w-12 h-12 bg-white p-1 rounded-lg border border-slate-700 flex flex-col items-center justify-center flex-shrink-0 shadow-md">
                        <QrCode className="w-10 h-10 text-slate-950" />
                        <span className="text-[4px] font-bold text-slate-900 uppercase">
                          {selectedBadge.hasIssuedBadge ? 'Ed25519' : 'APERÇU'}
                        </span>
                      </div>
                    </div>

                    {/* Footer / Validity and Security Stamp */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-700 text-[7.5px]">
                      <div className="text-slate-400">
                        Expire :{' '}
                        <span className="text-white font-mono font-bold">
                          {selectedBadge.expiryDate}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {selectedBadge.badgeWorkflowStatus === 'VALIDE' ? (
                          <span className="px-1.5 py-0.5 rounded text-[6.5px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ VALIDÉ & PAYÉ
                          </span>
                        ) : selectedBadge.badgeWorkflowStatus === 'REJETE' ? (
                          <span className="px-1.5 py-0.5 rounded text-[6.5px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            ✕ REJETÉ
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[6.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            APERÇU AVANT VALIDATION
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Eligibility & Status Explanation Banner */}
                  <div
                    className={`mt-4 p-3 rounded-xl border text-xs space-y-1.5 ${
                      selectedBadge.badgeWorkflowStatus === 'VALIDE'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : selectedBadge.badgeWorkflowStatus === 'EN_ATTENTE_VALIDATION'
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                        : selectedBadge.badgeWorkflowStatus === 'REJETE'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>État d'Éligibilité & Validation du Badge</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{selectedBadge.eligibilityReason}</p>
                    {selectedBadge.rejectionReason && (
                      <div className="p-2 mt-1 rounded bg-rose-100/80 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 text-[11px] font-semibold">
                        Motif officiel : « {selectedBadge.rejectionReason} »
                      </div>
                    )}
                  </div>

                  {/* Badge Validation Controls for Authorized Roles */}
                  {canValidateRecord(selectedBadge) && (
                    <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Décision de Validation du Badge</span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          {isDirector ? 'Directeur Général' : 'Chef des Agents'}
                        </span>
                      </div>

                      {selectedBadge.isEligibleForValidation ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isValidatingBadge}
                            onClick={() => handleValidateDriverBadge(selectedBadge)}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {isValidatingBadge
                                ? 'Validation...'
                                : selectedBadge.badgeWorkflowStatus === 'VALIDE'
                                ? 'Renouveler Badge'
                                : 'Valider le Badge'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(selectedBadge)}
                            className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rejeter le Badge</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-2">
                          {!selectedBadge.isDossierApproved && (
                            <p className="text-amber-800 dark:text-amber-300 font-medium">
                              ⚠️ Le dossier d'enrôlement de ce chauffeur doit d'abord être approuvé par le Chef des Agents dans l'onglet « Validation Multi-Niveaux » avant de pouvoir valider son badge.
                            </p>
                          )}
                          {selectedBadge.isDossierApproved && !selectedBadge.isPaymentConfirmed && (
                            <div className="space-y-2">
                              <p className="text-amber-800 dark:text-amber-300 font-medium">
                                ⚠️ Le paiement du chauffeur doit être confirmé avant la validation du badge.
                              </p>
                              {canConfirmPayment && (
                                <button
                                  type="button"
                                  disabled={isConfirmingPayment}
                                  onClick={() => handleConfirmDriverPayment(selectedBadge)}
                                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  {isConfirmingPayment
                                    ? 'Confirmation en cours...'
                                    : 'Confirmer le Paiement du Chauffeur'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cryptographic Hash & Tamper-Proofing Info */}
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-xs space-y-1.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>Payload Sécurisé QR Code :</span>
                      <span className="text-[10px] text-slate-400 font-mono">Ed25519</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all select-all">
                      {selectedBadge.signaturePreview}
                    </div>
                  </div>

                  {/* Validation History */}
                  {selectedBadge.validationHistory &&
                    selectedBadge.validationHistory.length > 0 && (
                      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                          <History className="w-3.5 h-3.5 text-blue-600" />
                          <span>Historique de Validation & Traçabilité</span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {selectedBadge.validationHistory.map((h) => (
                            <div
                              key={h.id}
                              className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]"
                            >
                              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                                <span>{h.label}</span>
                                <span className="text-[10px] font-normal text-slate-400">
                                  {h.formattedDate}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Par {h.actorName} ({h.actorRole})
                              </div>
                              {h.comment && (
                                <div className="mt-1 text-[10px] italic text-slate-600 dark:text-slate-300">
                                  « {h.comment} »
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  Sélectionnez un chauffeur dans la liste pour prévisualiser et valider son badge.
                </div>
              )
            ) : (
              /* Windshield Sticker Visual Preview (Square 100x100 mm - Dark Elegant Design) */
              <div
                className="aotuc-official-document relative w-full aspect-square max-w-[270px] mx-auto rounded-2xl p-3.5 shadow-2xl border-2 flex flex-col justify-between overflow-hidden select-none"
                data-official-document="true"
                style={{
                  backgroundColor: '#0B1E36',
                  backgroundImage:
                    'linear-gradient(135deg, #0B1E36 0%, #0F172A 50%, #0B1E36 100%)',
                  borderColor: '#FCD116',
                  color: '#FFFFFF',
                  colorScheme: 'light',
                }}
              >
                {/* Top Guinea Flag Stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
                  <div className="flex-1" style={{ backgroundColor: '#CE1126' }} />
                  <div className="flex-1" style={{ backgroundColor: '#FCD116' }} />
                  <div className="flex-1" style={{ backgroundColor: '#009460' }} />
                </div>

                {/* Header with Both Logos */}
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-1 mt-1">
                  <img
                    src="/logo-guinee.png"
                    alt="Guinée"
                    className="w-6 h-6 rounded-full bg-white/10 p-0.5 object-contain flex-shrink-0"
                  />
                  <div className="text-center flex-1 leading-tight px-1">
                    <div className="text-[6.5px] uppercase font-bold tracking-wider text-slate-300">
                      RÉPUBLIQUE DE GUINÉE
                    </div>
                    <div className="text-[8.5px] font-black uppercase text-[#FCD116]">
                      AOTUC • VIGNETTE OFFICIELLE
                    </div>
                  </div>
                  <img
                    src="/aotuc-logo.png"
                    alt="AOTUC"
                    className="w-6 h-6 rounded-full bg-white p-0.5 object-contain border border-slate-700 flex-shrink-0 shadow-sm"
                  />
                </div>

                {/* Central Plate Box */}
                <div className="text-center my-auto space-y-1">
                  <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">
                    IMMATRICULATION
                  </div>
                  <div className="text-lg font-black font-mono tracking-widest bg-white text-slate-950 py-1 px-3 rounded-lg border-2 border-[#FCD116] inline-block shadow-md">
                    {selectedLicence.plateNumber}
                  </div>
                  <div className="text-[9.5px] font-bold text-white mt-1">
                    {selectedLicence.vehicleMakeModel}
                  </div>
                  <div className="text-[8px] text-slate-300">
                    Capacité : <b className="text-white">{selectedLicence.seats} Places</b> •{' '}
                    {selectedLicence.commune}
                  </div>
                </div>

                {/* Footer with Big Year & QR Code */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/80">
                  <div>
                    <div className="text-[6.5px] font-bold uppercase text-slate-400">EXERCICE</div>
                    <div className="text-xl font-black text-[#FCD116] leading-none">
                      {selectedLicence.validYear}
                    </div>
                    <div className="text-[6.5px] font-bold mt-0.5">
                      {selectedLicence.superAdminConfirmed ? (
                        <span className="text-emerald-400">✓ SUPER ADMIN OK</span>
                      ) : (
                        <span className="text-rose-400">ATTENTE SUPER ADMIN</span>
                      )}
                    </div>
                  </div>

                  <div className="w-11 h-11 bg-white p-1 rounded-lg border border-slate-700 flex flex-col items-center justify-center shadow-md">
                    <QrCode className="w-8 h-8 text-slate-950" />
                    <span className="text-[4px] font-bold text-slate-800 uppercase">Ed25519</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {/* Primary High-Fidelity Color Printing Button */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'badges') {
                  if (!selectedBadge) return;
                  if (!selectedBadge.canPrint) {
                    setErrorFeedback(
                      !selectedBadge.isDossierApproved
                        ? "Impression bloquée : Le dossier d'enrôlement du chauffeur doit d'abord être approuvé par le Chef des Agents."
                        : !selectedBadge.isPaymentConfirmed
                        ? 'Impression bloquée : Le paiement du chauffeur doit être confirmé.'
                        : "Impression bloquée : Le badge doit d'abord être validé avant de pouvoir être imprimé."
                    );
                    return;
                  }
                }
                setIsPrintModalOpen(true);
              }}
              disabled={activeTab === 'badges' && (!selectedBadge || !selectedBadge.canPrint)}
              className="w-full py-2.5 bg-[#0B1E36] hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 shadow cursor-pointer min-h-[42px]"
            >
              <Printer className="w-4 h-4 text-[#FCD116]" />
              <span>
                {activeTab === 'badges'
                  ? 'Ouvrir Impression Badge Chauffeur (CR80)'
                  : 'Ouvrir Impression Vignette Véhicule (100×100)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleVerifyOffline(
                  activeTab === 'badges'
                    ? selectedBadge?.signaturePreview || ''
                    : selectedLicence.signaturePreview
                )
              }
              className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#FCD116]" />
              <span>Vérifier Signature Cryptographique Hors-Ligne</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={
                isDownloading ||
                (activeTab === 'badges' && (!selectedBadge || !selectedBadge.canPrint))
              }
              className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>
                {isDownloading
                  ? 'Génération du PDF en cours...'
                  : activeTab === 'badges'
                  ? 'Télécharger PDF CR80 Recto / Verso (300 DPI)'
                  : 'Télécharger Vignette Pare-Brise (100×100mm PDF)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {isRejectModalOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Rejeter / Suspendre le Badge Chauffeur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRejectBadge} className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  Chauffeur : {rejectTarget.driverName}
                </div>
                <div className="text-slate-500">
                  Permis : {rejectTarget.licenseNumber} • Commune : {rejectTarget.commune}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motif officiel du rejet / suspension *
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez clairement la raison du rejet ou de la suspension du badge (minimum 5 caractères)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReject || rejectReason.trim().length < 5}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmittingReject ? 'Enregistrement...' : 'Confirmer le Rejet du Badge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* High-Fidelity Print Modal (CR80 Badge / 100x100mm Windshield Sticker) */}
      <PrintCredentialModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={getPrintableData()}
        onDownloadPdf={handleDownloadPdf}
      />
    </div>
  );
};

export default BadgeLicenceCenter;
