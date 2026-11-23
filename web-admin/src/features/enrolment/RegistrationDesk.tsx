import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserPlus,
  Car,
  Upload,
  CheckCircle2,
  AlertCircle,
  Search,
  FileCheck,
  Shield,
  BadgeCheck,
  Lock,
  Camera,
  RefreshCw,
  PhoneCall,
  UserCheck,
  X,
  Eye,
  RotateCcw,
  Building2,
  FileText,
  ExternalLink,
  Wifi,
  WifiOff,
  Layers,
} from 'lucide-react';
import { UserContext } from '../../types';
import { buildApiUrl, getStoredAuthToken, getStoredAuthUser, parseApiResponse } from '../../utils/api';
import { CONAKRY_COMMUNES } from '../../config/communes';
import {
  saveOfflineDraft,
  listAgentDrafts,
  deleteOfflineDraft,
  cacheReferenceData,
  getCachedReferenceData,
  generateUuidV4,
  OfflineDraftRecord,
} from '../../utils/offlineStore';
import { syncManager, SyncManagerStats } from '../../utils/offlineSyncManager';
import { OfflineQueueModal } from './OfflineQueueModal';

interface DocumentItem {
  id: string;
  category: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  verificationStatus?: string;
}

interface DriverRecord {
  id: string;
  personId: string;
  drivingLicenseNumber: string;
  licenseCategory: string;
  licenseExpirationDate: string;
  status: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  unionId?: string | null;
  union?: { id: string; code: string; name: string } | null;
  createdAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    nin: string;
    phoneNumber: string;
    email?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    commune?: { id: string; name: string; code: string } | null;
    documents?: DocumentItem[];
  };
  documents?: DocumentItem[];
}

interface OwnerRecord {
  id: string;
  personId: string;
  ownerType: 'INDIVIDU' | 'ENTREPRISE';
  businessName?: string | null;
  taxNumber?: string | null;
  unionId?: string | null;
  union?: { id: string; code: string; name: string } | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    nin: string;
    phoneNumber: string;
    commune?: { id: string; name: string; code: string } | null;
  };
}

interface VehicleRecord {
  id: string;
  ownerId: string;
  plateNumber: string;
  registrationCardNumber: string;
  chassisVin: string;
  atrNumber?: string | null;
  aotucLicenseNumber?: string | null;
  vehicleType: string;
  make: string;
  model: string;
  year?: number | null;
  seatingCapacity?: number | null;
  status: string;
  createdAt: string;
  documents?: DocumentItem[];
  owner?: {
    id: string;
    ownerType: string;
    businessName?: string | null;
    person?: {
      firstName: string;
      lastName: string;
      nin: string;
      phoneNumber: string;
      commune?: { id: string; name: string; code: string } | null;
    };
  };
  assignments?: Array<{
    id: string;
    driver?: {
      id: string;
      drivingLicenseNumber: string;
      person?: { firstName: string; lastName: string; phoneNumber: string };
    };
  }>;
}

interface RegistrationDeskProps {
  currentUser?: UserContext & { commune?: string };
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TAXI_COLLECTIF: 'Taxi Collectif',
  MAGBANA_MINIBUS: 'Minibus Magbana',
  BUS_URBAIN: 'Bus Urbain',
  MOTOTAXI: 'Moto-Taxi',
  AUTRE: 'Autre',
};

export const RegistrationDesk: React.FC<RegistrationDeskProps> = ({ currentUser }) => {
  const assignedCommune =
    currentUser?.commune ||
    (currentUser?.communeId ? currentUser.communeName : null);
  const isCommuneLocked = Boolean(assignedCommune);
  const lockedCommune = assignedCommune || 'Matoto';

  const [activeTab, setActiveTab] = useState<'drivers' | 'vehicles'>('drivers');
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [owners, setOwners] = useState<OwnerRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communeFilter, setCommuneFilter] = useState<string>(isCommuneLocked ? lockedCommune : 'ALL');
  const [showSuccessBanner, setShowSuccessBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Offline & Synchronization State
  const activeUserId = currentUser?.id || getStoredAuthUser()?.id || 'agent-default';
  const activeUserName = currentUser?.name || getStoredAuthUser()?.name || 'Agent AOTUC';

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [agentDrafts, setAgentDrafts] = useState<OfflineDraftRecord[]>([]);
  const [showQueueModal, setShowQueueModal] = useState<boolean>(false);

  const resetDriverFormState = () => {
    setDriverFirstName('');
    setDriverLastName('');
    setDriverNin('');
    setDriverPhone('');
    setDriverEmergencyPhone('');
    setDriverEmergencyName('');
    setDriverEmergencyRelation('Famille');
    setDriverLicense('');
    setDriverAddress('');
    setDriverPhotoBase64(null);
    setLicenceRectoBase64(null);
    setLicenceRectoName('permis_recto.jpg');
    setLicenceVersoBase64(null);
    setLicenceVersoName('permis_verso.jpg');
    setCniDocBase64(null);
    setCniDocName('');
  };

  const resetVehicleFormState = () => {
    setVehiclePlate('');
    setVehicleRegistrationCard('');
    setVehicleVin('');
    setVehicleAtrNumber('');
    setVehicleAotucLicenseNumber('');
    setVehicleMake('');
    setVehicleModel('');
    setVehicleDriverId('');
    setCarteGriseBase64(null);
    setPhotoVehiculeBase64(null);
    setNewOwnerFirstName('');
    setNewOwnerLastName('');
    setNewOwnerNin('');
    setNewOwnerPhone('');
    setNewOwnerBusinessName('');
  };

  useEffect(() => {
    syncManager.setAgentUserId(activeUserId);
    listAgentDrafts(activeUserId).then(setAgentDrafts).catch(() => {});

    const unsubscribe = syncManager.subscribe((stats: SyncManagerStats) => {
      setIsOnline(stats.isOnline);
      setIsSyncing(stats.isSyncing);
      listAgentDrafts(activeUserId).then(setAgentDrafts).catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, [activeUserId]);

  // Driver Details Modal state
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null);
  const [selectedDriverPhotoUrl, setSelectedDriverPhotoUrl] = useState<string | null>(null);
  const [selectedDriverLicenceRectoUrl, setSelectedDriverLicenceRectoUrl] = useState<string | null>(null);
  const [selectedDriverLicenceVersoUrl, setSelectedDriverLicenceVersoUrl] = useState<string | null>(null);
  const [selectedDriverCniUrl, setSelectedDriverCniUrl] = useState<string | null>(null);

  // Vehicle Details Modal state
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(null);
  const [selectedVehicleCarteGriseUrl, setSelectedVehicleCarteGriseUrl] = useState<string | null>(null);
  const [selectedVehiclePhotoUrl, setSelectedVehiclePhotoUrl] = useState<string | null>(null);

  // Driver Form State
  const [driverFirstName, setDriverFirstName] = useState('');
  const [driverLastName, setDriverLastName] = useState('');
  const [driverNin, setDriverNin] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverEmergencyPhone, setDriverEmergencyPhone] = useState('');
  const [driverEmergencyName, setDriverEmergencyName] = useState('');
  const [driverEmergencyRelation, setDriverEmergencyRelation] = useState('Famille');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverLicenseCat, setDriverLicenseCat] = useState<'A' | 'B' | 'C' | 'C1' | 'D' | 'E'>('B');
  const [driverLicenseExp, setDriverLicenseExp] = useState('2029-12-31');
  const [driverAddress, setDriverAddress] = useState('');
  const [driverCommune, setDriverCommune] = useState(lockedCommune);
  const [driverUnionId, setDriverUnionId] = useState<string>('');
  const [availableUnions, setAvailableUnions] = useState<Array<{ id: string; code: string; name: string }>>([]);

  // Camera Target: 'portrait' | 'licence_recto' | 'licence_verso' | 'carte_grise' | 'photo_vehicule'
  type CameraTarget = 'portrait' | 'licence_recto' | 'licence_verso' | 'carte_grise' | 'photo_vehicule';
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);

  // Driver Photograph (Portrait)
  const [driverPhotoBase64, setDriverPhotoBase64] = useState<string | null>(null);
  const [driverPhotoName, setDriverPhotoName] = useState<string>('photo_chauffeur.jpg');
  const [driverPhotoMime, setDriverPhotoMime] = useState<string>('image/jpeg');

  // Driving Licence (Permis de Conduire) Documents: Front & Back
  const [licenceRectoBase64, setLicenceRectoBase64] = useState<string | null>(null);
  const [licenceRectoName, setLicenceRectoName] = useState<string>('permis_recto.jpg');
  const [licenceRectoMime, setLicenceRectoMime] = useState<string>('image/jpeg');

  const [licenceVersoBase64, setLicenceVersoBase64] = useState<string | null>(null);
  const [licenceVersoName, setLicenceVersoName] = useState<string>('permis_verso.jpg');
  const [licenceVersoMime, setLicenceVersoMime] = useState<string>('image/jpeg');

  // CNI / Identity Document
  const [cniDocBase64, setCniDocBase64] = useState<string | null>(null);
  const [cniDocName, setCniDocName] = useState<string>('');
  const [cniDocMime, setCniDocMime] = useState<string>('image/jpeg');

  // Vehicle Documents: Carte Grise & Photo Véhicule
  const [carteGriseBase64, setCarteGriseBase64] = useState<string | null>(null);
  const [carteGriseName, setCarteGriseName] = useState<string>('carte_grise.jpg');
  const [carteGriseMime, setCarteGriseMime] = useState<string>('image/jpeg');

  const [photoVehiculeBase64, setPhotoVehiculeBase64] = useState<string | null>(null);
  const [photoVehiculeName, setPhotoVehiculeName] = useState<string>('photo_vehicule.jpg');
  const [photoVehiculeMime, setPhotoVehiculeMime] = useState<string>('image/jpeg');

  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  const licenceRectoFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraLicenceRectoRef = useRef<HTMLInputElement | null>(null);

  const licenceVersoFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraLicenceVersoRef = useRef<HTMLInputElement | null>(null);

  const carteGriseFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraCarteGriseRef = useRef<HTMLInputElement | null>(null);

  const photoVehiculeFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraPhotoVehiculeRef = useRef<HTMLInputElement | null>(null);

  const cniFileInputRef = useRef<HTMLInputElement | null>(null);

  // Vehicle Form State
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [newOwnerFirstName, setNewOwnerFirstName] = useState('');
  const [newOwnerLastName, setNewOwnerLastName] = useState('');
  const [newOwnerNin, setNewOwnerNin] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerType, setNewOwnerType] = useState<'INDIVIDU' | 'ENTREPRISE'>('INDIVIDU');
  const [newOwnerBusinessName, setNewOwnerBusinessName] = useState('');
  const [newOwnerUnionId, setNewOwnerUnionId] = useState<string>('');

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleRegistrationCard, setVehicleRegistrationCard] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleAtrNumber, setVehicleAtrNumber] = useState('');
  const [vehicleAotucLicenseNumber, setVehicleAotucLicenseNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState<string>('2022');
  const [vehicleCapacity, setVehicleCapacity] = useState<string>('18');
  const [vehicleType, setVehicleType] = useState<
    'TAXI_COLLECTIF' | 'MAGBANA_MINIBUS' | 'BUS_URBAIN' | 'MOTOTAXI' | 'AUTRE'
  >('MAGBANA_MINIBUS');
  const [vehicleDriverId, setVehicleDriverId] = useState<string>('');
  const [vehicleCommune, setVehicleCommune] = useState(lockedCommune);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsVideoReady(false);
    setIsCameraOpen(false);
    setCameraTarget(null);
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

  const fetchAllRegistrationData = useCallback(async () => {
    setIsLoading(true);
    const token = getStoredAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      const [driversRes, vehiclesRes, ownersRes, unionsRes] = await Promise.all([
        fetch(buildApiUrl('/api/v1/registration/drivers?limit=100'), { headers }),
        fetch(buildApiUrl('/api/v1/registration/vehicles?limit=100'), { headers }),
        fetch(buildApiUrl('/api/v1/registration/owners?limit=100'), { headers }),
        fetch(buildApiUrl('/api/v1/unions?limit=100'), { headers }),
      ]);

      const [driversBody, vehiclesBody, ownersBody, unionsBody] = await Promise.all([
        parseApiResponse<any>(driversRes),
        parseApiResponse<any>(vehiclesRes),
        parseApiResponse<any>(ownersRes),
        parseApiResponse<any>(unionsRes),
      ]);

      if (unionsRes.ok && unionsBody?.data?.items) {
        setAvailableUnions(unionsBody.data.items);
        cacheReferenceData('unions', unionsBody.data.items).catch(() => {});
      } else if (unionsRes.ok && unionsBody?.items) {
        setAvailableUnions(unionsBody.items);
        cacheReferenceData('unions', unionsBody.items).catch(() => {});
      }

      if (driversRes.ok && driversBody?.data?.items) {
        setDrivers(driversBody.data.items);
        cacheReferenceData('drivers', driversBody.data.items).catch(() => {});
      }
      if (vehiclesRes.ok && vehiclesBody?.data?.items) {
        setVehicles(vehiclesBody.data.items);
        cacheReferenceData('vehicles', vehiclesBody.data.items).catch(() => {});
      }
      if (ownersRes.ok && ownersBody?.data?.items) {
        const loadedOwners: OwnerRecord[] = ownersBody.data.items;
        setOwners(loadedOwners);
        cacheReferenceData('owners', loadedOwners).catch(() => {});
        if (loadedOwners.length > 0) {
          setSelectedOwnerId((prev) => prev || loadedOwners[0].id);
          setOwnerMode('existing');
        } else {
          setOwnerMode('new');
        }
      }
    } catch (err: any) {
      // Offline fallback: load cached reference data from IndexedDB
      try {
        const [cachedUnions, cachedDrivers, cachedVehicles, cachedOwners] = await Promise.all([
          getCachedReferenceData<any[]>('unions'),
          getCachedReferenceData<any[]>('drivers'),
          getCachedReferenceData<any[]>('vehicles'),
          getCachedReferenceData<any[]>('owners'),
        ]);

        if (cachedUnions && cachedUnions.length > 0) setAvailableUnions(cachedUnions);
        if (cachedDrivers && cachedDrivers.length > 0) setDrivers(cachedDrivers);
        if (cachedVehicles && cachedVehicles.length > 0) setVehicles(cachedVehicles);
        if (cachedOwners && cachedOwners.length > 0) {
          setOwners(cachedOwners);
          setSelectedOwnerId((prev) => prev || cachedOwners[0].id);
          setOwnerMode('existing');
        }

        const isNetworkFailure =
          err?.name === 'TypeError' ||
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('NetworkError');

        if (!isNetworkFailure) {
          setErrorMessage(
            err?.message || 'Impossible de charger les dossiers depuis le serveur PostgreSQL.'
          );
        }
      } catch (_) {
        setErrorMessage(
          err?.message || 'Impossible de charger les dossiers depuis le serveur PostgreSQL.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRegistrationData();
  }, [fetchAllRegistrationData]);

  // Start device camera via WebRTC getUserMedia with fallback for desktop/mobile webcams
  const handleStartCamera = async (
    target: CameraTarget = 'portrait',
    preferredFacing?: 'user' | 'environment'
  ) => {
    setCameraError(null);
    setCameraTarget(target);
    const targetFacing = preferredFacing || (target === 'portrait' ? 'user' : 'environment');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (target === 'portrait' && mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click();
        return;
      }
      if (target === 'licence_recto' && mobileCameraLicenceRectoRef.current) {
        mobileCameraLicenceRectoRef.current.click();
        return;
      }
      if (target === 'licence_verso' && mobileCameraLicenceVersoRef.current) {
        mobileCameraLicenceVersoRef.current.click();
        return;
      }
      setCameraError(
        "La capture caméra directe n'est pas disponible sur ce navigateur. Veuillez sélectionner une photo."
      );
      return;
    }

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setIsVideoReady(false);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: targetFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setCameraFacingMode(targetFacing);
      setIsCameraOpen(true);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError(
          "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans la barre d'adresse du navigateur ou choisir une image."
        );
      } else {
        setCameraError(
          "Caméra WebRTC indisponible ou occupée. Utilisez le bouton « Choisir une Image » ou l'appareil photo natif."
        );
      }
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    handleStartCamera(cameraTarget || 'portrait', nextFacing);
  };

  const handleCapturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (cameraTarget === 'portrait') {
      setDriverPhotoBase64(dataUrl);
      setDriverPhotoName(`portrait_${Date.now()}.jpg`);
      setDriverPhotoMime('image/jpeg');
    } else if (cameraTarget === 'licence_recto') {
      setLicenceRectoBase64(dataUrl);
      setLicenceRectoName(`permis_recto_${Date.now()}.jpg`);
      setLicenceRectoMime('image/jpeg');
    } else if (cameraTarget === 'licence_verso') {
      setLicenceVersoBase64(dataUrl);
      setLicenceVersoName(`permis_verso_${Date.now()}.jpg`);
      setLicenceVersoMime('image/jpeg');
    } else if (cameraTarget === 'carte_grise') {
      setCarteGriseBase64(dataUrl);
      setCarteGriseName(`carte_grise_${Date.now()}.jpg`);
      setCarteGriseMime('image/jpeg');
    } else if (cameraTarget === 'photo_vehicule') {
      setPhotoVehiculeBase64(dataUrl);
      setPhotoVehiculeName(`photo_vehicule_${Date.now()}.jpg`);
      setPhotoVehiculeMime('image/jpeg');
    }

    stopCameraStream();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setCameraError('Format de photo non autorisé. Veuillez sélectionner une image JPEG ou PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('La photo dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDriverPhotoBase64(reader.result);
        setDriverPhotoName(file.name);
        setDriverPhotoMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLicenceRectoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
      setCameraError('Format non autorisé. Veuillez sélectionner une image JPEG/PNG ou un PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('Le document recto dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLicenceRectoBase64(reader.result);
        setLicenceRectoName(file.name);
        setLicenceRectoMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLicenceVersoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
      setCameraError('Format non autorisé. Veuillez sélectionner une image JPEG/PNG ou un PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('Le document verso dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLicenceVersoBase64(reader.result);
        setLicenceVersoName(file.name);
        setLicenceVersoMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCniFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('La pièce d identité dépasse la taille maximale autorisée (5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCniDocBase64(reader.result);
        setCniDocName(file.name);
        setCniDocMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCarteGriseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type)) {
      setCameraError('Format non autorisé. Veuillez sélectionner une image JPEG/PNG ou un PDF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('Le document dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCarteGriseBase64(reader.result);
        setCarteGriseName(file.name);
        setCarteGriseMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoVehiculeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCameraError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setCameraError('Format non autorisé. Veuillez sélectionner une image JPEG ou PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError('La photo dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoVehiculeBase64(reader.result);
        setPhotoVehiculeName(file.name);
        setPhotoVehiculeMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenVehicleDetails = async (vehicle: VehicleRecord) => {
    setSelectedVehicle(vehicle);
    setSelectedVehicleCarteGriseUrl(null);
    setSelectedVehiclePhotoUrl(null);

    const allDocs = vehicle.documents || [];
    const token = getStoredAuthToken();
    if (!token || allDocs.length === 0) return;

    const fetchDocBlobUrl = async (docId: string) => {
      try {
        const res = await fetch(buildApiUrl(`/api/v1/documents/${docId}/stream`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        }
      } catch (_) {}
      return null;
    };

    const cgDoc = allDocs.find((d) => d.category === 'CARTE_GRISE');
    if (cgDoc) {
      fetchDocBlobUrl(cgDoc.id).then((url) => {
        if (url) setSelectedVehicleCarteGriseUrl(url);
      });
    }

    const photoDoc = allDocs.find((d) => d.category === 'PHOTO_VEHICULE_AVANT' || d.category === 'AUTRE');
    if (photoDoc) {
      fetchDocBlobUrl(photoDoc.id).then((url) => {
        if (url) setSelectedVehiclePhotoUrl(url);
      });
    }
  };

  const handleCloseVehicleDetails = () => {
    if (selectedVehicleCarteGriseUrl) URL.revokeObjectURL(selectedVehicleCarteGriseUrl);
    if (selectedVehiclePhotoUrl) URL.revokeObjectURL(selectedVehiclePhotoUrl);

    setSelectedVehicle(null);
    setSelectedVehicleCarteGriseUrl(null);
    setSelectedVehiclePhotoUrl(null);
  };

  const handleOpenDriverDetails = async (driver: DriverRecord) => {
    setSelectedDriver(driver);
    setSelectedDriverPhotoUrl(null);
    setSelectedDriverLicenceRectoUrl(null);
    setSelectedDriverLicenceVersoUrl(null);
    setSelectedDriverCniUrl(null);

    const allDocs = driver.person?.documents || driver.documents || [];
    const token = getStoredAuthToken();
    if (!token || allDocs.length === 0) return;

    const fetchDocBlobUrl = async (docId: string) => {
      try {
        const res = await fetch(buildApiUrl(`/api/v1/documents/${docId}/stream`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        }
      } catch (_) {}
      return null;
    };

    // 1. Portrait
    const portraitDoc = allDocs.find((d) => d.category === 'PHOTO_PORTRAIT');
    if (portraitDoc) {
      fetchDocBlobUrl(portraitDoc.id).then((url) => {
        if (url) setSelectedDriverPhotoUrl(url);
      });
    }

    // 2. Licence Recto (or single PERMIS_CONDUIRE)
    const licenceRectoDoc = allDocs.find(
      (d) => d.category === 'PERMIS_CONDUIRE_RECTO' || d.category === 'PERMIS_CONDUIRE'
    );
    if (licenceRectoDoc) {
      fetchDocBlobUrl(licenceRectoDoc.id).then((url) => {
        if (url) setSelectedDriverLicenceRectoUrl(url);
      });
    }

    // 3. Licence Verso
    const licenceVersoDoc = allDocs.find((d) => d.category === 'PERMIS_CONDUIRE_VERSO');
    if (licenceVersoDoc) {
      fetchDocBlobUrl(licenceVersoDoc.id).then((url) => {
        if (url) setSelectedDriverLicenceVersoUrl(url);
      });
    }

    // 4. CNI
    const cniDoc = allDocs.find((d) => d.category === 'CNI_RECTO' || d.category === 'CNI_VERSO');
    if (cniDoc) {
      fetchDocBlobUrl(cniDoc.id).then((url) => {
        if (url) setSelectedDriverCniUrl(url);
      });
    }
  };

  const handleCloseDriverDetails = () => {
    if (selectedDriverPhotoUrl) URL.revokeObjectURL(selectedDriverPhotoUrl);
    if (selectedDriverLicenceRectoUrl) URL.revokeObjectURL(selectedDriverLicenceRectoUrl);
    if (selectedDriverLicenceVersoUrl) URL.revokeObjectURL(selectedDriverLicenceVersoUrl);
    if (selectedDriverCniUrl) URL.revokeObjectURL(selectedDriverCniUrl);

    setSelectedDriver(null);
    setSelectedDriverPhotoUrl(null);
    setSelectedDriverLicenceRectoUrl(null);
    setSelectedDriverLicenceVersoUrl(null);
    setSelectedDriverCniUrl(null);
  };

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setShowSuccessBanner(null);

    const trimmedFirst = driverFirstName.trim();
    const trimmedLast = driverLastName.trim();
    const trimmedNin = driverNin.trim().toUpperCase();
    const trimmedPhone = driverPhone.trim();
    const trimmedEmergencyPhone = driverEmergencyPhone.trim();
    const trimmedLicense = driverLicense.trim().toUpperCase();

    if (!trimmedFirst || !trimmedLast || !trimmedNin || !trimmedPhone || !trimmedLicense) {
      setErrorMessage(
        'Veuillez renseigner le prénom, le nom, le NIN, le téléphone principal et le numéro de permis.'
      );
      return;
    }

    if (!trimmedEmergencyPhone) {
      setErrorMessage(
        "Veuillez renseigner un numéro de téléphone d'urgence valide pour le conducteur."
      );
      return;
    }

    if (
      trimmedEmergencyPhone.replace(/[\s\-\.\(\)]/g, '') ===
      trimmedPhone.replace(/[\s\-\.\(\)]/g, '')
    ) {
      setErrorMessage(
        "Le numéro de téléphone d'urgence doit être différent du numéro de téléphone principal du conducteur."
      );
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setErrorMessage('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const inlineDocuments: Array<{
      category: string;
      originalName: string;
      mimeType: string;
      base64Data: string;
    }> = [];

    if (driverPhotoBase64) {
      inlineDocuments.push({
        category: 'PHOTO_PORTRAIT',
        originalName: driverPhotoName || 'portrait_chauffeur.jpg',
        mimeType: driverPhotoMime || 'image/jpeg',
        base64Data: driverPhotoBase64,
      });
    }

    if (licenceRectoBase64) {
      inlineDocuments.push({
        category: 'PERMIS_CONDUIRE_RECTO',
        originalName: licenceRectoName || 'permis_conduire_recto.jpg',
        mimeType: licenceRectoMime || 'image/jpeg',
        base64Data: licenceRectoBase64,
      });
    }

    if (licenceVersoBase64) {
      inlineDocuments.push({
        category: 'PERMIS_CONDUIRE_VERSO',
        originalName: licenceVersoName || 'permis_conduire_verso.jpg',
        mimeType: licenceVersoMime || 'image/jpeg',
        base64Data: licenceVersoBase64,
      });
    }

    if (cniDocBase64) {
      inlineDocuments.push({
        category: 'CNI_RECTO',
        originalName: cniDocName || 'cni_piece_identite.jpg',
        mimeType: cniDocMime || 'image/jpeg',
        base64Data: cniDocBase64,
      });
    }

    const driverPayload = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      nin: trimmedNin,
      phoneNumber: trimmedPhone,
      emergencyContactPhone: trimmedEmergencyPhone,
      emergencyContactName: driverEmergencyName.trim() || null,
      emergencyContactRelation: driverEmergencyRelation || null,
      drivingLicenseNumber: trimmedLicense,
      licenseCategory: driverLicenseCat,
      licenseExpirationDate: driverLicenseExp,
      address: driverAddress.trim() || null,
      commune: isCommuneLocked ? lockedCommune : driverCommune,
      unionId: driverUnionId || null,
    };

    // If browser is offline, store draft locally in IndexedDB with AES-GCM encryption
    if (!navigator.onLine) {
      try {
        const draft = await saveOfflineDraft({
          agentUserId: activeUserId,
          agentName: activeUserName,
          entityType: 'DRIVER',
          payload: driverPayload,
          documents: inlineDocuments,
          summary: {
            title: `Chauffeur : ${trimmedFirst} ${trimmedLast}`,
            subtitle: `NIN: ${trimmedNin} • Permis: ${trimmedLicense}`,
            commune: isCommuneLocked ? lockedCommune : driverCommune,
            referenceCode: trimmedLicense,
          },
        });

        resetDriverFormState();
        setShowSuccessBanner(
          `✓ Mode Hors-Ligne : Dossier du conducteur "${trimmedFirst} ${trimmedLast}" sauvegardé localement sur cet appareil (ID: ${draft.clientGeneratedId.slice(0, 8).toUpperCase()}). Il sera synchronisé dès le retour d'Internet.`
        );
        const updated = await listAgentDrafts(activeUserId);
        setAgentDrafts(updated);
      } catch (saveErr: any) {
        setErrorMessage(
          saveErr?.message || "Échec de l'enregistrement hors-ligne dans le stockage local."
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiUrl('/api/v1/registration/drivers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...driverPayload,
          documents: inlineDocuments,
        }),
      });

      const body = await parseApiResponse<any>(response);

      if (!response.ok || !body?.success || !body?.data?.id) {
        const validationDetails = Array.isArray(body?.errors)
          ? body.errors.map((errItem: any) => errItem.message).join(' | ')
          : null;
        throw new Error(
          validationDetails ||
            body?.message ||
            `Échec de l'enregistrement du conducteur (HTTP ${response.status}).`
        );
      }

      const persistedDriver: DriverRecord = body.data;
      resetDriverFormState();

      setShowSuccessBanner(
        `✓ Conducteur "${persistedDriver.person?.firstName || trimmedFirst} ${persistedDriver.person?.lastName || trimmedLast}" enregistré dans PostgreSQL (ID : ${persistedDriver.id.slice(0, 8).toUpperCase()})`
      );

      // Refresh live list from PostgreSQL
      await fetchAllRegistrationData();
    } catch (err: any) {
      const isNetworkFailure =
        err?.name === 'TypeError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError');

      if (isNetworkFailure) {
        // Network connection dropped during submission -> securely persist to IndexedDB
        try {
          const draft = await saveOfflineDraft({
            agentUserId: activeUserId,
            agentName: activeUserName,
            entityType: 'DRIVER',
            payload: driverPayload,
            documents: inlineDocuments,
            summary: {
              title: `Chauffeur : ${trimmedFirst} ${trimmedLast}`,
              subtitle: `NIN: ${trimmedNin} • Permis: ${trimmedLicense}`,
              commune: isCommuneLocked ? lockedCommune : driverCommune,
              referenceCode: trimmedLicense,
            },
          });

          resetDriverFormState();
          setShowSuccessBanner(
            `✓ Mode Hors-Ligne : La connexion a été interrompue. Le dossier du conducteur "${trimmedFirst} ${trimmedLast}" a été sécurisé localement (ID: ${draft.clientGeneratedId.slice(0, 8).toUpperCase()}) pour synchronisation ultérieure.`
          );
          const updated = await listAgentDrafts(activeUserId);
          setAgentDrafts(updated);
          return;
        } catch (saveErr: any) {
          setErrorMessage(saveErr?.message || "Échec de l'enregistrement hors-ligne.");
          return;
        }
      }

      setErrorMessage(
        err?.message || "Erreur lors de l'enregistrement du conducteur dans la base de données."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setShowSuccessBanner(null);

    const cleanedPlate = vehiclePlate.trim().toUpperCase();
    const cleanedCard = vehicleRegistrationCard.trim().toUpperCase();
    const cleanedVin = vehicleVin.trim().toUpperCase();
    const cleanedMake = vehicleMake.trim();
    const cleanedModel = vehicleModel.trim();

    if (!cleanedPlate || !cleanedCard || !cleanedVin || !cleanedMake || !cleanedModel) {
      setErrorMessage(
        "Veuillez renseigner la plaque d'immatriculation, le N° de carte grise, le châssis (VIN), la marque et le modèle."
      );
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setErrorMessage('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const vehicleDocs: Array<{
      category: string;
      originalName: string;
      mimeType: string;
      base64Data: string;
    }> = [];

    if (carteGriseBase64) {
      vehicleDocs.push({
        category: 'CARTE_GRISE',
        originalName: carteGriseName || 'carte_grise.jpg',
        mimeType: carteGriseMime || 'image/jpeg',
        base64Data: carteGriseBase64,
      });
    }

    if (photoVehiculeBase64) {
      vehicleDocs.push({
        category: 'PHOTO_VEHICULE_AVANT',
        originalName: photoVehiculeName || 'photo_vehicule.jpg',
        mimeType: photoVehiculeMime || 'image/jpeg',
        base64Data: photoVehiculeBase64,
      });
    }

    const saveVehicleOffline = async () => {
      let offlineOwnerId = selectedOwnerId;
      let newOwnerClientId: string | null = null;

      if (ownerMode === 'new') {
        if (
          !newOwnerFirstName.trim() ||
          !newOwnerLastName.trim() ||
          !newOwnerNin.trim() ||
          !newOwnerPhone.trim()
        ) {
          throw new Error(
            'Veuillez renseigner le prénom, le nom, le NIN et le téléphone du nouveau propriétaire.'
          );
        }

        newOwnerClientId = generateUuidV4();
        await saveOfflineDraft({
          clientGeneratedId: newOwnerClientId,
          agentUserId: activeUserId,
          agentName: activeUserName,
          entityType: 'OWNER',
          payload: {
            firstName: newOwnerFirstName.trim(),
            lastName: newOwnerLastName.trim(),
            nin: newOwnerNin.trim().toUpperCase(),
            phoneNumber: newOwnerPhone.trim(),
            ownerType: newOwnerType,
            businessName: newOwnerBusinessName.trim() || null,
            unionId: newOwnerUnionId || null,
            commune: isCommuneLocked ? lockedCommune : vehicleCommune,
          },
          summary: {
            title: `Propriétaire : ${newOwnerFirstName.trim()} ${newOwnerLastName.trim()}`,
            subtitle: `NIN: ${newOwnerNin.trim().toUpperCase()} • Tél: ${newOwnerPhone.trim()}`,
            commune: isCommuneLocked ? lockedCommune : vehicleCommune,
          },
        });
      }

      const vehicleDraft = await saveOfflineDraft({
        agentUserId: activeUserId,
        agentName: activeUserName,
        entityType: 'VEHICLE',
        payload: {
          ownerId: ownerMode === 'existing' ? offlineOwnerId : null,
          ownerClientGeneratedId: ownerMode === 'new' ? newOwnerClientId : null,
          driverId: vehicleDriverId || null,
          plateNumber: cleanedPlate,
          registrationCardNumber: cleanedCard,
          chassisVin: cleanedVin,
          atrNumber: vehicleAtrNumber.trim() || null,
          aotucLicenseNumber: vehicleAotucLicenseNumber.trim() || null,
          vehicleType,
          make: cleanedMake,
          model: cleanedModel,
          year: vehicleYear ? Number(vehicleYear) : null,
          seatingCapacity: vehicleCapacity ? Number(vehicleCapacity) : null,
          commune: isCommuneLocked ? lockedCommune : vehicleCommune,
        },
        documents: vehicleDocs,
        summary: {
          title: `Véhicule : ${cleanedPlate}`,
          subtitle: `${cleanedMake} ${cleanedModel} • Châssis: ${cleanedVin}`,
          commune: isCommuneLocked ? lockedCommune : vehicleCommune,
          referenceCode: cleanedPlate,
        },
      });

      resetVehicleFormState();
      setShowSuccessBanner(
        `✓ Mode Hors-Ligne : Dossier du véhicule "${cleanedPlate}" sauvegardé localement sur cet appareil (ID: ${vehicleDraft.clientGeneratedId.slice(0, 8).toUpperCase()}). Il sera synchronisé dès le retour d'Internet.`
      );
      const updated = await listAgentDrafts(activeUserId);
      setAgentDrafts(updated);
    };

    if (!navigator.onLine) {
      try {
        await saveVehicleOffline();
      } catch (saveErr: any) {
        setErrorMessage(saveErr?.message || "Échec de l'enregistrement hors-ligne du véhicule.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      let targetOwnerId = selectedOwnerId;

      // If creating a new owner inline, persist the Owner in PostgreSQL first
      if (ownerMode === 'new') {
        if (
          !newOwnerFirstName.trim() ||
          !newOwnerLastName.trim() ||
          !newOwnerNin.trim() ||
          !newOwnerPhone.trim()
        ) {
          throw new Error(
            'Veuillez renseigner le prénom, le nom, le NIN et le téléphone du nouveau propriétaire.'
          );
        }

        const ownerRes = await fetch(buildApiUrl('/api/v1/registration/owners'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: newOwnerFirstName.trim(),
            lastName: newOwnerLastName.trim(),
            nin: newOwnerNin.trim().toUpperCase(),
            phoneNumber: newOwnerPhone.trim(),
            ownerType: newOwnerType,
            businessName: newOwnerBusinessName.trim() || null,
            unionId: newOwnerUnionId || null,
            commune: isCommuneLocked ? lockedCommune : vehicleCommune,
          }),
        });

        const ownerBody = await parseApiResponse<any>(ownerRes);
        if (!ownerRes.ok || !ownerBody?.success || !ownerBody?.data?.id) {
          const ownerValidation = Array.isArray(ownerBody?.errors)
            ? ownerBody.errors.map((errItem: any) => errItem.message).join(' | ')
            : null;
          throw new Error(
            ownerValidation ||
              ownerBody?.message ||
              `Échec de la création du propriétaire (HTTP ${ownerRes.status}).`
          );
        }

        targetOwnerId = ownerBody.data.id;
      }

      if (!targetOwnerId) {
        throw new Error('Veuillez sélectionner ou créer un propriétaire légal pour ce véhicule.');
      }

      const response = await fetch(buildApiUrl('/api/v1/registration/vehicles'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: targetOwnerId,
          driverId: vehicleDriverId || null,
          plateNumber: cleanedPlate,
          registrationCardNumber: cleanedCard,
          chassisVin: cleanedVin,
          atrNumber: vehicleAtrNumber.trim() || null,
          aotucLicenseNumber: vehicleAotucLicenseNumber.trim() || null,
          vehicleType,
          make: cleanedMake,
          model: cleanedModel,
          year: vehicleYear ? Number(vehicleYear) : null,
          seatingCapacity: vehicleCapacity ? Number(vehicleCapacity) : null,
          commune: isCommuneLocked ? lockedCommune : vehicleCommune,
          documents: vehicleDocs,
        }),
      });

      const body = await parseApiResponse<any>(response);

      if (!response.ok || !body?.success || !body?.data?.id) {
        const validationDetails = Array.isArray(body?.errors)
          ? body.errors.map((errItem: any) => errItem.message).join(' | ')
          : null;
        throw new Error(
          validationDetails ||
            body?.message ||
            `Échec de l'enregistrement du véhicule (HTTP ${response.status}).`
        );
      }

      const persistedVehicle: VehicleRecord = body.data;
      resetVehicleFormState();

      setShowSuccessBanner(
        `✓ Véhicule "${persistedVehicle.plateNumber}" enregistré dans PostgreSQL (ID : ${persistedVehicle.id.slice(0, 8).toUpperCase()})`
      );

      await fetchAllRegistrationData();
    } catch (err: any) {
      const isNetworkFailure =
        err?.name === 'TypeError' ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError');

      if (isNetworkFailure) {
        try {
          await saveVehicleOffline();
          return;
        } catch (saveErr: any) {
          setErrorMessage(saveErr?.message || "Échec de l'enregistrement hors-ligne du véhicule.");
          return;
        }
      }

      setErrorMessage(
        err?.message || "Erreur lors de l'enregistrement du véhicule dans la base de données."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const fullName = `${d.person?.firstName || ''} ${d.person?.lastName || ''}`.trim().toLowerCase();
    const nin = (d.person?.nin || '').toLowerCase();
    const license = (d.drivingLicenseNumber || '').toLowerCase();
    const phone = (d.person?.phoneNumber || '').toLowerCase();
    const emergencyPhone = (d.emergencyContactPhone || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      !q ||
      fullName.includes(q) ||
      nin.includes(q) ||
      license.includes(q) ||
      phone.includes(q) ||
      emergencyPhone.includes(q);

    const driverCommuneName = d.person?.commune?.name || '';
    const matchesCommune =
      communeFilter === 'ALL' ||
      !driverCommuneName ||
      driverCommuneName.toLowerCase() === communeFilter.toLowerCase();

    return matchesSearch && matchesCommune;
  });

  const filteredVehicles = vehicles.filter((v) => {
    const plate = (v.plateNumber || '').toLowerCase();
    const vin = (v.chassisVin || '').toLowerCase();
    const card = (v.registrationCardNumber || '').toLowerCase();
    const atr = (v.atrNumber || '').toLowerCase();
    const aotucLic = (v.aotucLicenseNumber || '').toLowerCase();
    const makeModel = `${v.make || ''} ${v.model || ''}`.toLowerCase();
    const ownerName = `${v.owner?.person?.firstName || ''} ${v.owner?.person?.lastName || ''} ${v.owner?.businessName || ''}`
      .trim()
      .toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      !q ||
      plate.includes(q) ||
      vin.includes(q) ||
      card.includes(q) ||
      atr.includes(q) ||
      aotucLic.includes(q) ||
      makeModel.includes(q) ||
      ownerName.includes(q);

    const vCommuneName = v.owner?.person?.commune?.name || '';
    const matchesCommune =
      communeFilter === 'ALL' ||
      !vCommuneName ||
      vCommuneName.toLowerCase() === communeFilter.toLowerCase();

    return matchesSearch && matchesCommune;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIF':
      case 'VALIDE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            <BadgeCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> ACTIF / VALIDÉ
          </span>
        );
      case 'EN_ATTENTE_VALIDATION':
      case 'SOUMIS_NIVEAU2':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            <Shield className="w-3.5 h-3.5 mr-1 text-blue-600" /> EN ATTENTE VALIDATION
          </span>
        );
      case 'SUSPENDU':
      case 'REJETE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-600" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-md uppercase tracking-wider">
              Enrôlement Officiel PostgreSQL
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              • Conformité biométrique, photo & contact d'urgence
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 mt-1">
            Guichet d'Enrôlement des Conducteurs & Véhicules
          </h2>
          <p className="text-sm text-slate-500">
            Enregistrement direct dans la base de données PostgreSQL AOTUC avec prise de photo par caméra et contact d'urgence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('drivers');
                setErrorMessage(null);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
                activeTab === 'drivers'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Conducteurs ({drivers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('vehicles');
                setErrorMessage(null);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${
                activeTab === 'vehicles'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>Véhicules ({vehicles.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchAllRegistrationData}
            disabled={isLoading}
            className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Actualiser depuis PostgreSQL"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Connectivity & Pending Queue Notification Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-lg flex items-center justify-center ${
              isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold">
                {isOnline ? 'Réseau Connecté' : 'Mode Hors-Ligne Actif'}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isOnline ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {isOnline ? 'PostgreSQL synchronisé' : 'Sauvegarde locale chiffrée'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {agentDrafts.filter((d) => d.syncStatus === 'PENDING').length > 0
                ? `${agentDrafts.filter((d) => d.syncStatus === 'PENDING').length} dossier(s) en attente de synchronisation sur ce terminal.`
                : 'Aucun enregistrement local en attente. Prêt pour les enrôlements.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {agentDrafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQueueModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>File Locale ({agentDrafts.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              const res = await syncManager.syncPendingDrafts();
              if (res.message) {
                if (res.success && res.synced > 0) {
                  setShowSuccessBanner(
                    `✓ Synchronisation réussie : ${res.synced} dossier(s) enregistrés dans PostgreSQL.`
                  );
                  fetchAllRegistrationData();
                } else if (!res.success && res.failed > 0) {
                  setErrorMessage(`Attention : ${res.message}`);
                }
              }
              const updated = await listAgentDrafts(activeUserId);
              setAgentDrafts(updated);
            }}
            disabled={
              isSyncing ||
              !isOnline ||
              agentDrafts.filter((d) => d.syncStatus === 'PENDING').length === 0
            }
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
          </button>
        </div>
      </div>

      {/* Confirmed Persistence Success Banner */}
      {showSuccessBanner && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{showSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSuccessBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Real Backend Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-sm font-bold">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-red-700 hover:underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Main Grid: Form + Live Registry List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Registration Form */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {activeTab === 'drivers' ? (
                <UserPlus className="w-5 h-5 text-amber-400" />
              ) : (
                <Car className="w-5 h-5 text-amber-400" />
              )}
              <h3 className="font-bold text-base">
                {activeTab === 'drivers'
                  ? 'Nouveau Dossier Conducteur'
                  : 'Nouveau Dossier Véhicule'}
              </h3>
            </div>
            <span className="text-[11px] bg-white/10 px-2.5 py-1 rounded text-slate-300 font-semibold">
              Persistance PostgreSQL
            </span>
          </div>

          {activeTab === 'drivers' ? (
            <form onSubmit={handleRegisterDriver} className="p-4 sm:p-6 space-y-4">
              {/* Driver Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Prénom(s) (CNI) *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverFirstName}
                    onChange={(e) => setDriverFirstName(e.target.value)}
                    placeholder="Ex: Mamadou"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nom de Famille *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverLastName}
                    onChange={(e) => setDriverLastName(e.target.value)}
                    placeholder="Ex: Diallo"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° NIN Biométrique *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverNin}
                    onChange={(e) => setDriverNin(e.target.value)}
                    placeholder="GN-1990-XXXXXXX"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Téléphone Principal *
                  </label>
                  <input
                    type="tel"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="+224 622 00 00 00"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center">
                    <PhoneCall className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                    Contact en Cas d'Urgence
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Distinct du N° principal
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° Téléphone d'Urgence *
                  </label>
                  <input
                    type="tel"
                    required
                    value={driverEmergencyPhone}
                    onChange={(e) => setDriverEmergencyPhone(e.target.value)}
                    placeholder="+224 628 11 22 33"
                    className="w-full px-3.5 py-2 border border-amber-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Nom du Contact (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={driverEmergencyName}
                      onChange={(e) => setDriverEmergencyName(e.target.value)}
                      placeholder="Ex: Fatoumata Diallo"
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Lien avec le Chauffeur
                    </label>
                    <select
                      value={driverEmergencyRelation}
                      onChange={(e) => setDriverEmergencyRelation(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    >
                      <option value="Famille">Membre de la famille</option>
                      <option value="Conjoint(e)">Conjoint(e) / Époux(se)</option>
                      <option value="Parent">Parent (Père / Mère)</option>
                      <option value="Frère/Sœur">Frère / Sœur</option>
                      <option value="Ami(e)">Ami(e) proche</option>
                      <option value="Collègue">Collègue / Syndicat</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Driving License Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° Permis de Conduire *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverLicense}
                    onChange={(e) => setDriverLicense(e.target.value)}
                    placeholder="PC-GN-2026-XXXXX"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={driverLicenseCat}
                    onChange={(e) => setDriverLicenseCat(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="B">Cat. B</option>
                    <option value="C">Cat. C</option>
                    <option value="C1">Cat. C1</option>
                    <option value="D">Cat. D</option>
                    <option value="A">Cat. A</option>
                    <option value="E">Cat. E</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Expiration du Permis *
                  </label>
                  <input
                    type="date"
                    required
                    value={driverLicenseExp}
                    onChange={(e) => setDriverLicenseExp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Commune d'Affectation *
                  </label>
                  {isCommuneLocked ? (
                    <div className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 flex items-center justify-between">
                      <span>{lockedCommune}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ) : (
                    <select
                      value={driverCommune}
                      onChange={(e) => setDriverCommune(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      {CONAKRY_COMMUNES.map((comm) => (
                        <option key={comm} value={comm}>
                          {comm}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Driver Syndicat Selection Form Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Syndicat / Organisation Professionnelle
                </label>
                <select
                  value={driverUnionId}
                  onChange={(e) => setDriverUnionId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="">Indépendant (Aucune affiliation syndicale)</option>
                  {availableUnions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver Photograph Section: Camera Capture + Preview + Retake + File Upload */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <Camera className="w-4 h-4 mr-1.5 text-emerald-700" />
                    Photographie du Conducteur (Portrait)
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    JPEG / PNG • Max 5 Mo
                  </span>
                </div>

                {cameraError && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 font-medium">
                    {cameraError}
                  </div>
                )}

                {isCameraOpen && (
                  <div className="space-y-2.5 bg-slate-900 p-3 rounded-xl text-white">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>
                        {cameraTarget === 'portrait'
                          ? '📷 Portrait du Conducteur'
                          : cameraTarget === 'licence_recto'
                          ? '📷 Permis de Conduire — Face Avant (Recto)'
                          : '📷 Permis de Conduire — Face Arrière (Verso)'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {cameraFacingMode === 'user' ? 'Caméra Frontale' : 'Caméra Arrière'}
                      </span>
                    </div>
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
                        onClick={handleCapturePhotoFromCamera}
                        disabled={!isVideoReady}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isVideoReady ? 'Capturer la Photo' : 'Initialisation caméra...'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleCameraFacing}
                        className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center space-x-1"
                        title="Basculer caméra avant / arrière"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Basculer</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {driverPhotoBase64 && !isCameraOpen && (
                  <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-emerald-200">
                    <img
                      src={driverPhotoBase64}
                      alt="Aperçu portrait chauffeur"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-800 truncate">
                        ✓ Photo capturée ({driverPhotoName})
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Prête à être enregistrée avec le dossier
                      </p>
                      <div className="flex items-center space-x-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartCamera('portrait', 'user')}
                          className="inline-flex items-center px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[11px] font-bold"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reprendre la photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriverPhotoBase64(null)}
                          className="inline-flex items-center px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-bold"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isCameraOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleStartCamera('portrait', 'user')}
                      className="min-h-[44px] py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{driverPhotoBase64 ? 'Reprendre (Caméra)' : 'Prendre une Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Choisir une Image</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="user"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Dedicated Driving Licence Document Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <FileText className="w-4 h-4 mr-1.5 text-emerald-700" />
                    Numérisation du Permis de Conduire (Obligatoire)
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                    Pièces Officielles
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Prenez en photo ou joignez les deux faces du permis de conduire physique du chauffeur.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Face Avant (Recto) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Face Avant (Recto) *</span>
                      {licenceRectoBase64 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ Capturé
                        </span>
                      )}
                    </div>

                    {licenceRectoBase64 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                          <img
                            src={licenceRectoBase64}
                            alt="Aperçu Permis Recto"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('licence_recto', 'environment')}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reprendre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => licenceRectoFileInputRef.current?.click()}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                          >
                            Remplacer
                          </button>
                          <button
                            type="button"
                            onClick={() => setLicenceRectoBase64(null)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-bold"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center p-3 text-center text-slate-400 bg-slate-50">
                          <FileText className="w-6 h-6 mb-1 text-slate-300" />
                          <span className="text-[10px] font-medium">Aucune photo du recto</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('licence_recto', 'environment')}
                            className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Photo Recto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => licenceRectoFileInputRef.current?.click()}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Fichier</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={licenceRectoFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleLicenceRectoFileChange}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraLicenceRectoRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handleLicenceRectoFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Face Arrière (Verso) */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Face Arrière (Verso)</span>
                      {licenceVersoBase64 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ Capturé
                        </span>
                      )}
                    </div>

                    {licenceVersoBase64 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                          <img
                            src={licenceVersoBase64}
                            alt="Aperçu Permis Verso"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('licence_verso', 'environment')}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reprendre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => licenceVersoFileInputRef.current?.click()}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                          >
                            Remplacer
                          </button>
                          <button
                            type="button"
                            onClick={() => setLicenceVersoBase64(null)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-bold"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center p-3 text-center text-slate-400 bg-slate-50">
                          <FileText className="w-6 h-6 mb-1 text-slate-300" />
                          <span className="text-[10px] font-medium">Optionnel (Verso)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('licence_verso', 'environment')}
                            className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Photo Verso</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => licenceVersoFileInputRef.current?.click()}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Fichier</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={licenceVersoFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleLicenceVersoFileChange}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraLicenceVersoRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handleLicenceVersoFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Pièce d'Identité Nationale (CNI / Passeport - Optionnel) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Pièce d'Identité Nationale (CNI / Passeport - Optionnel)
                  </label>
                  <span className="text-[10px] text-slate-500">PDF / JPEG / PNG</span>
                </div>
                <label className="border border-dashed border-slate-300 rounded-lg p-2.5 text-center bg-white hover:bg-slate-100 transition-colors cursor-pointer block">
                  <input
                    ref={cniFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleCniFileChange}
                    className="hidden"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {cniDocName
                      ? `✓ Pièce CNI jointe : ${cniDocName}`
                      : 'Cliquez pour joindre la copie CNI ou Passeport (Max 5 Mo)'}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Enregistrement dans PostgreSQL en cours...'
                    : 'Enregistrer le Conducteur'}
                </span>
              </button>
            </form>
          ) : (
            /* Vehicle Form */
            <form onSubmit={handleRegisterVehicle} className="p-4 sm:p-6 space-y-4">
              {/* Marque and Modèle at the top */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Marque du Véhicule *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="Ex: Toyota"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Modèle *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: HiAce / Corolla"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° Plaque Immatriculation *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="RC-1234-A"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° Carte Grise *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleRegistrationCard}
                    onChange={(e) => setVehicleRegistrationCard(e.target.value)}
                    placeholder="CG-2026-XXXXX"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    N° Châssis (VIN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleVin}
                    onChange={(e) => setVehicleVin(e.target.value)}
                    placeholder="JTFHX02P7000..."
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Catégorie de Transport *
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="MAGBANA_MINIBUS">Minibus Magbana</option>
                    <option value="TAXI_COLLECTIF">Taxi Collectif</option>
                    <option value="BUS_URBAIN">Bus Urbain</option>
                    <option value="MOTOTAXI">Moto-Taxi</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
              </div>

              {/* Dedicated Identifiers: Numéro ATR and Numéro de licence AOTUC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                <div>
                  <label className="block text-xs font-extrabold text-amber-900 uppercase mb-1">
                    Numéro ATR
                  </label>
                  <input
                    type="text"
                    value={vehicleAtrNumber}
                    onChange={(e) => setVehicleAtrNumber(e.target.value)}
                    placeholder="Ex: ATR-GN-2026-001"
                    className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-800/80 mt-0.5 block">
                    Numéro officiel d'autorisation du transporteur en Guinée
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-emerald-900 uppercase mb-1">
                    Numéro de licence AOTUC
                  </label>
                  <input
                    type="text"
                    value={vehicleAotucLicenseNumber}
                    onChange={(e) => setVehicleAotucLicenseNumber(e.target.value)}
                    placeholder="Ex: AOTUC-LIC-2026-001"
                    className="w-full px-3 py-2 border border-emerald-300 bg-white rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-800/80 mt-0.5 block">
                    Numéro de licence d'exploitation AOTUC
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Année
                  </label>
                  <input
                    type="number"
                    min={1975}
                    max={2030}
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Places
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={vehicleCapacity}
                    onChange={(e) => setVehicleCapacity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Commune *
                  </label>
                  {isCommuneLocked ? (
                    <div className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 flex items-center justify-between">
                      <span>{lockedCommune}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ) : (
                    <select
                      value={vehicleCommune}
                      onChange={(e) => setVehicleCommune(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      {CONAKRY_COMMUNES.map((comm) => (
                        <option key={comm} value={comm}>
                          {comm}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Legal Owner Relationship Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <Building2 className="w-4 h-4 mr-1.5 text-emerald-700" />
                    Propriétaire Légal (Carte Grise) *
                  </span>
                  <div className="flex bg-white rounded-md border border-slate-200 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setOwnerMode('existing')}
                      className={`px-2 py-0.5 rounded ${
                        ownerMode === 'existing'
                          ? 'bg-emerald-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Existant ({owners.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerMode('new')}
                      className={`px-2 py-0.5 rounded ${
                        ownerMode === 'new'
                          ? 'bg-emerald-700 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      + Nouveau
                    </button>
                  </div>
                </div>

                {ownerMode === 'existing' ? (
                  owners.length > 0 ? (
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      {owners.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.person?.firstName} {o.person?.lastName}
                          {o.businessName ? ` (${o.businessName})` : ''} — NIN: {o.person?.nin}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      Aucun propriétaire trouvé. Cliquez sur <strong>+ Nouveau</strong> pour saisir le propriétaire.
                    </div>
                  )
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={newOwnerFirstName}
                        onChange={(e) => setNewOwnerFirstName(e.target.value)}
                        placeholder="Prénom propriétaire *"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={newOwnerLastName}
                        onChange={(e) => setNewOwnerLastName(e.target.value)}
                        placeholder="Nom propriétaire *"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={newOwnerNin}
                        onChange={(e) => setNewOwnerNin(e.target.value)}
                        placeholder="NIN propriétaire *"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-mono"
                      />
                      <input
                        type="tel"
                        required
                        value={newOwnerPhone}
                        onChange={(e) => setNewOwnerPhone(e.target.value)}
                        placeholder="Tél (+224 6XX...) *"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={newOwnerType}
                        onChange={(e) => setNewOwnerType(e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      >
                        <option value="INDIVIDU">Personne Physique (Individu)</option>
                        <option value="ENTREPRISE">Société / Entreprise</option>
                      </select>
                      <input
                        type="text"
                        value={newOwnerBusinessName}
                        onChange={(e) => setNewOwnerBusinessName(e.target.value)}
                        placeholder="Raison sociale (si société)"
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <select
                        value={newOwnerUnionId}
                        onChange={(e) => setNewOwnerUnionId(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                      >
                        <option value="">Syndicat du propriétaire : Indépendant (Aucun)</option>
                        {availableUnions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code} — {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Driver Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Conducteur Titulaire Assigné (Optionnel)
                </label>
                <select
                  value={vehicleDriverId}
                  onChange={(e) => setVehicleDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="">-- Aucun conducteur assigné pour l'instant --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.person?.firstName} {d.person?.lastName} — Permis: {d.drivingLicenseNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photographies & Documents Numérisés du Véhicule */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                    <Camera className="w-4 h-4 mr-1.5 text-emerald-700" />
                    Numérisation Documents Véhicule
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">Caméra ou Téléversement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Carte Grise */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Carte Grise</span>
                      {carteGriseBase64 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ Capturé
                        </span>
                      )}
                    </div>

                    {carteGriseBase64 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                          <img
                            src={carteGriseBase64}
                            alt="Aperçu Carte Grise"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('carte_grise', 'environment')}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reprendre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => carteGriseFileInputRef.current?.click()}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                          >
                            Remplacer
                          </button>
                          <button
                            type="button"
                            onClick={() => setCarteGriseBase64(null)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-bold"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center p-3 text-center text-slate-400 bg-slate-50">
                          <FileText className="w-6 h-6 mb-1 text-slate-300" />
                          <span className="text-[10px] font-medium">Photo Carte Grise</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('carte_grise', 'environment')}
                            className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Photo CG</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => carteGriseFileInputRef.current?.click()}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Fichier</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={carteGriseFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleCarteGriseFileChange}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraCarteGriseRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handleCarteGriseFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Photo Véhicule */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Photo Véhicule</span>
                      {photoVehiculeBase64 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✓ Capturé
                        </span>
                      )}
                    </div>

                    {photoVehiculeBase64 ? (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                          <img
                            src={photoVehiculeBase64}
                            alt="Aperçu Photo Véhicule"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('photo_vehicule', 'environment')}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reprendre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => photoVehiculeFileInputRef.current?.click()}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold"
                          >
                            Remplacer
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoVehiculeBase64(null)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded font-bold"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center p-3 text-center text-slate-400 bg-slate-50">
                          <Camera className="w-6 h-6 mb-1 text-slate-300" />
                          <span className="text-[10px] font-medium">Photo du Véhicule</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartCamera('photo_vehicule', 'environment')}
                            className="py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Photo Auto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => photoVehiculeFileInputRef.current?.click()}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>Fichier</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      ref={photoVehiculeFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handlePhotoVehiculeFileChange}
                      className="hidden"
                    />
                    <input
                      ref={mobileCameraPhotoVehiculeRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      capture="environment"
                      onChange={handlePhotoVehiculeFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Enregistrement dans PostgreSQL en cours...'
                    : 'Enregistrer le Véhicule'}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Live PostgreSQL Records Table */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {activeTab === 'drivers'
                  ? 'Répertoire des Conducteurs Enregistrés (PostgreSQL)'
                  : 'Répertoire du Parc Véhicules Enregistré (PostgreSQL)'}
              </h3>
              <p className="text-xs text-slate-500">
                {activeTab === 'drivers'
                  ? `${filteredDrivers.length} dossier(s) conducteur persisté(s) en base centrale`
                  : `${filteredVehicles.length} dossier(s) véhicule persisté(s) en base centrale`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher NIN, Nom, Plaque..."
                  className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none w-full sm:w-48"
                />
              </div>

              {isCommuneLocked ? (
                <span className="px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>{lockedCommune}</span>
                </span>
              ) : (
                <select
                  value={communeFilter}
                  onChange={(e) => setCommuneFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none w-full sm:w-auto"
                >
                  <option value="ALL">Toutes Communes</option>
                  {CONAKRY_COMMUNES.map((comm) => (
                    <option key={comm} value={comm}>
                      {comm}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex-1">
            {isLoading ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                Chargement des dossiers depuis PostgreSQL...
              </div>
            ) : activeTab === 'drivers' ? (
              filteredDrivers.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm">
                  Aucun conducteur trouvé. Utilisez le formulaire à gauche pour enregistrer un conducteur.
                </div>
              ) : (
                <>
                  {/* Mobile Card List for Drivers (< sm screens) */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {filteredDrivers.map((d) => {
                      const docs = d.person?.documents || d.documents || [];
                      const hasPhoto = docs.some((doc) => doc.category === 'PHOTO_PORTRAIT');
                      return (
                        <div key={d.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-extrabold ${
                                  hasPhoto
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {d.person?.firstName?.[0] || 'C'}
                                {d.person?.lastName?.[0] || ''}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-sm truncate">
                                  {d.person?.firstName} {d.person?.lastName}
                                </div>
                                <div className="text-xs text-slate-400 font-mono truncate">
                                  NIN: {d.person?.nin} • {d.person?.commune?.name || 'Conakry'}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0">{renderStatusBadge(d.status)}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Permis</span>
                              <span className="font-mono font-bold text-slate-800">{d.drivingLicenseNumber}</span>
                              <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-bold">
                                Cat. {d.licenseCategory}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Téléphone</span>
                              <span className="font-bold text-slate-800">{d.person?.phoneNumber}</span>
                            </div>
                          </div>

                          {d.emergencyContactPhone && (
                            <div className="text-[11px] font-semibold text-amber-800 flex items-center">
                              <PhoneCall className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
                              <span className="truncate">Urg: {d.emergencyContactPhone} ({d.emergencyContactName || 'Urgence'})</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDriverDetails(d)}
                            className="w-full min-h-[40px] flex items-center justify-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg border border-emerald-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Consulter la Fiche Conducteur</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop / Tablet Table (>= sm screens) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase border-b border-slate-200">
                          <th className="py-3 px-4">Conducteur / NIN</th>
                          <th className="py-3 px-4">Permis</th>
                          <th className="py-3 px-4">Tél. Principal & Urgence</th>
                          <th className="py-3 px-4">Statut</th>
                          <th className="py-3 px-4 text-right">Dossier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredDrivers.map((d) => {
                          const docs = d.person?.documents || d.documents || [];
                          const hasPhoto = docs.some((doc) => doc.category === 'PHOTO_PORTRAIT');
                          return (
                            <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center space-x-2.5">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold ${
                                      hasPhoto
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                    title={hasPhoto ? 'Photo portrait enregistrée' : 'Aucune photo'}
                                  >
                                    {d.person?.firstName?.[0] || 'C'}
                                    {d.person?.lastName?.[0] || ''}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-800">
                                      {d.person?.firstName} {d.person?.lastName}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono">
                                      NIN: {d.person?.nin} • {d.person?.commune?.name || 'Conakry'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-mono text-xs font-bold text-slate-700">
                                  {d.drivingLicenseNumber}
                                </div>
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-extrabold">
                                  Cat. {d.licenseCategory}
                                </span>
                                {d.union && (
                                  <span className="ml-1.5 inline-block mt-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-extrabold font-mono" title={d.union.name}>
                                    {d.union.code}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="text-xs font-bold text-slate-800">
                                  Tél: {d.person?.phoneNumber}
                                </div>
                                {d.emergencyContactPhone ? (
                                  <div className="text-[11px] font-semibold text-amber-800 mt-0.5 flex items-center">
                                    <PhoneCall className="w-3 h-3 mr-1 text-amber-600 shrink-0" />
                                    <span>
                                      Urg: {d.emergencyContactPhone}
                                      {d.emergencyContactName ? ` (${d.emergencyContactName})` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic">
                                    Urgence: Non renseigné
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4">{renderStatusBadge(d.status)}</td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDriverDetails(d)}
                                  className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Consulter
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : filteredVehicles.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                Aucun véhicule trouvé. Utilisez le formulaire à gauche pour enregistrer un véhicule.
              </div>
            ) : (
              <>
                {/* Mobile Card List for Vehicles (< sm screens) */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredVehicles.map((v) => {
                    const activeDriver = v.assignments?.[0]?.driver;
                    return (
                      <div key={v.id} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono font-extrabold text-slate-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded inline-block text-xs">
                              {v.plateNumber}
                            </div>
                            <div className="font-bold text-slate-800 text-sm mt-1">
                              {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                            </div>
                          </div>
                          <div className="shrink-0">{renderStatusBadge(v.status)}</div>
                        </div>

                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {v.atrNumber ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              ATR: {v.atrNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sans ATR</span>
                          )}
                          {v.aotucLicenseNumber && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                              LIC: {v.aotucLicenseNumber}
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            {VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                          <div>
                            <span className="text-slate-400 font-bold">Propriétaire: </span>
                            <span className="font-semibold text-slate-800">
                              {v.owner?.person?.firstName} {v.owner?.person?.lastName}
                            </span>
                          </div>
                          {activeDriver && (
                            <div className="text-emerald-700 flex items-center">
                              <UserCheck className="w-3 h-3 mr-1" />
                              <span>Chauffeur: {activeDriver.person?.firstName} {activeDriver.person?.lastName}</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenVehicleDetails(v)}
                          className="w-full min-h-[40px] flex items-center justify-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg border border-emerald-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Consulter la Fiche Véhicule</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop / Tablet Table (>= sm screens) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase border-b border-slate-200">
                        <th className="py-3 px-4">Plaque / Châssis / Identifiants</th>
                        <th className="py-3 px-4">Véhicule / Type</th>
                        <th className="py-3 px-4">Propriétaire & Chauffeur</th>
                        <th className="py-3 px-4">Statut</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredVehicles.map((v) => {
                        const activeDriver = v.assignments?.[0]?.driver;
                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-extrabold text-slate-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded inline-block text-xs">
                                {v.plateNumber}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                VIN: {v.chassisVin} • CG: {v.registrationCardNumber}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {v.atrNumber ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300" title="Numéro officiel d'autorisation du transporteur en Guinée">
                                    ATR: {v.atrNumber}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Sans ATR</span>
                                )}
                                {v.aotucLicenseNumber && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300" title="Numéro de licence d'exploitation AOTUC">
                                    LIC: {v.aotucLicenseNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-800 text-xs">
                                {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                              </div>
                              <div className="text-xs text-slate-500">
                                {VEHICLE_TYPE_LABELS[v.vehicleType] || v.vehicleType}
                                {v.seatingCapacity ? ` • ${v.seatingCapacity} places` : ''}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-bold text-slate-800">
                                Prop: {v.owner?.person?.firstName} {v.owner?.person?.lastName}
                                {v.owner?.businessName ? ` (${v.owner.businessName})` : ''}
                              </div>
                              {activeDriver ? (
                                <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Chauffeur: {activeDriver.person?.firstName}{' '}
                                  {activeDriver.person?.lastName}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400">
                                   {v.owner?.person?.commune?.name || 'Conakry'}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">{renderStatusBadge(v.status)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenVehicleDetails(v)}
                                className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Consulter
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Driver Details / Profile Modal (Shows Photograph & Emergency Contact Information) */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block truncate">
                  Fiche Officielle Conducteur • PostgreSQL
                </span>
                <h4 className="text-sm sm:text-base font-extrabold truncate">
                  {selectedDriver.person?.firstName} {selectedDriver.person?.lastName}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleCloseDriverDetails}
                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {/* Top Profile Row with Photograph */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                {selectedDriverPhotoUrl ? (
                  <img
                    src={selectedDriverPhotoUrl}
                    alt="Portrait officiel du conducteur"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-500 shrink-0">
                    <Camera className="w-6 h-6 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold">Sans photo</span>
                  </div>
                )}

                <div className="space-y-1 sm:space-y-1.5 min-w-0 flex-1">
                  <div>{renderStatusBadge(selectedDriver.status)}</div>
                  <div className="text-xs font-mono text-slate-600 truncate">
                    <strong>ID Base :</strong> {selectedDriver.id}
                  </div>
                  <div className="text-xs font-mono text-slate-700 truncate">
                    <strong>NIN :</strong> {selectedDriver.person?.nin}
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    <strong>Commune :</strong>{' '}
                    {selectedDriver.person?.commune?.name || 'Conakry'}
                  </div>
                </div>
              </div>

              {/* Primary Phone vs Emergency Contact Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                    Téléphone Principal (Chauffeur)
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1 font-mono">
                    {selectedDriver.person?.phoneNumber}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ligne directe du conducteur
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-extrabold uppercase text-amber-800 flex items-center">
                    <PhoneCall className="w-3 h-3 mr-1 text-amber-700" />
                    Contact en Cas d'Urgence
                  </span>
                  {selectedDriver.emergencyContactPhone ? (
                    <>
                      <p className="text-sm font-extrabold text-amber-950 mt-1 font-mono">
                        {selectedDriver.emergencyContactPhone}
                      </p>
                      <p className="text-xs font-semibold text-amber-900 mt-0.5">
                        {selectedDriver.emergencyContactName || 'Contact désigné'}
                        {selectedDriver.emergencyContactRelation
                          ? ` • ${selectedDriver.emergencyContactRelation}`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-1">
                      Aucun numéro d'urgence enregistré
                    </p>
                  )}
                </div>
              </div>

              {/* Driver Syndicat Affiliation Display */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-bold block">Syndicat / Organisation Affiliée</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDriver.union ? `${selectedDriver.union.code} — ${selectedDriver.union.name}` : 'Indépendant (Aucune affiliation)'}
                  </span>
                </div>
                {selectedDriver.union && (
                  <span className="px-2 py-0.5 font-mono font-extrabold text-[11px] rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {selectedDriver.union.code}
                  </span>
                )}
              </div>

              {/* License Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">N° Permis</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDriver.drivingLicenseNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Catégorie</span>
                  <span className="font-bold text-slate-800">
                    Catégorie {selectedDriver.licenseCategory}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Expiration</span>
                  <span className="font-bold text-slate-800">
                    {selectedDriver.licenseExpirationDate
                      ? new Date(selectedDriver.licenseExpirationDate).toLocaleDateString('fr-FR')
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Digitized Driving Licence Document Previews (Front & Back) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    Permis de Conduire Numérisé (Documents Officiels)
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Stockage Sécurisé PostgreSQL & Disque
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Face Avant (Recto) */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700">Face Avant (Recto)</span>
                      {selectedDriverLicenceRectoUrl && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          ✓ Vérifié
                        </span>
                      )}
                    </div>
                    {selectedDriverLicenceRectoUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                        <img
                          src={selectedDriverLicenceRectoUrl}
                          alt="Permis de conduire - Recto"
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                          onClick={() => window.open(selectedDriverLicenceRectoUrl, '_blank')}
                        />
                        <a
                          href={selectedDriverLicenceRectoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold rounded flex items-center space-x-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Plein écran</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                        <FileText className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[11px] font-medium">Aucun scan recto joint</span>
                      </div>
                    )}
                  </div>

                  {/* Face Arrière (Verso) */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700">Face Arrière (Verso)</span>
                      {selectedDriverLicenceVersoUrl && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          ✓ Vérifié
                        </span>
                      )}
                    </div>
                    {selectedDriverLicenceVersoUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                        <img
                          src={selectedDriverLicenceVersoUrl}
                          alt="Permis de conduire - Verso"
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                          onClick={() => window.open(selectedDriverLicenceVersoUrl, '_blank')}
                        />
                        <a
                          href={selectedDriverLicenceVersoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold rounded flex items-center space-x-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Plein écran</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                        <FileText className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[11px] font-medium">Aucun scan verso joint</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CNI Preview if attached */}
              {selectedDriverCniUrl && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 block">
                    Pièce d'Identité Nationale (CNI / Passeport)
                  </span>
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100 max-w-xs">
                    <img
                      src={selectedDriverCniUrl}
                      alt="CNI du conducteur"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => window.open(selectedDriverCniUrl, '_blank')}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseDriverDetails}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                >
                  Fermer la fiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Details / Profile Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block truncate">
                  Fiche Officielle Véhicule • PostgreSQL
                </span>
                <h4 className="text-sm sm:text-base font-extrabold truncate">
                  {selectedVehicle.make} {selectedVehicle.model} — {selectedVehicle.plateNumber}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleCloseVehicleDetails}
                className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Top Overview Row */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                {selectedVehiclePhotoUrl ? (
                  <img
                    src={selectedVehiclePhotoUrl}
                    alt="Photo du véhicule"
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-500 shrink-0">
                    <Car className="w-7 h-7 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold">Sans photo</span>
                  </div>
                )}

                <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {renderStatusBadge(selectedVehicle.status)}
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate">
                      {VEHICLE_TYPE_LABELS[selectedVehicle.vehicleType] || selectedVehicle.vehicleType}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-600 truncate">
                    <strong>Plaque :</strong> {selectedVehicle.plateNumber}
                  </div>
                  <div className="text-xs font-mono text-slate-700 truncate">
                    <strong>VIN :</strong> {selectedVehicle.chassisVin}
                  </div>
                  <div className="text-xs font-mono text-slate-600 truncate">
                    <strong>Carte Grise :</strong> {selectedVehicle.registrationCardNumber}
                  </div>
                </div>
              </div>

              {/* Dedicated Identifiers: Numéro ATR vs Numéro de licence AOTUC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-extrabold uppercase text-amber-900 block flex items-center">
                    <Shield className="w-3 h-3 mr-1 text-amber-700" />
                    Numéro ATR
                  </span>
                  <p className="text-sm font-extrabold text-amber-950 mt-1 font-mono">
                    {selectedVehicle.atrNumber || (
                      <span className="text-xs font-normal italic text-slate-400">Non renseigné</span>
                    )}
                  </p>
                  <p className="text-[10px] text-amber-800/80 mt-0.5">
                    Autorisation officielle de transporteur en Guinée
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-900 block flex items-center">
                    <BadgeCheck className="w-3 h-3 mr-1 text-emerald-700" />
                    Numéro Licence AOTUC
                  </span>
                  <p className="text-sm font-extrabold text-emerald-950 mt-1 font-mono">
                    {selectedVehicle.aotucLicenseNumber || (
                      <span className="text-xs font-normal italic text-slate-400">Non renseigné</span>
                    )}
                  </p>
                  <p className="text-[10px] text-emerald-800/80 mt-0.5">
                    Licence officielle d'exploitation AOTUC
                  </p>
                </div>
              </div>

              {/* Technical Attributes */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Marque / Modèle</span>
                  <span className="font-bold text-slate-800">{selectedVehicle.make} {selectedVehicle.model}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Année</span>
                  <span className="font-bold text-slate-800">{selectedVehicle.year || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Capacité</span>
                  <span className="font-bold text-slate-800">
                    {selectedVehicle.seatingCapacity ? `${selectedVehicle.seatingCapacity} places` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Legal Owner & Driver */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Propriétaire Légal</span>
                  <span className="font-semibold text-slate-800">
                    {selectedVehicle.owner?.person?.firstName} {selectedVehicle.owner?.person?.lastName}
                    {selectedVehicle.owner?.businessName ? ` (${selectedVehicle.owner.businessName})` : ''}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    NIN: {selectedVehicle.owner?.person?.nin} • Tél: {selectedVehicle.owner?.person?.phoneNumber}
                  </span>
                </div>
                {selectedVehicle.assignments?.[0]?.driver && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-400 font-bold block">Chauffeur Titulaire Assigné</span>
                    <span className="font-semibold text-emerald-800 flex items-center">
                      <UserCheck className="w-3 h-3 mr-1" />
                      {selectedVehicle.assignments[0].driver.person?.firstName}{' '}
                      {selectedVehicle.assignments[0].driver.person?.lastName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      Permis: {selectedVehicle.assignments[0].driver.drivingLicenseNumber}
                    </span>
                  </div>
                )}
              </div>

              {/* Digitized Vehicle Documents */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    Documents Officiels Numérisés
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Stockage Sécurisé PostgreSQL & Disque
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Carte Grise */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700">Carte Grise</span>
                      {selectedVehicleCarteGriseUrl && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          ✓ Vérifié
                        </span>
                      )}
                    </div>
                    {selectedVehicleCarteGriseUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                        <img
                          src={selectedVehicleCarteGriseUrl}
                          alt="Carte Grise du véhicule"
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                          onClick={() => window.open(selectedVehicleCarteGriseUrl, '_blank')}
                        />
                        <a
                          href={selectedVehicleCarteGriseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold rounded flex items-center space-x-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Plein écran</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                        <FileText className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[11px] font-medium">Aucun scan carte grise</span>
                      </div>
                    )}
                  </div>

                  {/* Photo Véhicule */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-700">Photo du Véhicule</span>
                      {selectedVehiclePhotoUrl && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          ✓ Vérifié
                        </span>
                      )}
                    </div>
                    {selectedVehiclePhotoUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-100">
                        <img
                          src={selectedVehiclePhotoUrl}
                          alt="Photographie du véhicule"
                          className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                          onClick={() => window.open(selectedVehiclePhotoUrl, '_blank')}
                        />
                        <a
                          href={selectedVehiclePhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-bold rounded flex items-center space-x-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Plein écran</span>
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 aspect-[16/10] flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                        <Camera className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[11px] font-medium">Aucune photo véhicule</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseVehicleDetails}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg"
                >
                  Fermer la fiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Offline Queue Modal */}
      <OfflineQueueModal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        drafts={agentDrafts}
        isSyncing={isSyncing}
        isOnline={isOnline}
        onTriggerSync={async () => {
          const res = await syncManager.syncPendingDrafts();
          if (res.success && res.synced > 0) {
            setShowSuccessBanner(
              `✓ Synchronisation réussie : ${res.synced} dossier(s) enregistrés dans PostgreSQL.`
            );
            fetchAllRegistrationData();
          } else if (!res.success && res.failed > 0) {
            setErrorMessage(`Attention : ${res.message}`);
          }
          const updated = await listAgentDrafts(activeUserId);
          setAgentDrafts(updated);
        }}
        onDeleteDraft={async (clientId) => {
          await deleteOfflineDraft(clientId, activeUserId);
          const updated = await listAgentDrafts(activeUserId);
          setAgentDrafts(updated);
        }}
        onClearSynced={async () => {
          const synced = agentDrafts.filter((d) => d.syncStatus === 'SYNCED');
          for (const s of synced) {
            await deleteOfflineDraft(s.clientGeneratedId, activeUserId);
          }
          const updated = await listAgentDrafts(activeUserId);
          setAgentDrafts(updated);
        }}
      />
    </div>
  );
};

export default RegistrationDesk;

