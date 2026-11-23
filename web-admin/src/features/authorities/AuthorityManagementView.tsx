import React, { useState, useEffect, useId, useRef } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  Phone,
  Mail,
  Building,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  Camera,
  Upload,
  RefreshCw,
  X,
  FileText,
  BadgeCheck,
  Building2,
  User,
} from 'lucide-react';
import { UserContext } from '../../types';
import { OFFICIAL_COMMUNES } from '../../config/communes';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';

export type AuthorityStatus = 'ACTIF' | 'EN_ATTENTE_VALIDATION' | 'SUSPENDU' | 'INACTIF';

export interface AuthorityDocument {
  id: string;
  category: 'PHOTO_PORTRAIT' | 'CNI_RECTO' | 'CNI_VERSO' | 'AUTRE';
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface AuthorityRecord {
  id: string;
  fullName: string;
  fonction: string;
  institution: string;
  service?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  cniNumber?: string | null;
  badgeNumber?: string | null;
  photoUrl?: string | null;
  status: AuthorityStatus;
  notes?: string | null;
  communeId?: string | null;
  commune?: { id: string; name: string; code: string } | null;
  registeredByUserId?: string | null;
  registeredByUser?: { id: string; firstName: string; lastName: string; email?: string } | null;
  documents?: AuthorityDocument[];
  createdAt: string;
  updatedAt?: string;
}

interface AuthorityManagementViewProps {
  currentUser: UserContext;
  initialOpenRegister?: boolean;
}

const COMMON_FUNCTIONS = [
  'Commissaire Central',
  'Commissaire Adjoint',
  'Commandant de Compagnie Routière',
  'Commandant de Brigade',
  'Chef de Peloton Routier',
  'Maire de la Commune',
  'Secrétaire Général de Commune',
  'Directeur National des Transports Terrestres',
  'Directeur Régional des Transports',
  'Gouverneur de la Ville de Conakry',
  'Préfet / Haut Fonctionnaire',
  'Juge d’Instruction / Magistrat',
  'Officier de Police Judiciaire (OPJ)',
  'Autre fonction officielle',
];

const COMMON_INSTITUTIONS = [
  'Police Nationale de Guinée — Sécurité Routière',
  'Gendarmerie Nationale — Escadron Routier',
  'Ministère des Transports — Direction Nationale',
  'Mairie Communale de Conakry',
  'Gouvernorat de la Ville de Conakry',
  'Garde Communale Urbaine',
  'Direction Générale des Douanes',
  'Cour & Parquet de Grande Instance',
  'Autre service public',
];

export const AuthorityManagementView: React.FC<AuthorityManagementViewProps> = ({
  currentUser,
  initialOpenRegister = false,
}) => {
  const canManage = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DIRECTOR';
  const [authorities, setAuthorities] = useState<AuthorityRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCommune, setSelectedCommune] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState<string>('ALL');

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(initialOpenRegister);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedAuthority, setSelectedAuthority] = useState<AuthorityRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    fonction: '',
    customFonction: '',
    institution: '',
    customInstitution: '',
    service: '',
    phoneNumber: '',
    email: '',
    cniNumber: '',
    badgeNumber: '',
    communeName: '',
    status: 'ACTIF' as AuthorityStatus,
    notes: '',
  });

  // Photo & CNI upload states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cniRectoPreview, setCniRectoPreview] = useState<string | null>(null);
  const [cniVersoPreview, setCniVersoPreview] = useState<string | null>(null);

  // Camera capture modal state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<'PHOTO' | 'CNI_RECTO' | 'CNI_VERSO' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const photoInputId = useId();
  const cniRectoInputId = useId();
  const cniVersoInputId = useId();

  // Fetch Authorities from Backend
  const fetchAuthorities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl('/api/v1/authorities?limit=100'), {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Accès réservé au Super Administrateur et au Directeur Général.');
        }
        throw new Error(`Erreur serveur (${res.status}) lors du chargement des autorités.`);
      }

      const json = await res.json();
      setAuthorities(json.data || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion à l’API';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorities();
  }, []);

  // Flash message helper
  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Reset Form
  const resetForm = () => {
    setFormData({
      fullName: '',
      fonction: '',
      customFonction: '',
      institution: '',
      customInstitution: '',
      service: '',
      phoneNumber: '',
      email: '',
      cniNumber: '',
      badgeNumber: '',
      communeName: '',
      status: 'ACTIF',
      notes: '',
    });
    setPhotoPreview(null);
    setCniRectoPreview(null);
    setCniVersoPreview(null);
    stopCamera();
  };

  // Camera Management
  const startCamera = async (target: 'PHOTO' | 'CNI_RECTO' | 'CNI_VERSO') => {
    setCameraTarget(target);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setError('Impossible d’accéder à la caméra. Veuillez autoriser la capture ou téléverser un fichier.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (cameraTarget === 'PHOTO') setPhotoPreview(dataUrl);
      if (cameraTarget === 'CNI_RECTO') setCniRectoPreview(dataUrl);
      if (cameraTarget === 'CNI_VERSO') setCniVersoPreview(dataUrl);
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraTarget(null);
  };

  // File Upload Handlers
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier dépasse la taille maximale autorisée (5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Build document payload from base64 previews
  const buildDocumentsPayload = () => {
    const docs = [];
    if (photoPreview && photoPreview.startsWith('data:')) {
      docs.push({
        category: 'PHOTO_PORTRAIT',
        originalName: 'photo_identite.jpg',
        mimeType: 'image/jpeg',
        base64Data: photoPreview,
      });
    }
    if (cniRectoPreview && cniRectoPreview.startsWith('data:')) {
      docs.push({
        category: 'CNI_RECTO',
        originalName: 'cni_recto.jpg',
        mimeType: 'image/jpeg',
        base64Data: cniRectoPreview,
      });
    }
    if (cniVersoPreview && cniVersoPreview.startsWith('data:')) {
      docs.push({
        category: 'CNI_VERSO',
        originalName: 'cni_verso.jpg',
        mimeType: 'image/jpeg',
        base64Data: cniVersoPreview,
      });
    }
    return docs;
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const fonctionFinal =
      formData.fonction === 'Autre fonction officielle'
        ? formData.customFonction.trim()
        : formData.fonction.trim();

    const institutionFinal =
      formData.institution === 'Autre service public'
        ? formData.customInstitution.trim()
        : formData.institution.trim();

    if (!formData.fullName.trim() || !fonctionFinal || !institutionFinal) {
      setError('Le nom complet, la fonction et l’institution sont strictement obligatoires.');
      setIsSubmitting(false);
      return;
    }

    // Resolve communeId if communeName selected
    const selectedCommuneConfig = OFFICIAL_COMMUNES.find((c) => c.name === formData.communeName);
    const communeId = selectedCommuneConfig
      ? authorities.find((a) => a.commune?.name === formData.communeName)?.commune?.id || null
      : null;

    const payload: Record<string, unknown> = {
      fullName: formData.fullName.trim(),
      fonction: fonctionFinal,
      institution: institutionFinal,
      service: formData.service.trim() || null,
      phoneNumber: formData.phoneNumber.trim() || null,
      email: formData.email.trim() || null,
      cniNumber: formData.cniNumber.trim() || null,
      badgeNumber: formData.badgeNumber.trim() || null,
      communeId: communeId,
      status: formData.status,
      notes: formData.notes.trim() || null,
      documents: buildDocumentsPayload(),
    };

    if (photoPreview && photoPreview.startsWith('data:')) {
      payload.photoUrl = photoPreview;
    }

    try {
      const token = getStoredAuthToken();
      const isEditing = isEditModalOpen && selectedAuthority;
      const url = isEditing
        ? buildApiUrl(`/api/v1/authorities/${selectedAuthority.id}`)
        : buildApiUrl('/api/v1/authorities');
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Erreur lors de l’enregistrement.');
      }

      showFeedback(
        isEditing
          ? 'Autorité administrative mise à jour avec succès.'
          : 'Autorité administrative enregistrée avec succès dans le registre officiel AOTUC.'
      );

      setIsRegisterModalOpen(false);
      setIsEditModalOpen(false);
      resetForm();
      fetchAuthorities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal with prefilled data
  const handleOpenEdit = (auth: AuthorityRecord) => {
    setSelectedAuthority(auth);
    const isPresetFonction = COMMON_FUNCTIONS.includes(auth.fonction);
    const isPresetInstitution = COMMON_INSTITUTIONS.includes(auth.institution);

    setFormData({
      fullName: auth.fullName,
      fonction: isPresetFonction ? auth.fonction : 'Autre fonction officielle',
      customFonction: isPresetFonction ? '' : auth.fonction,
      institution: isPresetInstitution ? auth.institution : 'Autre service public',
      customInstitution: isPresetInstitution ? '' : auth.institution,
      service: auth.service || '',
      phoneNumber: auth.phoneNumber || '',
      email: auth.email || '',
      cniNumber: auth.cniNumber || '',
      badgeNumber: auth.badgeNumber || '',
      communeName: auth.commune?.name || '',
      status: auth.status,
      notes: auth.notes || '',
    });

    setPhotoPreview(auth.photoUrl || null);
    setCniRectoPreview(null);
    setCniVersoPreview(null);

    setIsEditModalOpen(true);
  };

  // Handle Quick Status Change
  const handleChangeStatus = async (auth: AuthorityRecord, newStatus: AuthorityStatus) => {
    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/authorities/${auth.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Erreur lors du changement de statut.');
      }

      showFeedback(`Statut de ${auth.fullName} mis à jour : ${newStatus}`);
      fetchAuthorities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du changement de statut';
      setError(msg);
    }
  };

  // Handle Delete Authority
  const handleDeleteAuthority = async (auth: AuthorityRecord) => {
    if (!window.confirm(`Confirmez-vous la suppression définitive de l'autorité "${auth.fullName}" ?`)) {
      return;
    }

    try {
      const token = getStoredAuthToken();
      const res = await fetch(buildApiUrl(`/api/v1/authorities/${auth.id}`), {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la suppression.');
      }

      showFeedback(`Autorité "${auth.fullName}" supprimée avec succès.`);
      if (selectedAuthority?.id === auth.id) {
        setIsDetailModalOpen(false);
      }
      fetchAuthorities();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setError(msg);
    }
  };

  // Filtered Authorities List
  const filteredAuthorities = authorities.filter((auth) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      auth.fullName.toLowerCase().includes(term) ||
      auth.fonction.toLowerCase().includes(term) ||
      auth.institution.toLowerCase().includes(term) ||
      (auth.badgeNumber && auth.badgeNumber.toLowerCase().includes(term)) ||
      (auth.phoneNumber && auth.phoneNumber.toLowerCase().includes(term));

    const matchesCommune =
      selectedCommune === 'ALL' ||
      (auth.commune && auth.commune.name === selectedCommune);

    const matchesStatus =
      selectedStatus === 'ALL' || auth.status === selectedStatus;

    const matchesInstitution =
      selectedInstitutionFilter === 'ALL' ||
      auth.institution.includes(selectedInstitutionFilter);

    return matchesSearch && matchesCommune && matchesStatus && matchesInstitution;
  });

  // KPI Calculations
  const totalCount = authorities.length;
  const activeCount = authorities.filter((a) => a.status === 'ACTIF').length;
  const pendingCount = authorities.filter((a) => a.status === 'EN_ATTENTE_VALIDATION').length;
  const suspendedCount = authorities.filter((a) => a.status === 'SUSPENDU').length;
  const distinctInstitutionsCount = new Set(authorities.map((a) => a.institution)).size;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <img
            src="/aotuc-logo.png"
            alt="Armoiries République de Guinée"
            className="w-12 h-12 rounded-full p-1 bg-white border border-slate-200 shadow-sm flex-shrink-0 object-contain"
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS • DIRECTION GÉNÉRALE
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
              <span>Registre Officiel des Autorités Administratives</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#CE1126] text-white">
                13 Communes
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Accréditation officielle, coordonnées et gestion territoriale des officiers, magistrats et corps de contrôle.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={() => {
              resetForm();
              setIsRegisterModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md transition cursor-pointer min-h-[44px]"
          >
            <UserPlus className="w-4 h-4 text-[#FCD116]" />
            <span>Enregistrer une Autorité</span>
          </button>

          <button
            onClick={fetchAuthorities}
            title="Rafraîchir les données"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Autorités Enregistrées</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Grand Conakry</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Statut Actif</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
              Habilité aux contrôles
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
            <BadgeCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">En Attente / Suspendu</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {pendingCount + suspendedCount}
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5">
              Vérification en cours
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Institutions Partenaires</div>
            <div className="text-2xl font-black text-purple-600 mt-1">
              {distinctInstitutionsCount}
            </div>
            <div className="text-[10px] text-purple-700 dark:text-purple-400 font-medium mt-0.5">
              Services publics rattachés
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filters & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom, fonction, institution, matricule ou téléphone..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Commune filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCommune}
              onChange={(e) => setSelectedCommune(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Toutes les 13 Communes</option>
              {OFFICIAL_COMMUNES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIF">Actif</option>
              <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
              <option value="SUSPENDU">Suspendu</option>
              <option value="INACTIF">Inactif</option>
            </select>
          </div>

          {/* Institution filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedInstitutionFilter}
              onChange={(e) => setSelectedInstitutionFilter(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="ALL">Toutes les Institutions</option>
              <option value="Police">Police Nationale</option>
              <option value="Gendarmerie">Gendarmerie</option>
              <option value="Mairie">Mairies Communales</option>
              <option value="Ministère">Ministère des Transports</option>
              <option value="Garde">Garde Communale</option>
              <option value="Douanes">Douanes</option>
              <option value="Justice">Justice / Parquet</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Table / List of Authorities */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <span>Chargement des autorités enregistrées...</span>
          </div>
        ) : filteredAuthorities.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <Building2 className="w-8 h-8 mx-auto text-slate-300" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              Aucune autorité ne correspond aux critères.
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Utilisez le bouton ci-dessus pour enregistrer un nouvel officier ou représentant d’institution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Autorité / Représentant</th>
                  <th className="p-3">Fonction & Titre</th>
                  <th className="p-3">Institution / Service</th>
                  <th className="p-3">Commune</th>
                  <th className="p-3">Contacts</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAuthorities.map((auth) => (
                  <tr
                    key={auth.id}
                    onClick={() => {
                      setSelectedAuthority(auth);
                      setIsDetailModalOpen(true);
                    }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    {/* Name & Photo */}
                    <td className="p-3">
                      <div className="flex items-center space-x-3">
                        {auth.photoUrl ? (
                          <img
                            src={auth.photoUrl}
                            alt={auth.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {auth.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{auth.fullName}</div>
                          {auth.badgeNumber && (
                            <div className="text-[10px] font-mono text-slate-500">
                              Matr: {auth.badgeNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Function */}
                    <td className="p-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {auth.fonction}
                      </span>
                    </td>

                    {/* Institution */}
                    <td className="p-3">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {auth.institution}
                      </div>
                      {auth.service && (
                        <div className="text-[10px] text-slate-400">{auth.service}</div>
                      )}
                    </td>

                    {/* Commune */}
                    <td className="p-3">
                      {auth.commune ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {auth.commune.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Niveau National</span>
                      )}
                    </td>

                    {/* Contacts */}
                    <td className="p-3 space-y-0.5">
                      {auth.phoneNumber && (
                        <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{auth.phoneNumber}</span>
                        </div>
                      )}
                      {auth.email && (
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[10px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[140px]">{auth.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          auth.status === 'ACTIF'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : auth.status === 'EN_ATTENTE_VALIDATION'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : auth.status === 'SUSPENDU'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {auth.status === 'ACTIF'
                          ? 'Actif'
                          : auth.status === 'EN_ATTENTE_VALIDATION'
                          ? 'En attente'
                          : auth.status === 'SUSPENDU'
                          ? 'Suspendu'
                          : 'Inactif'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedAuthority(auth);
                            setIsDetailModalOpen(true);
                          }}
                          title="Voir fiche complète"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(auth)}
                              title="Modifier l'autorité"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteAuthority(auth)}
                              title="Supprimer l'autorité"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL: REGISTRATION & EDITING FORM */}
      {(isRegisterModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditModalOpen
                    ? `Modifier l'Autorité : ${selectedAuthority?.fullName}`
                    : 'Enregistrer une Nouvelle Autorité Administrative'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsRegisterModalOpen(false);
                  setIsEditModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nom Complet & Titre <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Ex: Général Ibrahima Diallo, Me Mamadou Bah..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Function / Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fonction / Titre Officiel <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.fonction}
                    onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionnez la fonction...</option>
                    {COMMON_FUNCTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Function if Autre */}
                {formData.fonction === 'Autre fonction officielle' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Préciser la Fonction <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customFonction}
                      onChange={(e) => setFormData({ ...formData, customFonction: e.target.value })}
                      placeholder="Ex: Délégué Spécial, Chef de Corps..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Institution */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Institution ou Corps <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionnez l’institution...</option>
                    {COMMON_INSTITUTIONS.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Institution if Autre */}
                {formData.institution === 'Autre service public' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Préciser l’Institution <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customInstitution}
                      onChange={(e) => setFormData({ ...formData, customInstitution: e.target.value })}
                      placeholder="Ex: Agence Guinéenne de la Sécurité..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Service / Division */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Service ou Division
                  </label>
                  <input
                    type="text"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    placeholder="Ex: Brigade Motorisée, Cabinet..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Commune (13 Communes) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Commune de Rattachement
                  </label>
                  <select
                    value={formData.communeName}
                    onChange={(e) => setFormData({ ...formData, communeName: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Rattachement National / Tout Conakry</option>
                    {OFFICIAL_COMMUNES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name} ({c.administrativeOrigin})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro de Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+224 6XX XX XX XX"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Adresse Email Officielle
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="autorite@institution.gov.gn"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* CNI Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro CNI (Carte Nationale d'Identité)
                  </label>
                  <input
                    type="text"
                    value={formData.cniNumber}
                    onChange={(e) => setFormData({ ...formData, cniNumber: e.target.value })}
                    placeholder="Ex: CNI-GN-2026-00192"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Badge Number / Matricule */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro de Matricule / Badge Officiel
                  </label>
                  <input
                    type="text"
                    value={formData.badgeNumber}
                    onChange={(e) => setFormData({ ...formData, badgeNumber: e.target.value })}
                    placeholder="Ex: POL-2026-991, GEND-401..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Statut Administratif
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AuthorityStatus })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIF">Actif (Accrédité aux contrôles)</option>
                    <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
                    <option value="SUSPENDU">Suspendu</option>
                    <option value="INACTIF">Inactif</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes & Observations
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Informations complémentaires, décret de nomination, champ de compétence..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Photo & Documents Section */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Photographie & Justificatifs d’Identité
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Portrait Photo */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-between text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Photo d'Identité / Portrait
                    </span>
                    {photoPreview ? (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Photo portrait"
                          className="w-20 h-20 rounded-lg object-cover border border-slate-300 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoPreview(null)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full text-xs shadow hover:bg-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => startCamera('PHOTO')}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded hover:bg-slate-800 flex items-center space-x-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Caméra</span>
                      </button>
                      <label
                        htmlFor={photoInputId}
                        className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 cursor-pointer flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Fichier</span>
                      </label>
                      <input
                        id={photoInputId}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setPhotoPreview)}
                      />
                    </div>
                  </div>

                  {/* 2. CNI Recto */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-between text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Carte d'Identité (Recto)
                    </span>
                    {cniRectoPreview ? (
                      <div className="relative">
                        <img
                          src={cniRectoPreview}
                          alt="CNI Recto"
                          className="w-24 h-16 rounded-lg object-cover border border-slate-300 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setCniRectoPreview(null)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full text-xs shadow hover:bg-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => startCamera('CNI_RECTO')}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded hover:bg-slate-800 flex items-center space-x-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Caméra</span>
                      </button>
                      <label
                        htmlFor={cniRectoInputId}
                        className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 cursor-pointer flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Fichier</span>
                      </label>
                      <input
                        id={cniRectoInputId}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setCniRectoPreview)}
                      />
                    </div>
                  </div>

                  {/* 3. CNI Verso */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-between text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Carte d'Identité (Verso)
                    </span>
                    {cniVersoPreview ? (
                      <div className="relative">
                        <img
                          src={cniVersoPreview}
                          alt="CNI Verso"
                          className="w-24 h-16 rounded-lg object-cover border border-slate-300 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setCniVersoPreview(null)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full text-xs shadow hover:bg-red-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => startCamera('CNI_VERSO')}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded hover:bg-slate-800 flex items-center space-x-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Caméra</span>
                      </button>
                      <label
                        htmlFor={cniVersoInputId}
                        className="px-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 cursor-pointer flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Fichier</span>
                      </label>
                      <input
                        id={cniVersoInputId}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setCniVersoPreview)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera Live Modal Overlay if active */}
              {cameraActive && (
                <div className="p-3 bg-slate-900 rounded-xl text-white space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>Capture Caméra Active ({cameraTarget})</span>
                    </span>
                    <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-48 rounded-lg bg-black object-cover" />
                  <div className="flex justify-center space-x-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                    >
                      Prendre la Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterModalOpen(false);
                    setIsEditModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#CE1126] hover:bg-red-700 text-white rounded-lg shadow transition disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Enregistrement en cours...'
                    : isEditModalOpen
                    ? 'Enregistrer les modifications'
                    : 'Valider et Inscrire au Registre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: AUTHORITY DETAILS & ACCREDITATION CARD */}
      {isDetailModalOpen && selectedAuthority && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
            {/* Header with tricolor stripe */}
            <div className="relative">
              <div className="h-2 flex">
                <div className="flex-1 bg-[#CE1126]" />
                <div className="flex-1 bg-[#FCD116]" />
                <div className="flex-1 bg-[#009460]" />
              </div>
              <div className="p-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <img src="/aotuc-logo.png" alt="AOTUC" className="w-8 h-8 rounded-full object-contain" />
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      FICHE D’ACCRÉDITATION OFFICIELLE AOTUC
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedAuthority.fullName}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Photo & Key identity banner */}
              <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                {selectedAuthority.photoUrl ? (
                  <img
                    src={selectedAuthority.photoUrl}
                    alt={selectedAuthority.fullName}
                    className="w-20 h-24 rounded-lg object-cover border-2 border-slate-300 dark:border-slate-600 shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-24 rounded-lg bg-slate-900 text-white flex flex-col items-center justify-center text-xs font-bold flex-shrink-0">
                    <User className="w-8 h-8 text-slate-400 mb-1" />
                    <span>SANS PHOTO</span>
                  </div>
                )}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {selectedAuthority.fullName}
                  </div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {selectedAuthority.fonction}
                  </div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {selectedAuthority.institution}
                  </div>
                  {selectedAuthority.service && (
                    <div className="text-[11px] text-slate-500">
                      Service : {selectedAuthority.service}
                    </div>
                  )}
                  <div className="pt-1 flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedAuthority.status === 'ACTIF'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedAuthority.status === 'EN_ATTENTE_VALIDATION'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedAuthority.status}
                    </span>
                    {selectedAuthority.badgeNumber && (
                      <span className="text-[10px] font-mono bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                        Badge : {selectedAuthority.badgeNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Commune d'Attache</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedAuthority.commune?.name || 'Région Spéciale de Conakry (Général)'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Numéro de CNI</span>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedAuthority.cniNumber || 'Non renseigné'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Téléphone</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedAuthority.phoneNumber || 'Non renseigné'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Email Officiel</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {selectedAuthority.email || 'Non renseigné'}
                  </div>
                </div>
              </div>

              {/* Documents & CNI Previews */}
              {selectedAuthority.documents && selectedAuthority.documents.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Pièces Jointes & Justificatifs Enregistrés ({selectedAuthority.documents.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAuthority.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center space-x-2 text-xs"
                      >
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate">{doc.category}</div>
                          <div className="text-[10px] text-slate-400">
                            {(doc.fileSizeBytes / 1024).toFixed(0)} Ko • {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAuthority.notes && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300">
                  <span className="font-bold">Observations : </span>
                  <span>{selectedAuthority.notes}</span>
                </div>
              )}

              {/* Traceability */}
              <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between">
                <span>Enregistré le {new Date(selectedAuthority.createdAt).toLocaleDateString('fr-FR')}</span>
                {selectedAuthority.registeredByUser && (
                  <span>
                    Par : {selectedAuthority.registeredByUser.firstName} {selectedAuthority.registeredByUser.lastName}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {/* Quick Status toggle */}
              <div className="flex items-center space-x-1">
                {selectedAuthority.status !== 'ACTIF' && (
                  <button
                    onClick={() => {
                      handleChangeStatus(selectedAuthority, 'ACTIF');
                      setIsDetailModalOpen(false);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    Activer
                  </button>
                )}
                {selectedAuthority.status === 'ACTIF' && (
                  <button
                    onClick={() => {
                      handleChangeStatus(selectedAuthority, 'SUSPENDU');
                      setIsDetailModalOpen(false);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                  >
                    Suspendre
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEdit(selectedAuthority);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorityManagementView;
