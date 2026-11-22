import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  Car,
  Shield,
  X,
  Camera,
  Upload,
  Trash2,
  FileText,
  FileCheck,
  ExternalLink,
  CreditCard,
  Briefcase,
} from 'lucide-react';
import { UserContext, TransportUnionRecord, UnionStatus } from '../../types';
import { hasRolePermission, PERMISSIONS } from '../../utils/permissions';
import { buildApiUrl, parseApiResponse, getStoredAuthToken } from '../../utils/api';
import { CONAKRY_COMMUNES } from '../../config/communes';

interface UnionManagementViewProps {
  currentUser: UserContext;
}

const OFFICIAL_FONCTIONS = [
  'Président',
  'Vice-président',
  'Secrétaire général',
  'Trésorier',
  'Responsable',
  'Membre',
  'Autre',
] as const;

type CameraTarget = 'portrait' | 'cni_recto' | 'cni_verso';

export const UnionManagementView: React.FC<UnionManagementViewProps> = ({ currentUser }) => {
  const [unions, setUnions] = useState<TransportUnionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [communeFilter, setCommuneFilter] = useState<string>('ALL');

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [selectedUnion, setSelectedUnion] = useState<TransportUnionRecord | null>(null);
  const [detailedUnion, setDetailedUnion] = useState<TransportUnionRecord | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState<boolean>(false);
  const [previewDocumentModal, setPreviewDocumentModal] = useState<{ url: string; title: string } | null>(null);

  // Form core state
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formRegNumber, setFormRegNumber] = useState<string>('');
  const [formPresident, setFormPresident] = useState<string>('');
  const [formFonction, setFormFonction] = useState<string>('Président');
  const [formCustomFonction, setFormCustomFonction] = useState<string>('');
  const [formCniNumber, setFormCniNumber] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formCommuneId, setFormCommuneId] = useState<string>('');
  const [formLogoUrl, setFormLogoUrl] = useState<string>('');
  const [formStatus, setFormStatus] = useState<UnionStatus>('ACTIF');
  const [statusReason, setStatusReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<string | null>(null);

  // Form Document & Identity state (Photo Portrait, CNI Recto, CNI Verso)
  const [formPhotoBase64, setFormPhotoBase64] = useState<string | null>(null);
  const [formPhotoName, setFormPhotoName] = useState<string>('photo_portrait.jpg');
  const [formPhotoMime, setFormPhotoMime] = useState<string>('image/jpeg');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState<boolean>(false);

  const [formCniRectoBase64, setFormCniRectoBase64] = useState<string | null>(null);
  const [formCniRectoName, setFormCniRectoName] = useState<string>('cni_recto.jpg');
  const [formCniRectoMime, setFormCniRectoMime] = useState<string>('image/jpeg');
  const [formCniRectoUrl, setFormCniRectoUrl] = useState<string | null>(null);
  const [removeCniRecto, setRemoveCniRecto] = useState<boolean>(false);

  const [formCniVersoBase64, setFormCniVersoBase64] = useState<string | null>(null);
  const [formCniVersoName, setFormCniVersoName] = useState<string>('cni_verso.jpg');
  const [formCniVersoMime, setFormCniVersoMime] = useState<string>('image/jpeg');
  const [formCniVersoUrl, setFormCniVersoUrl] = useState<string | null>(null);
  const [removeCniVerso, setRemoveCniVerso] = useState<boolean>(false);

  // Camera capture modal state
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Hidden input refs
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraPhotoRef = useRef<HTMLInputElement | null>(null);
  const cniRectoFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraCniRectoRef = useRef<HTMLInputElement | null>(null);
  const cniVersoFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraCniVersoRef = useRef<HTMLInputElement | null>(null);

  // Active sub-tab in details drawer: 'info' | 'docs' | 'drivers' | 'owners'
  const [detailsTab, setDetailsTab] = useState<'info' | 'docs' | 'drivers' | 'owners'>('info');

  const canManageUnions = hasRolePermission(currentUser.role, PERMISSIONS.UNIONS_MANAGE);

  // Fetch list of unions from backend
  const fetchUnions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const token = getStoredAuthToken();
      if (!token) {
        throw new Error('Jeton d’accès manquant. Veuillez vous reconnecter.');
      }

      const res = await fetch(buildApiUrl('/api/v1/unions?limit=100'), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Échec du chargement des syndicats (HTTP ${res.status}).`);
      }

      setUnions(body.data?.items || body.items || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de contacter le serveur.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnions();
  }, [fetchUnions]);

  // Fetch detailed union with member drivers, owners, and documents
  const fetchUnionDetails = async (id: string) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/unions/${id}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const body = await parseApiResponse<any>(res);
      if (res.ok && body?.success && body.data) {
        setDetailedUnion(body.data);
      }
    } catch (_) {}
  };

  const handleOpenDetails = async (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setDetailedUnion(union);
    setDetailsTab('info');
    setIsDetailsDrawerOpen(true);
    await fetchUnionDetails(union.id);
  };

  const resetFormState = () => {
    setFormName('');
    setFormCode('');
    setFormRegNumber('');
    setFormPresident('');
    setFormFonction('Président');
    setFormCustomFonction('');
    setFormCniNumber('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCommuneId('');
    setFormLogoUrl('');
    setFormStatus('ACTIF');
    setFormErrors(null);

    setFormPhotoBase64(null);
    setFormPhotoName('photo_portrait.jpg');
    setFormPhotoMime('image/jpeg');
    setFormPhotoUrl(null);
    setRemovePhoto(false);

    setFormCniRectoBase64(null);
    setFormCniRectoName('cni_recto.jpg');
    setFormCniRectoMime('image/jpeg');
    setFormCniRectoUrl(null);
    setRemoveCniRecto(false);

    setFormCniVersoBase64(null);
    setFormCniVersoName('cni_verso.jpg');
    setFormCniVersoMime('image/jpeg');
    setFormCniVersoUrl(null);
    setRemoveCniVerso(false);
  };

  const handleOpenRegister = () => {
    resetFormState();
    setIsRegisterModalOpen(true);
  };

  const handleOpenEdit = (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setFormName(union.name || '');
    setFormCode(union.code || '');
    setFormRegNumber(union.registrationNumber || '');
    setFormPresident(union.presidentName || '');

    const existingFonction = union.fonction || 'Président';
    if (OFFICIAL_FONCTIONS.includes(existingFonction as any) && existingFonction !== 'Autre') {
      setFormFonction(existingFonction);
      setFormCustomFonction('');
    } else {
      setFormFonction('Autre');
      setFormCustomFonction(existingFonction);
    }

    setFormCniNumber(union.cniNumber || '');
    setFormPhone(union.contactPhone || '');
    setFormEmail(union.contactEmail || '');
    setFormAddress(union.headquartersAddress || '');
    setFormCommuneId(union.communeId || '');
    setFormLogoUrl(union.logoUrl || '');
    setFormStatus(union.status || 'ACTIF');
    setFormErrors(null);

    // Existing documents
    const portraitDoc = union.documents?.find((d) => d.category === 'PHOTO_PORTRAIT');
    setFormPhotoUrl(union.photoUrl || (portraitDoc ? `/api/v1/documents/${portraitDoc.id}/stream` : null));
    setFormPhotoBase64(null);
    setRemovePhoto(false);

    const cniRectoDoc = union.documents?.find((d) => d.category === 'CNI_RECTO');
    setFormCniRectoUrl(cniRectoDoc ? `/api/v1/documents/${cniRectoDoc.id}/stream` : null);
    setFormCniRectoBase64(null);
    setRemoveCniRecto(false);

    const cniVersoDoc = union.documents?.find((d) => d.category === 'CNI_VERSO');
    setFormCniVersoUrl(cniVersoDoc ? `/api/v1/documents/${cniVersoDoc.id}/stream` : null);
    setFormCniVersoBase64(null);
    setRemoveCniVerso(false);

    setIsEditModalOpen(true);
  };

  const handleOpenStatusModal = (union: TransportUnionRecord) => {
    setSelectedUnion(union);
    setFormStatus(union.status);
    setStatusReason('');
    setFormErrors(null);
    setIsStatusModalOpen(true);
  };

  // --- CAMERA HANDLING ---
  const handleStartCamera = async (target: CameraTarget, facing: 'user' | 'environment' = 'user') => {
    setCameraError(null);
    setCameraTarget(target);
    setCameraFacingMode(facing);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (target === 'portrait' && mobileCameraPhotoRef.current) {
        mobileCameraPhotoRef.current.click();
        return;
      }
      if (target === 'cni_recto' && mobileCameraCniRectoRef.current) {
        mobileCameraCniRectoRef.current.click();
        return;
      }
      if (target === 'cni_verso' && mobileCameraCniVersoRef.current) {
        mobileCameraCniVersoRef.current.click();
        return;
      }
      setCameraError("La capture caméra directe n'est pas disponible. Utilisez l'option fichier.");
      return;
    }

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError("Impossible d'accéder à la caméra : " + (err.message || 'Permission refusée.'));
    }
  };

  const handleStopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraTarget(null);
  };

  const handleCapturePhotoFromCamera = () => {
    if (!videoRef.current || !cameraTarget) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    if (cameraTarget === 'portrait') {
      setFormPhotoBase64(dataUrl);
      setFormPhotoName(`photo_portrait_${Date.now()}.jpg`);
      setFormPhotoMime('image/jpeg');
      setRemovePhoto(false);
    } else if (cameraTarget === 'cni_recto') {
      setFormCniRectoBase64(dataUrl);
      setFormCniRectoName(`cni_recto_${Date.now()}.jpg`);
      setFormCniRectoMime('image/jpeg');
      setRemoveCniRecto(false);
    } else if (cameraTarget === 'cni_verso') {
      setFormCniVersoBase64(dataUrl);
      setFormCniVersoName(`cni_verso_${Date.now()}.jpg`);
      setFormCniVersoMime('image/jpeg');
      setRemoveCniVerso(false);
    }

    handleStopCamera();
  };

  // Generic File Upload reader
  const handleGenericFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: CameraTarget
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormErrors('Le fichier sélectionné dépasse la taille limite autorisée de 5 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (target === 'portrait') {
          setFormPhotoBase64(reader.result);
          setFormPhotoName(file.name);
          setFormPhotoMime(file.type || 'image/jpeg');
          setRemovePhoto(false);
        } else if (target === 'cni_recto') {
          setFormCniRectoBase64(reader.result);
          setFormCniRectoName(file.name);
          setFormCniRectoMime(file.type || 'image/jpeg');
          setRemoveCniRecto(false);
        } else if (target === 'cni_verso') {
          setFormCniVersoBase64(reader.result);
          setFormCniVersoName(file.name);
          setFormCniVersoMime(file.type || 'image/jpeg');
          setRemoveCniVerso(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Build inline documents array
  const buildInlineDocuments = () => {
    const docs: Array<{
      category: 'PHOTO_PORTRAIT' | 'CNI_RECTO' | 'CNI_VERSO';
      originalName: string;
      mimeType: string;
      base64Data: string;
    }> = [];

    if (formPhotoBase64) {
      docs.push({
        category: 'PHOTO_PORTRAIT',
        originalName: formPhotoName || 'photo_portrait.jpg',
        mimeType: formPhotoMime || 'image/jpeg',
        base64Data: formPhotoBase64,
      });
    }

    if (formCniRectoBase64) {
      docs.push({
        category: 'CNI_RECTO',
        originalName: formCniRectoName || 'cni_recto.jpg',
        mimeType: formCniRectoMime || 'image/jpeg',
        base64Data: formCniRectoBase64,
      });
    }

    if (formCniVersoBase64) {
      docs.push({
        category: 'CNI_VERSO',
        originalName: formCniVersoName || 'cni_verso.jpg',
        mimeType: formCniVersoMime || 'image/jpeg',
        base64Data: formCniVersoBase64,
      });
    }

    return docs;
  };

  // --- SUBMIT REGISTRATION ---
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      setFormErrors('Le nom officiel et le sigle du syndicat sont obligatoires.');
      return;
    }

    const effectiveFonction =
      formFonction === 'Autre'
        ? formCustomFonction.trim() || 'Autre'
        : formFonction;

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const inlineDocs = buildInlineDocuments();

      const payload: any = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        registrationNumber: formRegNumber.trim() || null,
        presidentName: formPresident.trim() || null,
        fonction: effectiveFonction,
        cniNumber: formCniNumber.trim() || null,
        contactPhone: formPhone.trim() || null,
        contactEmail: formEmail.trim() || null,
        headquartersAddress: formAddress.trim() || null,
        communeId: formCommuneId || null,
        logoUrl: formLogoUrl.trim() || null,
        status: formStatus,
        documents: inlineDocs.length > 0 ? inlineDocs : undefined,
      };

      const res = await fetch(buildApiUrl('/api/v1/unions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de l'enregistrement (HTTP ${res.status}).`);
      }

      setSuccessMessage(
        `Le syndicat « ${body.data.code} — ${body.data.name} » a été enregistré avec succès avec sa gouvernance et ses pièces d'identité.`
      );
      setIsRegisterModalOpen(false);
      resetFormState();
      await fetchUnions();
    } catch (err: any) {
      setFormErrors(err.message || "Échec de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT EDIT ---
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnion) return;

    const effectiveFonction =
      formFonction === 'Autre'
        ? formCustomFonction.trim() || 'Autre'
        : formFonction;

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const inlineDocs = buildInlineDocuments();
      const removeDocCategories: string[] = [];
      if (removeCniRecto) removeDocCategories.push('CNI_RECTO');
      if (removeCniVerso) removeDocCategories.push('CNI_VERSO');

      const payload: any = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        registrationNumber: formRegNumber.trim() || null,
        presidentName: formPresident.trim() || null,
        fonction: effectiveFonction,
        cniNumber: formCniNumber.trim() || null,
        contactPhone: formPhone.trim() || null,
        contactEmail: formEmail.trim() || null,
        headquartersAddress: formAddress.trim() || null,
        communeId: formCommuneId || null,
        logoUrl: formLogoUrl.trim() || null,
        status: formStatus,
        removePhoto: removePhoto || undefined,
        removeDocuments: removeDocCategories.length > 0 ? removeDocCategories : undefined,
        documents: inlineDocs.length > 0 ? inlineDocs : undefined,
      };

      const res = await fetch(buildApiUrl(`/api/v1/unions/${selectedUnion.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de la mise à jour (HTTP ${res.status}).`);
      }

      setSuccessMessage(`Syndicat « ${body.data.code} » actualisé avec succès.`);
      setIsEditModalOpen(false);
      await fetchUnions();
      if (detailedUnion && detailedUnion.id === selectedUnion.id) {
        await fetchUnionDetails(selectedUnion.id);
      }
    } catch (err: any) {
      setFormErrors(err.message || 'Échec de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUBMIT STATUS CHANGE ---
  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnion) return;

    setIsSubmitting(true);
    setFormErrors(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/unions/${selectedUnion.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: formStatus,
          reason: statusReason.trim() || undefined,
        }),
      });

      const body = await parseApiResponse<any>(res);
      if (!res.ok || !body?.success) {
        throw new Error(body?.message || `Erreur lors de la mise à jour du statut (HTTP ${res.status}).`);
      }

      setSuccessMessage(`Statut du syndicat actualisé à « ${formStatus} » avec traçabilité d'audit.`);
      setIsStatusModalOpen(false);
      await fetchUnions();
      if (detailedUnion && detailedUnion.id === selectedUnion.id) {
        await fetchUnionDetails(selectedUnion.id);
      }
    } catch (err: any) {
      setFormErrors(err.message || 'Échec de la mise à jour du statut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter unions
  const filteredUnions = useMemo(() => {
    return unions.filter((u) => {
      const matchesSearch =
        !searchTerm.trim() ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.registrationNumber && u.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.presidentName && u.presidentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.fonction && u.fonction.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.cniNumber && u.cniNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const matchesCommune =
        communeFilter === 'ALL' ||
        u.commune?.name === communeFilter ||
        u.communeId === communeFilter;

      return matchesSearch && matchesStatus && matchesCommune;
    });
  }, [unions, searchTerm, statusFilter, communeFilter]);

  // Status badge renderer
  const renderStatusBadge = (status: UnionStatus) => {
    switch (status) {
      case 'ACTIF':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            ACTIF
          </span>
        );
      case 'SUSPENDU':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
            SUSPENDU
          </span>
        );
      case 'EN_ATTENTE_VALIDATION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <Clock className="w-3 h-3 mr-1 text-blue-600" />
            EN ATTENTE
          </span>
        );
      case 'REJETE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            REJETÉ
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  // Helper for secure document stream URLs
  const getDocumentStreamUrl = (docId: string) => {
    return buildApiUrl(`/api/v1/documents/${docId}/stream`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <Building2 className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Gestion des Syndicats & Organisations Professionnelles
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Répertoire officiel des syndicats de transport urbain de Conakry (FNTG, USTG, CNTG, etc.), 
            gouvernance des représentants, gestion des pièces d'identité (Photo & CNI), et affiliation des chauffeurs et propriétaires.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchUnions}
            disabled={isLoading}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {canManageUnions && (
            <button
              onClick={handleOpenRegister}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer un Syndicat</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par sigle, nom, agrément, représentant, fonction ou CNI..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white focus:outline-hidden"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIF">Actif</option>
            <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
            <option value="SUSPENDU">Suspendu</option>
            <option value="REJETE">Rejeté</option>
          </select>

          <select
            value={communeFilter}
            onChange={(e) => setCommuneFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white focus:outline-hidden"
          >
            <option value="ALL">Toutes les communes</option>
            {CONAKRY_COMMUNES.map((comm) => (
              <option key={comm} value={comm}>{comm}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Syndicats Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Sigle & Organisation</th>
                <th className="py-3 px-4">Agrément Officiel</th>
                <th className="py-3 px-4">Représentant & Fonction</th>
                <th className="py-3 px-4">Commune & Siège</th>
                <th className="py-3 px-4 text-center">Affiliés</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Chargement des syndicats depuis PostgreSQL...</span>
                  </td>
                </tr>
              ) : filteredUnions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">Aucun syndicat trouvé</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {unions.length === 0
                        ? "Aucune organisation professionnelle enregistrée pour l'instant."
                        : "Aucun résultat ne correspond aux filtres de recherche."}
                    </p>
                    {canManageUnions && unions.length === 0 && (
                      <button
                        onClick={handleOpenRegister}
                        className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enregistrer le premier syndicat</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUnions.map((u) => {
                  const portraitDoc = u.documents?.find((d) => d.category === 'PHOTO_PORTRAIT');
                  const photoSrc = u.photoUrl || (portraitDoc ? getDocumentStreamUrl(portraitDoc.id) : null);

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {u.logoUrl ? (
                            <img
                              src={u.logoUrl}
                              alt={u.code}
                              className="w-8 h-8 rounded-md object-contain bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
                              {u.code.substring(0, 3)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">{u.code}</span>
                              <span>•</span>
                              <span>{u.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Enregistré le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.registrationNumber ? (
                          <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block">
                            {u.registrationNumber}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Non renseigné</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          {photoSrc ? (
                            <img
                              src={photoSrc}
                              alt={u.presidentName || 'Représentant'}
                              className="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-200 dark:border-slate-700 flex-shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                              {u.presidentName || 'Non renseigné'}
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                                {u.fonction || 'Président'}
                              </span>
                              {u.cniNumber && (
                                <span className="text-[10px] text-slate-400 font-mono" title={`CNI : ${u.cniNumber}`}>
                                  • {u.cniNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{u.commune?.name || 'Toutes communes'}</span>
                          </div>
                          {u.headquartersAddress && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                              {u.headquartersAddress}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center space-x-2 text-[11px]">
                          <span className="flex items-center space-x-0.5 text-slate-600 dark:text-slate-400" title="Chauffeurs membres">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span className="font-bold">{u._count?.members || 0}</span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center space-x-0.5 text-slate-600 dark:text-slate-400" title="Propriétaires">
                            <Car className="w-3 h-3 text-slate-400" />
                            <span className="font-bold">{u._count?.owners || 0}</span>
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {renderStatusBadge(u.status)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenDetails(u)}
                            title="Consulter la fiche détaillée, gouvernance et pièces"
                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canManageUnions && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(u)}
                                title="Modifier les informations et pièces d'identité"
                                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleOpenStatusModal(u)}
                                title="Changer le statut (Activer / Suspendre / Rejeter)"
                                className="p-1.5 text-slate-500 hover:text-amber-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REGISTER MODAL (WITH IDENTITY PHOTO & CNI FRONT/BACK)                  */}
      {/* ========================================================================= */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Enregistrer un Nouveau Syndicat / Organisation
                </h2>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRegister} className="p-5 overflow-y-auto space-y-4">
              {formErrors && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              {/* Section 1: Organisation */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
                  1. Identification de l'Organisation
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nom officiel du syndicat *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="ex: Fédération Nationale des Transports de Guinée"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sigle / Acronyme *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      placeholder="ex: FNTG"
                      className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      N° d'Agrément / Récépissé Officiel
                    </label>
                    <input
                      type="text"
                      value={formRegNumber}
                      onChange={(e) => setFormRegNumber(e.target.value)}
                      placeholder="ex: AGR-2026-MATD-0044"
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Commune de Rattachement (Optionnel)
                    </label>
                    <select
                      value={formCommuneId}
                      onChange={(e) => setFormCommuneId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <option value="">National / Toutes les communes</option>
                      {CONAKRY_COMMUNES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Gouvernance & Identité du Responsable */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b pb-1 flex items-center justify-between">
                  <span>2. Gouvernance & Représentant Légal</span>
                  <span className="text-[10px] text-emerald-600 font-semibold lowercase">3 nouveaux champs requis</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nom & Prénom du Responsable
                    </label>
                    <input
                      type="text"
                      value={formPresident}
                      onChange={(e) => setFormPresident(e.target.value)}
                      placeholder="ex: Elhadj Mamadou Diallo"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* FIELD A: FONCTION */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Fonction au sein du syndicat *</span>
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    </label>
                    <select
                      value={formFonction}
                      onChange={(e) => setFormFonction(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                    >
                      {OFFICIAL_FONCTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If "Autre" is selected, show free text input */}
                {formFonction === 'Autre' && (
                  <div className="space-y-1 p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                      Précisez la fonction officielle du représentant
                    </label>
                    <input
                      type="text"
                      required
                      value={formCustomFonction}
                      onChange={(e) => setFormCustomFonction(e.target.value)}
                      placeholder="ex: Délégué syndical communal, Secrétaire aux conflits..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Téléphone du Responsable
                    </label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+224 6XX XX XX XX"
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      N° Carte Nationale d'Identité (CNI / Passeport)
                    </label>
                    <input
                      type="text"
                      value={formCniNumber}
                      onChange={(e) => setFormCniNumber(e.target.value)}
                      placeholder="ex: CNI-2026-GN-88421"
                      className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* FIELD B: PHOTO D'IDENTITÉ (PORTRAIT) */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Photo d'Identité du Représentant (Portrait Officiel)
                      </span>
                    </div>
                    {formPhotoBase64 && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Prête pour enregistrement</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {formPhotoBase64 ? (
                        <img src={formPhotoBase64} alt="Portrait" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleStartCamera('portrait', 'user')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1 shadow-xs transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Prendre Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => photoFileInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-medium flex items-center space-x-1 transition"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Téléverser Image</span>
                        </button>

                        {formPhotoBase64 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormPhotoBase64(null);
                              setRemovePhoto(true);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Supprimer la photo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Portrait net du visage de face (JPEG/PNG max 5 Mo). Distinct des justificatifs CNI.
                      </p>
                    </div>
                  </div>
                </div>

                {/* FIELD C: CARTE D'IDENTITÉ NATIONALE (CNI RECTO & VERSO) */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Carte Nationale d'Identité (CNI) — Document Officiel
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Recto & Verso
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* CNI RECTO */}
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>CNI Face Recto</span>
                        {formCniRectoBase64 && <FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>

                      <div className="h-24 w-full rounded border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden">
                        {formCniRectoBase64 ? (
                          <img src={formCniRectoBase64} alt="CNI Recto" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-slate-400">
                            <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-40" />
                            <span className="text-[10px]">Aucun document joint</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleStartCamera('cni_recto', 'environment')}
                          className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center justify-center space-x-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Caméra</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cniRectoFileInputRef.current?.click()}
                          className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center justify-center space-x-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Fichier</span>
                        </button>
                        {formCniRectoBase64 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormCniRectoBase64(null);
                              setRemoveCniRecto(true);
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Supprimer Recto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CNI VERSO */}
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>CNI Face Verso</span>
                        {formCniVersoBase64 && <FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>

                      <div className="h-24 w-full rounded border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden">
                        {formCniVersoBase64 ? (
                          <img src={formCniVersoBase64} alt="CNI Verso" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center text-slate-400">
                            <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-40" />
                            <span className="text-[10px]">Aucun document joint</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleStartCamera('cni_verso', 'environment')}
                          className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center justify-center space-x-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Caméra</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cniVersoFileInputRef.current?.click()}
                          className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center justify-center space-x-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Fichier</span>
                        </button>
                        {formCniVersoBase64 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormCniVersoBase64(null);
                              setRemoveCniVerso(true);
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Supprimer Verso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Coordonnées & Siège */}
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b pb-1">
                  3. Coordonnées & Statut Administratif
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email Officiel
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="contact@syndicat.gn"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Statut Initial
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as UnionStatus)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <option value="ACTIF">ACTIF (Habilité immédiatement)</option>
                      <option value="EN_ATTENTE_VALIDATION">EN_ATTENTE_VALIDATION (Vérification pièces)</option>
                      <option value="SUSPENDU">SUSPENDU (Temporairement inactif)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Adresse du Siège Social / Quartier
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="ex: Immeuble Syndical, Madina Marché, Matam, Conakry"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Enregistrement dans PostgreSQL...' : 'Enregistrer le Syndicat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT MODAL (WITH IDENTITY FIELDS & DOCUMENTS)                          */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Modifier le Syndicat : {selectedUnion.code}
                </h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-5 overflow-y-auto space-y-4">
              {formErrors && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nom officiel de l'organisation *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sigle / Acronyme *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    N° d'Agrément / Récépissé
                  </label>
                  <input
                    type="text"
                    value={formRegNumber}
                    onChange={(e) => setFormRegNumber(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nom du Représentant Légal
                  </label>
                  <input
                    type="text"
                    value={formPresident}
                    onChange={(e) => setFormPresident(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* FIELD A: FONCTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Fonction au sein du syndicat *</span>
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  </label>
                  <select
                    value={formFonction}
                    onChange={(e) => setFormFonction(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    {OFFICIAL_FONCTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    N° Carte d'Identité (CNI / Passeport)
                  </label>
                  <input
                    type="text"
                    value={formCniNumber}
                    onChange={(e) => setFormCniNumber(e.target.value)}
                    placeholder="ex: CNI-2026-GN-88421"
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {formFonction === 'Autre' && (
                <div className="space-y-1 p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <label className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Précisez la fonction officielle
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomFonction}
                    onChange={(e) => setFormCustomFonction(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs"
                  />
                </div>
              )}

              {/* FIELD B: PHOTO D'IDENTITÉ IN EDIT MODAL */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Photo d'Identité (Portrait)
                </span>
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-lg border bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {formPhotoBase64 ? (
                      <img src={formPhotoBase64} alt="Nouveau portrait" className="w-full h-full object-cover" />
                    ) : formPhotoUrl && !removePhoto ? (
                      <img src={formPhotoUrl} alt="Portrait actuel" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleStartCamera('portrait', 'user')}
                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs flex items-center space-x-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Changer Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => photoFileInputRef.current?.click()}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs flex items-center space-x-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Fichier</span>
                    </button>
                    {(formPhotoBase64 || (formPhotoUrl && !removePhoto)) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormPhotoBase64(null);
                          setRemovePhoto(true);
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* FIELD C: CNI DOCUMENTS IN EDIT MODAL */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Pièce d'Identité CNI (Recto & Verso)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-semibold block">CNI Recto</span>
                    <div className="h-16 rounded border bg-slate-50 flex items-center justify-center overflow-hidden">
                      {formCniRectoBase64 ? (
                        <img src={formCniRectoBase64} alt="CNI Recto" className="w-full h-full object-cover" />
                      ) : formCniRectoUrl && !removeCniRecto ? (
                        <img src={formCniRectoUrl} alt="CNI Recto" className="w-full h-full object-cover" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartCamera('cni_recto', 'environment')}
                        className="flex-1 py-0.5 bg-slate-100 text-[10px] rounded text-slate-700"
                      >
                        Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => cniRectoFileInputRef.current?.click()}
                        className="flex-1 py-0.5 bg-slate-100 text-[10px] rounded text-slate-700"
                      >
                        Fichier
                      </button>
                      {(formCniRectoBase64 || (formCniRectoUrl && !removeCniRecto)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormCniRectoBase64(null);
                            setRemoveCniRecto(true);
                          }}
                          className="px-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-semibold block">CNI Verso</span>
                    <div className="h-16 rounded border bg-slate-50 flex items-center justify-center overflow-hidden">
                      {formCniVersoBase64 ? (
                        <img src={formCniVersoBase64} alt="CNI Verso" className="w-full h-full object-cover" />
                      ) : formCniVersoUrl && !removeCniVerso ? (
                        <img src={formCniVersoUrl} alt="CNI Verso" className="w-full h-full object-cover" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartCamera('cni_verso', 'environment')}
                        className="flex-1 py-0.5 bg-slate-100 text-[10px] rounded text-slate-700"
                      >
                        Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => cniVersoFileInputRef.current?.click()}
                        className="flex-1 py-0.5 bg-slate-100 text-[10px] rounded text-slate-700"
                      >
                        Fichier
                      </button>
                      {(formCniVersoBase64 || (formCniVersoUrl && !removeCniVerso)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormCniVersoBase64(null);
                            setRemoveCniVerso(true);
                          }}
                          className="px-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Adresse / Siège Social
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Sauvegarde...' : 'Enregistrer les Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STATUS CHANGE MODAL                                                    */}
      {/* ========================================================================= */}
      {isStatusModalOpen && selectedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Changer le Statut : {selectedUnion.code}
                </h2>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStatusChange} className="p-4 space-y-4">
              {formErrors && (
                <div className="p-2.5 bg-red-50 text-red-800 rounded text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
                <div className="text-slate-500">Organisation : <span className="font-bold text-slate-900 dark:text-white">{selectedUnion.name}</span></div>
                <div className="text-slate-500">Statut actuel : <span className="font-bold">{selectedUnion.status}</span></div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nouveau statut réglementaire *
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as UnionStatus)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="ACTIF">ACTIF — Organisation habilitée et reconnue</option>
                  <option value="SUSPENDU">SUSPENDU — Organisation suspendue provisoirement</option>
                  <option value="EN_ATTENTE_VALIDATION">EN_ATTENTE_VALIDATION — Pièces justificatives en cours d'examen</option>
                  <option value="REJETE">REJETE — Demande de reconnaissance rejetée</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motif de la décision / Référence administrative
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="ex: Arrêté ministériel portant suspension conservatoire suite à non-conformité..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
                >
                  {isSubmitting ? 'Mise à jour...' : 'Appliquer le Statut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DETAILS DRAWER / MODAL (WITH GOVERNANCE & DOCUMENTS SUB-TAB)           */}
      {/* ========================================================================= */}
      {isDetailsDrawerOpen && detailedUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full w-full max-w-xl flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center space-x-3">
                {detailedUnion.logoUrl ? (
                  <img
                    src={detailedUnion.logoUrl}
                    alt={detailedUnion.code}
                    className="w-10 h-10 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    {detailedUnion.code.substring(0, 3)}
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{detailedUnion.code}</span>
                    {renderStatusBadge(detailedUnion.status)}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[280px]">
                    {detailedUnion.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs header */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/30">
              <button
                onClick={() => setDetailsTab('info')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                  detailsTab === 'info'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Gouvernance & Siège
              </button>
              <button
                onClick={() => setDetailsTab('docs')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
                  detailsTab === 'docs'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Pièces & CNI</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-[10px] rounded-full">
                  {detailedUnion.documents?.length || (detailedUnion.photoUrl ? 1 : 0)}
                </span>
              </button>
              <button
                onClick={() => setDetailsTab('drivers')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
                  detailsTab === 'drivers'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Chauffeurs</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-[10px] rounded-full">
                  {detailedUnion.members?.length ?? detailedUnion._count?.members ?? 0}
                </span>
              </button>
              <button
                onClick={() => setDetailsTab('owners')}
                className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
                  detailsTab === 'owners'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Propriétaires</span>
                <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-[10px] rounded-full">
                  {detailedUnion.owners?.length ?? detailedUnion._count?.owners ?? 0}
                </span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {detailsTab === 'info' && (
                <div className="space-y-4 text-xs">
                  {/* Governance Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Représentant Légal & Gouvernance
                    </div>

                    <div className="flex items-center space-x-3.5 pt-1">
                      {detailedUnion.photoUrl ? (
                        <img
                          src={detailedUnion.photoUrl}
                          alt={detailedUnion.presidentName || 'Représentant'}
                          className="w-14 h-14 rounded-full object-cover border-2 border-emerald-600 flex-shrink-0 cursor-pointer shadow-sm"
                          onClick={() => setPreviewDocumentModal({ url: detailedUnion.photoUrl!, title: `Portrait : ${detailedUnion.presidentName}` })}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                          {detailedUnion.presidentName?.charAt(0) || 'R'}
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {detailedUnion.presidentName || 'Non renseigné'}
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                            {detailedUnion.fonction || 'Président'}
                          </span>
                          {detailedUnion.cniNumber && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              • CNI : {detailedUnion.cniNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60 pt-2 text-[11px]">
                      <div className="py-1.5 flex items-center justify-between">
                        <span className="text-slate-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-400" />
                          Téléphone direct :
                        </span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {detailedUnion.contactPhone || 'Non renseigné'}
                        </span>
                      </div>
                      <div className="py-1.5 flex items-center justify-between">
                        <span className="text-slate-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1 text-slate-400" />
                          Email officiel :
                        </span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {detailedUnion.contactEmail || 'Non renseigné'}
                        </span>
                      </div>
                      <div className="py-1.5 flex items-center justify-between">
                        <span className="text-slate-500">Siège social :</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {detailedUnion.headquartersAddress || 'Non renseigné'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Agrément & Enregistrement */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Agrément & Enregistrement</div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-500">N° d'Agrément :</span>
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {detailedUnion.registrationNumber || 'Non renseigné'}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Date d'enregistrement :</span>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {new Date(detailedUnion.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Synthesis Stats */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Synthèse des Affiliations</div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {detailedUnion.members?.length ?? detailedUnion._count?.members ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Chauffeurs Enrôlés</div>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                          {detailedUnion.owners?.length ?? detailedUnion._count?.owners ?? 0}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">Propriétaires Rattachés</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENTS SUB-TAB: PHOTO D'IDENTITÉ & CNI PIÈCES */}
              {detailsTab === 'docs' && (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pièces d'identité et documents officiels enregistrés sous {detailedUnion.code} :
                  </div>

                  {/* Portrait Document Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>Photo d'Identité Officielle (Portrait)</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        {detailedUnion.fonction || 'Représentant'}
                      </span>
                    </div>

                    {detailedUnion.photoUrl ? (
                      <div className="flex items-center space-x-4 pt-1">
                        <img
                          src={detailedUnion.photoUrl}
                          alt="Portrait officiel"
                          className="w-20 h-20 rounded-lg object-cover border border-slate-300 dark:border-slate-600 cursor-pointer shadow-xs"
                          onClick={() => setPreviewDocumentModal({ url: detailedUnion.photoUrl!, title: `Portrait Officiel — ${detailedUnion.presidentName}` })}
                        />
                        <div className="space-y-1 text-xs">
                          <div className="font-bold text-slate-900 dark:text-white">{detailedUnion.presidentName}</div>
                          <div className="text-slate-500 text-[11px]">Portrait d'identification du responsable syndical.</div>
                          <button
                            type="button"
                            onClick={() => setPreviewDocumentModal({ url: detailedUnion.photoUrl!, title: `Portrait Officiel — ${detailedUnion.presidentName}` })}
                            className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-semibold text-xs pt-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Agrandir l'image</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-slate-400 bg-white dark:bg-slate-800 rounded border border-dashed">
                        Aucune photo d'identité enregistrée
                      </div>
                    )}
                  </div>

                  {/* CNI Documents Grid */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        <span>Pièce d'Identité Nationale (CNI)</span>
                      </div>
                      {detailedUnion.cniNumber && (
                        <span className="font-mono text-[11px] text-slate-500">
                          N° {detailedUnion.cniNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* CNI Recto */}
                      {(() => {
                        const rectoDoc = detailedUnion.documents?.find((d) => d.category === 'CNI_RECTO');
                        const rectoUrl = rectoDoc ? getDocumentStreamUrl(rectoDoc.id) : null;

                        return (
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span>CNI Face Recto</span>
                              {rectoDoc && <span className="text-[10px] text-emerald-600 font-bold">Sécurisé</span>}
                            </div>

                            <div className="h-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                              {rectoUrl ? (
                                <img
                                  src={rectoUrl}
                                  alt="CNI Recto"
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition"
                                  onClick={() => setPreviewDocumentModal({ url: rectoUrl, title: `CNI Recto — ${detailedUnion.presidentName}` })}
                                />
                              ) : (
                                <div className="text-center text-slate-400">
                                  <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-40" />
                                  <span className="text-[10px]">Non renseigné</span>
                                </div>
                              )}
                            </div>

                            {rectoUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentModal({ url: rectoUrl, title: `CNI Recto — ${detailedUnion.presidentName}` })}
                                className="w-full py-1 text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded transition"
                              >
                                Visualiser le Recto
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* CNI Verso */}
                      {(() => {
                        const versoDoc = detailedUnion.documents?.find((d) => d.category === 'CNI_VERSO');
                        const versoUrl = versoDoc ? getDocumentStreamUrl(versoDoc.id) : null;

                        return (
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span>CNI Face Verso</span>
                              {versoDoc && <span className="text-[10px] text-emerald-600 font-bold">Sécurisé</span>}
                            </div>

                            <div className="h-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                              {versoUrl ? (
                                <img
                                  src={versoUrl}
                                  alt="CNI Verso"
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition"
                                  onClick={() => setPreviewDocumentModal({ url: versoUrl, title: `CNI Verso — ${detailedUnion.presidentName}` })}
                                />
                              ) : (
                                <div className="text-center text-slate-400">
                                  <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-40" />
                                  <span className="text-[10px]">Non renseigné</span>
                                </div>
                              )}
                            </div>

                            {versoUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocumentModal({ url: versoUrl, title: `CNI Verso — ${detailedUnion.presidentName}` })}
                                className="w-full py-1 text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 rounded transition"
                              >
                                Visualiser le Verso
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* DRIVERS SUB-TAB */}
              {detailsTab === 'drivers' && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Conducteurs enregistrés sous l'égide de {detailedUnion.code} :
                  </div>
                  {!detailedUnion.members || detailedUnion.members.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                      <Users className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Aucun conducteur affilié à ce syndicat pour le moment.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {detailedUnion.members.map((driver) => (
                        <div key={driver.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-800/60">
                          <div className="flex items-center space-x-3">
                            {driver.person?.photoUrl ? (
                              <img
                                src={driver.person.photoUrl}
                                alt={driver.person.firstName}
                                className="w-8 h-8 rounded-full object-cover border border-slate-300 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {driver.person?.firstName?.charAt(0) || 'C'}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                {driver.person?.firstName} {driver.person?.lastName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                Permis : {driver.drivingLicenseNumber} • NIN : {driver.person?.nin}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {driver.person?.phoneNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OWNERS SUB-TAB */}
              {detailsTab === 'owners' && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Propriétaires rattachés à {detailedUnion.code} :
                  </div>
                  {!detailedUnion.owners || detailedUnion.owners.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                      <Car className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Aucun propriétaire affilié à ce syndicat pour le moment.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {detailedUnion.owners.map((owner) => (
                        <div key={owner.id} className="p-3 flex items-center justify-between bg-white dark:bg-slate-800/60">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-xs">
                              {owner.businessName || `${owner.person?.firstName} ${owner.person?.lastName}`}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Type : {owner.ownerType} • NIN : {owner.person?.nin}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500 font-mono">
                            {owner.person?.phoneNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LIVE WEBCAM / CAMERA MODAL                                             */}
      {/* ========================================================================= */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl flex flex-col">
            <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white font-bold text-xs">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>
                  {cameraTarget === 'portrait'
                    ? "Capture Photo d'Identité (Portrait)"
                    : cameraTarget === 'cni_recto'
                    ? "Capture CNI — Face Recto"
                    : "Capture CNI — Face Verso"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStopCamera}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 text-center text-xs text-rose-400">
                  {cameraError}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  handleStartCamera(
                    cameraTarget || 'portrait',
                    cameraFacingMode === 'user' ? 'environment' : 'user'
                  )
                }
                className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700"
              >
                Changer Caméra
              </button>

              <button
                type="button"
                onClick={handleCapturePhotoFromCamera}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md"
              >
                <Camera className="w-4 h-4" />
                <span>Prendre la Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ENLARGED DOCUMENT VIEWER MODAL                                         */}
      {/* ========================================================================= */}
      {previewDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white text-xs font-bold">
              <span>{previewDocumentModal.title}</span>
              <button
                type="button"
                onClick={() => setPreviewDocumentModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewDocumentModal.url}
                alt={previewDocumentModal.title}
                className="max-h-[70vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN FILE INPUTS */}
      <input
        ref={photoFileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'portrait')}
      />
      <input
        ref={mobileCameraPhotoRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'portrait')}
      />

      <input
        ref={cniRectoFileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'cni_recto')}
      />
      <input
        ref={mobileCameraCniRectoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'cni_recto')}
      />

      <input
        ref={cniVersoFileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'cni_verso')}
      />
      <input
        ref={mobileCameraCniVersoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleGenericFileUpload(e, 'cni_verso')}
      />
    </div>
  );
};

export default UnionManagementView;
