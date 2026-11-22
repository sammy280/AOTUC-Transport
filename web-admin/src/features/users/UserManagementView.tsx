import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  Building2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Briefcase,
  Mail,
  Phone,
  RefreshCw,
  AlertCircle,
  X,
  Camera,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { UserContext, RoleType } from '../../types';
import { buildApiUrl, getStoredAuthToken } from '../../utils/api';
import { OFFICIAL_COMMUNES } from '../../config/communes';

interface ManagedUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  jobTitle?: string;
  avatarUrl?: string | null;
  role: RoleType;
  roleLabel: string;
  commune: string;
  communeId?: string | null;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
}

interface CommuneOption {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const INITIAL_COMMUNES: CommuneOption[] = OFFICIAL_COMMUNES.map((c) => ({
  id: `comm-${c.code.toLowerCase()}`,
  code: c.code,
  name: c.name,
  description: c.description,
}));

const INITIAL_USERS: ManagedUser[] = [
  {
    id: 'usr-dir-001',
    name: 'Mamadou Camara',
    email: 'directeur@aotuc.test',
    phoneNumber: '+224620000002',
    jobTitle: 'Directeur Général AOTUC',
    role: 'DIRECTOR',
    roleLabel: 'Directeur Général AOTUC',
    commune: 'Direction Générale (Conakry)',
    isActive: true,
    lastLogin: 'Aujourd hui à 08:30',
  },
  {
    id: 'usr-adm-001',
    name: 'Ibrahima Diallo',
    email: 'superadmin@aotuc.test',
    phoneNumber: '+224620000001',
    jobTitle: 'Super Administrateur & Responsable DSI',
    role: 'SUPER_ADMIN',
    roleLabel: 'Super Administrateur DSI',
    commune: 'Toutes Communes',
    isActive: true,
    lastLogin: 'Session active',
  },
  {
    id: 'usr-chf-001',
    name: 'Fanta Soumah',
    email: 'chef.matoto@aotuc.test',
    phoneNumber: '+224620000003',
    jobTitle: 'Chef de Service Territorial Matoto',
    role: 'CHEF_SERVICE',
    roleLabel: 'Chef de Service Territorial',
    commune: 'Matoto',
    isActive: true,
    lastLogin: 'Hier à 17:15',
  },
  {
    id: 'usr-chf-002',
    name: 'Alpha Barry',
    email: 'chef.kaloum@aotuc.test',
    phoneNumber: '+224620000004',
    jobTitle: 'Chef de Service Territorial Kaloum',
    role: 'CHEF_SERVICE',
    roleLabel: 'Chef de Service Territorial',
    commune: 'Kaloum',
    isActive: true,
    lastLogin: 'Il y a 2 jours',
  },
  {
    id: 'usr-agt-001',
    name: 'Sekou Conte',
    email: 'agent.matoto@aotuc.test',
    phoneNumber: '+224620000005',
    jobTitle: 'Agent d Enrôlement Terrain Matoto',
    role: 'AGENT_TERRAIN',
    roleLabel: 'Agent d Enrôlement Terrain',
    commune: 'Matoto',
    isActive: true,
    lastLogin: 'Aujourd hui à 09:10',
  },
  {
    id: 'usr-dst-001',
    name: 'Ousmane Sylla',
    email: 'distributeur.kaloum@aotuc.test',
    phoneNumber: '+224620000006',
    jobTitle: 'Distributeur Billetterie Agréé Kaloum',
    role: 'DISTRIBUTEUR',
    roleLabel: 'Distributeur Billetterie Agréé',
    commune: 'Kaloum',
    isActive: true,
    lastLogin: 'Aujourd hui à 11:20',
  },
  {
    id: 'usr-syn-001',
    name: 'Amadou Diallo',
    email: 'syndicat.fntg@aotuc.test',
    phoneNumber: '+224620000007',
    jobTitle: 'Délégué Syndical FNTG',
    role: 'SYNDICAT',
    roleLabel: 'Délégué Syndical FNTG',
    commune: 'Fédération Syndicale',
    isActive: true,
    lastLogin: 'Il y a 3 jours',
  },
];

const getRoleLabel = (role: RoleType): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Administrateur DSI';
    case 'DIRECTOR':
      return 'Directeur Général AOTUC';
    case 'CHEF_SERVICE':
      return 'Chef de Service Territorial';
    case 'AGENT_TERRAIN':
      return 'Agent d Enrôlement Terrain';
    case 'DISTRIBUTEUR':
      return 'Distributeur Billetterie Agréé';
    case 'SYNDICAT':
      return 'Délégué Syndical FNTG';
    default:
      return role;
  }
};

/**
 * Generates a random, secure 14-character alphanumeric + symbol password.
 */
const generateSecurePassword = (length = 14): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + numbers + symbols;

  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  for (let i = chars.length; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  return chars.sort(() => 0.5 - Math.random()).join('');
};

/**
 * Compresses and center-crops an image file or data URL into a sharp 256x256 JPEG portrait data URL
 * so it is fast to transmit and stored durably in PostgreSQL `users.avatar_url`.
 */
const compressImageFileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Format de fichier image invalide.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Image corrompue ou non prise en charge.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
};

export const UserManagementView: React.FC<{
  currentUser: UserContext;
  onUpdateCurrentUser?: (patch: Partial<UserContext>) => void;
}> = ({ currentUser, onUpdateCurrentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);
  const [communes, setCommunes] = useState<CommuneOption[]>(INITIAL_COMMUNES);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // New User Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<RoleType>('AGENT_TERRAIN');
  const [newCommuneId, setNewCommuneId] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>(() => generateSecurePassword());
  const [showPassword, setShowPassword] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Camera & Photo Upload State (shared between Create User Modal and Edit User Photo Modal)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Existing User Photo Modal State
  const [photoTargetUser, setPhotoTargetUser] = useState<ManagedUser | null>(null);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);

  // Created User Credentials Modal (to show and copy generated credentials)
  const [createdSummary, setCreatedSummary] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    jobTitle: string;
    commune: string;
    temporaryPassword: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Reset Password Modal State
  const [resetTargetUser, setResetTargetUser] = useState<ManagedUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState(true);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [copiedResetPassword, setCopiedResetPassword] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsVideoReady(false);
    setIsCameraOpen(false);
  }, []);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, cameraFacingMode]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  const handleStartCamera = async (preferredFacing?: 'user' | 'environment') => {
    setCameraError(null);
    const targetFacing = preferredFacing || cameraFacingMode;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click();
        return;
      }
      setCameraError(
        "La capture caméra directe n'est pas disponible sur ce navigateur. Choisissez une image."
      );
      return;
    }
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setIsVideoReady(false);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetFacing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      mediaStreamRef.current = stream;
      setCameraFacingMode(targetFacing);
      setIsCameraOpen(true);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError(
          "Accès à la caméra refusé. Veuillez autoriser la caméra dans votre navigateur ou choisir une photo."
        );
      } else {
        setCameraError(
          "Impossible d'ouvrir la caméra. Utilisez le bouton « Choisir une Image »."
        );
      }
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    handleStartCamera(nextFacing);
  };

  const handleCapturePhotoFromCamera = (mode: 'create' | 'edit') => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const minSide = Math.min(vw, vh);
    const sx = (vw - minSide) / 2;
    const sy = (vh - minSide) / 2;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, sx, sy, minSide, minSide, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    if (mode === 'create') {
      setNewAvatarUrl(dataUrl);
    } else {
      setEditAvatarUrl(dataUrl);
    }
    stopCameraStream();
  };

  const handlePhotoFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'create' | 'edit'
  ) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setCameraError('Veuillez sélectionner une image au format JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('La photo dépasse la taille maximale autorisée (5 Mo).');
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file);
      if (mode === 'create') {
        setNewAvatarUrl(compressed);
      } else {
        setEditAvatarUrl(compressed);
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Erreur lors du traitement de la photo.');
    }
  };

  const getAuthToken = () => {
    return getStoredAuthToken() || '';
  };

  const mapApiUserToManagedUser = useCallback((u: any, fallbackCommuneName?: string): ManagedUser => {
    const primaryRole = (u.roles?.[0] as RoleType) || (u.role as RoleType) || 'AGENT_TERRAIN';
    return {
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Utilisateur',
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email || '—',
      phoneNumber: u.phoneNumber || '—',
      jobTitle: u.jobTitle || getRoleLabel(primaryRole),
      avatarUrl: u.avatarUrl || null,
      role: primaryRole,
      roleLabel: getRoleLabel(primaryRole),
      commune:
        u.commune?.name ||
        fallbackCommuneName ||
        (primaryRole === 'SUPER_ADMIN' ? 'Toutes Communes' : 'Direction Générale (Conakry)'),
      communeId: u.commune?.id || u.communeId || null,
      isActive: u.isActive !== undefined ? u.isActive : true,
      createdAt: u.createdAt,
      lastLogin: 'Session synchronisée',
    };
  }, []);

  // 1. Fetch Users and Communes from backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);

    const token = getAuthToken();
    if (!token) {
      setErrorBanner(
        'Jeton de session expiré ou absent. Veuillez vous déconnecter puis vous reconnecter pour synchroniser la base PostgreSQL.'
      );
      setIsLoading(false);
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    try {
      // Fetch communes
      const commRes = await fetch(buildApiUrl('/api/v1/users/communes'), { headers }).catch(() => null);
      if (commRes && commRes.ok) {
        const commData = await commRes.json();
        if (commData.success && Array.isArray(commData.data) && commData.data.length > 0) {
          setCommunes(commData.data);
        }
      }

      // Fetch users
      const usersRes = await fetch(buildApiUrl('/api/v1/users?limit=200'), { headers }).catch(() => null);
      if (!usersRes) {
        setErrorBanner('Impossible de contacter le serveur AOTUC pour charger la liste des comptes.');
        return;
      }

      if (usersRes.status === 401 || usersRes.status === 403) {
        const errPayload = await usersRes.json().catch(() => ({}));
        setErrorBanner(
          errPayload.message ||
            'Session non autorisée ou expirée. Veuillez vous reconnecter avec votre compte Super Administrateur.'
        );
        return;
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success && Array.isArray(usersData.items)) {
          const mapped: ManagedUser[] = usersData.items.map((u: any) =>
            mapApiUserToManagedUser(u)
          );
          setUsers(mapped);
        }
      } else {
        const errPayload = await usersRes.json().catch(() => ({}));
        setErrorBanner(errPayload.message || 'Erreur lors du chargement de la liste des collaborateurs.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Erreur réseau lors du chargement des collaborateurs.');
    } finally {
      setIsLoading(false);
    }
  }, [mapApiUserToManagedUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter users by search query and role
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phoneNumber.includes(q) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
      u.commune.toLowerCase().includes(q);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Activate / Deactivate account
  const handleToggleStatus = async (user: ManagedUser) => {
    const updatedStatus = !user.isActive;
    setErrorBanner(null);

    try {
      const response = await fetch(
        buildApiUrl(`/api/v1/users/${user.id}/${updatedStatus ? 'reactivate' : 'deactivate'}`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Erreur lors de la mise à jour du statut sur le serveur.');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: updatedStatus } : u))
      );

      setFeedback(
        updatedStatus
          ? `Compte de ${user.name} réactivé avec succès dans PostgreSQL.`
          : `Compte de ${user.name} désactivé. Sessions actives révoquées immédiatement.`
      );
    } catch (err: any) {
      setErrorBanner(err.message || `Impossible de modifier le statut de ${user.name}.`);
    }
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (user: ManagedUser) => {
    setResetTargetUser(user);
    setResetPasswordValue(generateSecurePassword(14));
    setShowResetPassword(true);
    setCopiedResetPassword(false);
  };

  // Submit Password Reset
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      alert('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    setIsSubmittingReset(true);
    setErrorBanner(null);
    try {
      const response = await fetch(buildApiUrl(`/api/v1/users/${resetTargetUser.id}/password`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ password: resetPasswordValue }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Échec de la réinitialisation du mot de passe.');
      }

      const finalPass = payload.data?.temporaryPassword || resetPasswordValue;
      setFeedback(
        `Mot de passe réinitialisé dans PostgreSQL pour ${resetTargetUser.name}. Nouveau mot de passe sécurisé : ${finalPass}`
      );
      setResetTargetUser(null);
    } catch (err: any) {
      setErrorBanner(err.message || 'Impossible de réinitialiser le mot de passe.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Create User Submission — Reports success ONLY after PostgreSQL persistence succeeds
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);
    setErrorBanner(null);

    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim() || !newEmail.trim()) {
      setCreateModalError('Veuillez renseigner le prénom, le nom, le téléphone et l adresse email professionnelle.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setCreateModalError('Format d adresse email invalide (ex: mamadou.diallo@aotuc.gov.gn).');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setCreateModalError(
        'Votre session administrateur ne contient pas de jeton JWT valide. Veuillez vous déconnecter puis vous reconnecter.'
      );
      return;
    }

    const passwordToSend = newPassword.trim() || generateSecurePassword(14);
    setIsSubmittingCreate(true);

    const communeObj = communes.find((c) => c.id === newCommuneId);
    const communeName = communeObj ? communeObj.name : 'Direction Générale (Conakry)';

    try {
      const response = await fetch(buildApiUrl('/api/v1/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          email: newEmail.trim().toLowerCase(),
          phoneNumber: newPhone.trim(),
          jobTitle: newJobTitle.trim() || getRoleLabel(newRole),
          avatarUrl: newAvatarUrl || null,
          role: newRole,
          communeId: newCommuneId || null,
          communeCode: communeObj?.code || null,
          password: passwordToSend,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success || !payload.data?.id) {
        const fieldErrors = Array.isArray(payload.errors)
          ? payload.errors.map((errItem: any) => errItem.message).join(' • ')
          : '';
        const serverMessage =
          fieldErrors ||
          payload.message ||
          `Échec de la création du compte sur le serveur (HTTP ${response.status}).`;
        throw new Error(serverMessage);
      }

      const createdUser = payload.data;
      const returnedPassword = createdUser.temporaryPassword || passwordToSend;
      const mappedCreated = mapApiUserToManagedUser(createdUser, communeName);

      // 1. Immediately prepend the real persisted PostgreSQL user to table state
      // and clear active filters so the new account is visible immediately
      setRoleFilter('ALL');
      setSearchQuery('');
      setUsers((prev) => [
        mappedCreated,
        ...prev.filter((u) => u.id !== mappedCreated.id && u.email !== mappedCreated.email),
      ]);

      // 2. Close create form and show verified credentials summary card
      stopCameraStream();
      setShowCreateModal(false);
      setCreatedSummary({
        name: `${createdUser.firstName} ${createdUser.lastName}`,
        email: createdUser.email,
        phone: createdUser.phoneNumber,
        role: getRoleLabel(createdUser.roles?.[0] || newRole),
        jobTitle: createdUser.jobTitle || newJobTitle || getRoleLabel(newRole),
        commune: createdUser.commune?.name || communeName,
        temporaryPassword: returnedPassword,
        avatarUrl: createdUser.avatarUrl || newAvatarUrl || null,
      });

      setFeedback(
        `Collaborateur ${createdUser.firstName} ${createdUser.lastName} (${createdUser.email}) enregistré avec succès dans PostgreSQL.`
      );

      // 3. Reset form fields
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewJobTitle('');
      setNewAvatarUrl(null);
      setNewPassword(generateSecurePassword(14));

      // 4. Refresh authoritative list from PostgreSQL
      await loadData();
    } catch (err: any) {
      const msg =
        err.message ||
        'Impossible de créer le compte dans la base de données PostgreSQL. Vérifiez votre connexion et vos droits.';
      setCreateModalError(msg);
      setErrorBanner(msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const openEditPhotoModal = (user: ManagedUser) => {
    stopCameraStream();
    setCameraError(null);
    setPhotoTargetUser(user);
    setEditAvatarUrl(user.avatarUrl || null);
  };

  const handleSaveUserPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoTargetUser) return;
    setIsSubmittingPhoto(true);
    setErrorBanner(null);

    try {
      const response = await fetch(buildApiUrl(`/api/v1/users/${photoTargetUser.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          avatarUrl: editAvatarUrl || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Échec de la mise à jour de la photo de profil.');
      }

      const updatedAvatar = payload.data?.avatarUrl ?? editAvatarUrl ?? null;
      setUsers((prev) =>
        prev.map((u) => (u.id === photoTargetUser.id ? { ...u, avatarUrl: updatedAvatar } : u))
      );

      if (
        photoTargetUser.id === currentUser.id ||
        (photoTargetUser.email &&
          currentUser.email &&
          photoTargetUser.email.toLowerCase() === currentUser.email.toLowerCase())
      ) {
        onUpdateCurrentUser?.({ avatarUrl: updatedAvatar });
      }

      setFeedback(`Photographie de profil mise à jour dans PostgreSQL pour ${photoTargetUser.name}.`);
      stopCameraStream();
      setPhotoTargetUser(null);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Impossible de mettre à jour la photo de profil.');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center space-x-2 bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Direction des Systèmes d Information (DSI)</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion des Collaborateurs & Accréditations AOTUC
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Session active : <span className="font-semibold text-slate-700">{currentUser.name}</span> ({currentUser.roleLabel}) • Création de comptes, attribution des postes/fonctions, emails et mots de passe sécurisés.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 transition cursor-pointer"
            title="Rafraîchir la liste"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={() => {
              setCreateModalError(null);
              setNewPassword(generateSecurePassword(14));
              setShowCreateModal(true);
            }}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Collaborateur</span>
          </button>
        </div>
      </div>

      {/* Security Separation Banner */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
        <Lock className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Politique de Sécurité & Mots de Passe Uniques :</span> Chaque collaborateur dispose d un mot de passe unique à haute entropie et d une adresse email professionnelle validée. Aucun mot de passe par défaut n est partagé. L administration technique n a pas accès aux mots de passe en clair après leur génération chiffrée en Argon2id.
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="font-bold text-slate-400 hover:text-slate-600 ml-4 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorBanner && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="font-bold text-slate-400 hover:text-slate-600 ml-4 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, téléphone, fonction ou commune..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs w-full sm:w-auto">
          {[
            { id: 'ALL', label: 'Tous les rôles' },
            { id: 'DIRECTOR', label: 'Direction (L3)' },
            { id: 'CHEF_SERVICE', label: 'Chefs Territoriaux (L2)' },
            { id: 'AGENT_TERRAIN', label: 'Agents Enrôlement (L1)' },
            { id: 'DISTRIBUTEUR', label: 'Distributeurs' },
            { id: 'SYNDICAT', label: 'Syndicats' },
            { id: 'SUPER_ADMIN', label: 'DSI' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                roleFilter === f.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="p-3">Collaborateur</th>
                <th className="p-3">Email & Téléphone</th>
                <th className="p-3">Poste / Fonction (Travail)</th>
                <th className="p-3">Rôle RBAC</th>
                <th className="p-3">Commune d Affectation</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Aucun collaborateur ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      <div className="flex items-center space-x-2.5">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                            <span>{user.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{user.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center space-x-1.5 text-slate-800">
                        <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="font-medium">{user.email}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{user.phoneNumber}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-medium">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span>{user.jobTitle || 'Collaborateur AOTUC'}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          user.role === 'DIRECTOR'
                            ? 'bg-emerald-100 text-emerald-800'
                            : user.role === 'SUPER_ADMIN'
                            ? 'bg-slate-800 text-white'
                            : user.role === 'CHEF_SERVICE'
                            ? 'bg-blue-100 text-blue-800'
                            : user.role === 'AGENT_TERRAIN'
                            ? 'bg-amber-100 text-amber-900'
                            : user.role === 'DISTRIBUTEUR'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {user.role}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{user.roleLabel}</div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center space-x-1.5 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{user.commune}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            user.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {user.isActive ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>

                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openEditPhotoModal(user)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition inline-flex items-center space-x-1 cursor-pointer"
                        title="Ajouter ou modifier la photo du collaborateur"
                      >
                        <Camera className="w-3 h-3 text-emerald-700" />
                        <span>Photo</span>
                      </button>

                      <button
                        onClick={() => openResetPasswordModal(user)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition inline-flex items-center space-x-1 cursor-pointer"
                        title="Réinitialiser le mot de passe"
                      >
                        <KeyRound className="w-3 h-3 text-slate-500" />
                        <span>Mot de passe</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition inline-flex items-center space-x-1 cursor-pointer ${
                          user.isActive
                            ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {user.isActive ? (
                          <>
                            <UserX className="w-3 h-3 text-rose-600" />
                            <span>Désactiver</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            <span>Réactiver</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Users className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ajouter un Collaborateur AOTUC</h3>
                  <p className="text-[11px] text-slate-300">Affectation, email officiel et mot de passe sécurisé</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs max-h-[85vh] overflow-y-auto">
              {createModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{createModalError}</span>
                </div>
              )}

              {/* Collaborator Photograph Section (Camera Capture + Preview + Retake + File Upload) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 font-bold flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Photographie du Collaborateur (Portrait)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Affichée à côté du nom à la connexion
                  </span>
                </div>

                {cameraError && (
                  <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 font-medium">
                    {cameraError}
                  </div>
                )}

                {isCameraOpen && (
                  <div className="space-y-2 bg-slate-900 p-3 rounded-xl text-white">
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={() => setIsVideoReady(true)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleCapturePhotoFromCamera('create')}
                        disabled={!isVideoReady}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isVideoReady ? 'Capturer la Photo' : 'Initialisation caméra...'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleCameraFacing}
                        className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                        title="Basculer caméra avant / arrière"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Basculer</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {newAvatarUrl && !isCameraOpen && (
                  <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-emerald-200">
                    <img
                      src={newAvatarUrl}
                      alt="Aperçu portrait collaborateur"
                      className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-800">
                        ✓ Photo d'identité prête
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Sera affichée à côté du nom lors de la connexion
                      </p>
                      <div className="flex items-center space-x-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartCamera()}
                          className="inline-flex items-center px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[11px] font-bold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reprendre
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewAvatarUrl(null)}
                          className="inline-flex items-center px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-bold cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isCameraOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{newAvatarUrl ? 'Reprendre (Caméra)' : 'Prendre une Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Choisir une Image</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handlePhotoFileSelect(e, 'create')}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="user"
                      onChange={(e) => handlePhotoFileSelect(e, 'create')}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="ex: Mamadou"
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nom de famille *</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="ex: Diallo"
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email Professionnel *
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ex: mamadou.diallo@aotuc.gov.gn"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Téléphone Mobile Professionnel (+224) *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+224 620 00 00 00"
                    required
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Fonction / Intitulé du Poste (Travail)
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="ex: Agent d Enrôlement Terrain, Contrôleur Billetterie, Superviseur"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Rôle RBAC *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as RoleType)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-xs"
                  >
                    <option value="AGENT_TERRAIN">Agent d Enrôlement (L1)</option>
                    <option value="CHEF_SERVICE">Chef de Service Territorial (L2)</option>
                    <option value="DISTRIBUTEUR">Distributeur Billetterie</option>
                    <option value="SYNDICAT">Délégué Syndical FNTG</option>
                    <option value="DIRECTOR">Directeur Général (L3)</option>
                    <option value="SUPER_ADMIN">Super Administrateur DSI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Commune d Affectation</label>
                  <select
                    value={newCommuneId}
                    onChange={(e) => setNewCommuneId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-xs"
                  >
                    <option value="">Direction Générale (Toutes Communes)</option>
                    {communes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Commune de {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Secure Password Field */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-slate-800 font-bold flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mot de passe initial sécurisé</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateSecurePassword(14))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Régénérer</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full p-2.5 pr-16 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="absolute right-2 top-2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(newPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Copier le mot de passe"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Généré automatiquement (14 car., majuscules, chiffres, symboles). Chiffré en Argon2id.
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmittingCreate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <span>Créer le Compte</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED USER CREDENTIALS SUMMARY MODAL */}
      {createdSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Compte Créé avec Succès</h3>
                  <p className="text-[11px] text-emerald-100">Transmettez ces identifiants au collaborateur</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedSummary(null)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center space-x-3">
                  {createdSummary.avatarUrl ? (
                    <img
                      src={createdSummary.avatarUrl}
                      alt={createdSummary.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {createdSummary.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Collaborateur</span>
                    <div className="font-bold text-slate-900 text-sm">{createdSummary.name}</div>
                    <div className="text-slate-600">{createdSummary.jobTitle}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Email de connexion</span>
                    <div className="font-medium text-slate-800 break-all">{createdSummary.email}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Téléphone</span>
                    <div className="font-medium text-slate-800 font-mono">{createdSummary.phone}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Rôle & Accréditation</span>
                    <div className="font-medium text-slate-800">{createdSummary.role}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Commune</span>
                    <div className="font-medium text-slate-800">{createdSummary.commune}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Mot de passe initial</span>
                  <div className="p-2.5 bg-white border border-slate-300 rounded-lg flex items-center justify-between font-mono font-bold text-slate-900 mt-1">
                    <span>{createdSummary.temporaryPassword}</span>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(createdSummary.temporaryPassword);
                        setCopiedSummary(true);
                        setTimeout(() => setCopiedSummary(false), 2000);
                      }}
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer text-[11px]"
                    >
                      {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSummary ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `Identifiants AOTUC:\nNom: ${createdSummary.name}\nEmail: ${createdSummary.email}\nTéléphone: ${createdSummary.phone}\nPoste: ${createdSummary.jobTitle}\nMot de passe: ${createdSummary.temporaryPassword}`;
                    copyToClipboard(text);
                    setCopiedSummary(true);
                    setTimeout(() => setCopiedSummary(false), 2500);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {copiedSummary ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSummary ? 'Fiche Copiée !' : 'Copier Tout le Récapitulatif'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatedSummary(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Réinitialiser le Mot de Passe</h3>
                  <p className="text-[11px] text-slate-300">{resetTargetUser.name} ({resetTargetUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                <span className="font-bold">Avertissement :</span> La réinitialisation révoquera immédiatement toutes les sessions actives de ce collaborateur sur le Web et l application mobile.
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 font-semibold">Nouveau mot de passe sécurisé</label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordValue(generateSecurePassword(14))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Générer aléatoire</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    required
                    minLength={8}
                    className="w-full p-2.5 pr-16 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="absolute right-2 top-2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(resetPasswordValue);
                        setCopiedResetPassword(true);
                        setTimeout(() => setCopiedResetPassword(false), 2000);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {copiedResetPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmittingReset ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Réinitialisation...</span>
                    </>
                  ) : (
                    <span>Valider la Réinitialisation</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER PHOTO MODAL */}
      {photoTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Photographie du Collaborateur</h3>
                  <p className="text-[11px] text-slate-300">
                    {photoTargetUser.name} ({photoTargetUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCameraStream();
                  setPhotoTargetUser(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserPhoto} className="p-5 space-y-4 text-xs">
              {cameraError && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 font-medium">
                  {cameraError}
                </div>
              )}

              {isCameraOpen && (
                <div className="space-y-2 bg-slate-900 p-3 rounded-xl text-white">
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => setIsVideoReady(true)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCapturePhotoFromCamera('edit')}
                      disabled={!isVideoReady}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isVideoReady ? 'Capturer la Photo' : 'Initialisation caméra...'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleCameraFacing}
                      className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Basculer</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {!isCameraOpen && (
                <div className="flex flex-col items-center space-y-3 py-2">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt={photoTargetUser.name}
                      className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-400">
                      <Camera className="w-7 h-7 mb-1" />
                      <span className="text-[10px] font-bold">Aucune photo</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{editAvatarUrl ? 'Reprendre (Caméra)' : 'Prendre une Photo'}</span>
                    </button>

                    <label className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Choisir une Image</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handlePhotoFileSelect(e, 'edit')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setPhotoTargetUser(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPhoto}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmittingPhoto ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer la Photo</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementView;
