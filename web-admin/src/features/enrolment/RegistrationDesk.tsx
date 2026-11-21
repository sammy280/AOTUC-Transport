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
} from 'lucide-react';
import { UserContext } from '../../types';
import { buildApiUrl, getStoredAuthToken, parseApiResponse } from '../../utils/api';

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
  vehicleType: string;
  make: string;
  model: string;
  year?: number | null;
  seatingCapacity?: number | null;
  status: string;
  createdAt: string;
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

  // Driver Details Modal state
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null);
  const [selectedDriverPhotoUrl, setSelectedDriverPhotoUrl] = useState<string | null>(null);

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

  // Driver Photograph (Camera capture or uploaded image)
  const [driverPhotoBase64, setDriverPhotoBase64] = useState<string | null>(null);
  const [driverPhotoName, setDriverPhotoName] = useState<string>('photo_chauffeur.jpg');
  const [driverPhotoMime, setDriverPhotoMime] = useState<string>('image/jpeg');
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Supporting Document names (CNI / Permis optional attachment)
  const [extraDocBase64, setExtraDocBase64] = useState<string | null>(null);
  const [extraDocName, setExtraDocName] = useState<string>('');
  const [extraDocMime, setExtraDocMime] = useState<string>('image/jpeg');

  // Vehicle Form State
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [newOwnerFirstName, setNewOwnerFirstName] = useState('');
  const [newOwnerLastName, setNewOwnerLastName] = useState('');
  const [newOwnerNin, setNewOwnerNin] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerType, setNewOwnerType] = useState<'INDIVIDU' | 'ENTREPRISE'>('INDIVIDU');
  const [newOwnerBusinessName, setNewOwnerBusinessName] = useState('');

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleRegistrationCard, setVehicleRegistrationCard] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
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

      const [driversRes, vehiclesRes, ownersRes] = await Promise.all([
        fetch(buildApiUrl('/api/v1/registration/drivers?limit=100'), { headers }),
        fetch(buildApiUrl('/api/v1/registration/vehicles?limit=100'), { headers }),
        fetch(buildApiUrl('/api/v1/registration/owners?limit=100'), { headers }),
      ]);

      const [driversBody, vehiclesBody, ownersBody] = await Promise.all([
        parseApiResponse<any>(driversRes),
        parseApiResponse<any>(vehiclesRes),
        parseApiResponse<any>(ownersRes),
      ]);

      if (driversRes.ok && driversBody?.data?.items) {
        setDrivers(driversBody.data.items);
      }
      if (vehiclesRes.ok && vehiclesBody?.data?.items) {
        setVehicles(vehiclesBody.data.items);
      }
      if (ownersRes.ok && ownersBody?.data?.items) {
        const loadedOwners: OwnerRecord[] = ownersBody.data.items;
        setOwners(loadedOwners);
        if (loadedOwners.length > 0) {
          setSelectedOwnerId((prev) => prev || loadedOwners[0].id);
          setOwnerMode('existing');
        } else {
          setOwnerMode('new');
        }
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Impossible de charger les dossiers depuis le serveur PostgreSQL.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRegistrationData();
  }, [fetchAllRegistrationData]);

  // Start device camera via WebRTC getUserMedia with fallback for desktop/mobile webcams
  const handleStartCamera = async (preferredFacing?: 'user' | 'environment') => {
    setCameraError(null);
    const targetFacing = preferredFacing || cameraFacingMode;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback to native HTML5 camera capture input on mobile browsers
      if (mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click();
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
          video: { facingMode: targetFacing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (_) {
        // Fallback if webcam does not support facingMode or resolution constraints
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
        // Trigger native OS camera capture input as fallback if available
        setCameraError(
          "Caméra WebRTC indisponible ou occupée. Utilisez le bouton « Choisir une Image » ou l'appareil photo natif."
        );
      }
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    handleStartCamera(nextFacing);
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
    setDriverPhotoBase64(dataUrl);
    setDriverPhotoName(`portrait_${Date.now()}.jpg`);
    setDriverPhotoMime('image/jpeg');
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

  const handleExtraDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Le document justificatif dépasse la taille maximale autorisée (5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setExtraDocBase64(reader.result);
        setExtraDocName(file.name);
        setExtraDocMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenDriverDetails = async (driver: DriverRecord) => {
    setSelectedDriver(driver);
    setSelectedDriverPhotoUrl(null);

    const allDocs = driver.person?.documents || driver.documents || [];
    const portraitDoc = allDocs.find((d) => d.category === 'PHOTO_PORTRAIT') || allDocs[0];
    if (!portraitDoc) return;

    const token = getStoredAuthToken();
    if (!token) return;

    try {
      const res = await fetch(buildApiUrl(`/api/v1/documents/${portraitDoc.id}/download`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setSelectedDriverPhotoUrl(objectUrl);
      }
    } catch (_) {
      // Ignore image fetch failure
    }
  };

  const handleCloseDriverDetails = () => {
    if (selectedDriverPhotoUrl) {
      URL.revokeObjectURL(selectedDriverPhotoUrl);
    }
    setSelectedDriver(null);
    setSelectedDriverPhotoUrl(null);
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

    if (extraDocBase64) {
      inlineDocuments.push({
        category: 'PERMIS_CONDUIRE',
        originalName: extraDocName || 'permis_conduire.jpg',
        mimeType: extraDocMime || 'image/jpeg',
        base64Data: extraDocBase64,
      });
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

      // Reset form fields only after confirmed DB persistence
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
      setExtraDocBase64(null);
      setExtraDocName('');

      setShowSuccessBanner(
        `✓ Conducteur "${persistedDriver.person?.firstName || trimmedFirst} ${persistedDriver.person?.lastName || trimmedLast}" enregistré dans PostgreSQL (ID : ${persistedDriver.id.slice(0, 8).toUpperCase()})`
      );

      // Refresh live list from PostgreSQL
      await fetchAllRegistrationData();
    } catch (err: any) {
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
          vehicleType,
          make: cleanedMake,
          model: cleanedModel,
          year: vehicleYear ? Number(vehicleYear) : null,
          seatingCapacity: vehicleCapacity ? Number(vehicleCapacity) : null,
          commune: isCommuneLocked ? lockedCommune : vehicleCommune,
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

      setVehiclePlate('');
      setVehicleRegistrationCard('');
      setVehicleVin('');
      setVehicleMake('');
      setVehicleModel('');
      setVehicleDriverId('');
      setNewOwnerFirstName('');
      setNewOwnerLastName('');
      setNewOwnerNin('');
      setNewOwnerPhone('');
      setNewOwnerBusinessName('');

      setShowSuccessBanner(
        `✓ Véhicule "${persistedVehicle.plateNumber}" enregistré dans PostgreSQL (ID : ${persistedVehicle.id.slice(0, 8).toUpperCase()})`
      );

      await fetchAllRegistrationData();
    } catch (err: any) {
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
            <form onSubmit={handleRegisterDriver} className="p-6 space-y-4">
              {/* Driver Identity */}
              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
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

              <div className="grid grid-cols-2 gap-3">
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
                      <option value="Kaloum">Kaloum</option>
                      <option value="Dixinn">Dixinn</option>
                      <option value="Matam">Matam</option>
                      <option value="Ratoma">Ratoma</option>
                      <option value="Matoto">Matoto</option>
                    </select>
                  )}
                </div>
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
                          onClick={() => handleStartCamera()}
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
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{driverPhotoBase64 ? 'Reprendre (Caméra)' : 'Prendre une Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
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

              {/* Optional Supporting Document (CNI / Permis) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Copie CNI ou Permis (Optionnel)
                </label>
                <label className="border border-dashed border-slate-300 rounded-lg p-2.5 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer block">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleExtraDocChange}
                    className="hidden"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {extraDocName
                      ? `✓ Pièce jointe : ${extraDocName}`
                      : 'Cliquez pour joindre un scan CNI / Permis (Max 5 Mo)'}
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
            <form onSubmit={handleRegisterVehicle} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-3 gap-3">
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
                      <option value="Kaloum">Kaloum</option>
                      <option value="Dixinn">Dixinn</option>
                      <option value="Matam">Matam</option>
                      <option value="Ratoma">Ratoma</option>
                      <option value="Matoto">Matoto</option>
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
                    <div className="grid grid-cols-2 gap-2.5">
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
                    <div className="grid grid-cols-2 gap-2.5">
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
                    <div className="grid grid-cols-2 gap-2.5">
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

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher NIN, Nom, Plaque..."
                  className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none w-48"
                />
              </div>

              {isCommuneLocked ? (
                <span className="px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>{lockedCommune}</span>
                </span>
              ) : (
                <select
                  value={communeFilter}
                  onChange={(e) => setCommuneFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="ALL">Toutes Communes</option>
                  <option value="Kaloum">Kaloum</option>
                  <option value="Dixinn">Dixinn</option>
                  <option value="Matam">Matam</option>
                  <option value="Ratoma">Ratoma</option>
                  <option value="Matoto">Matoto</option>
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
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
              )
            ) : filteredVehicles.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                Aucun véhicule trouvé. Utilisez le formulaire à gauche pour enregistrer un véhicule.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Plaque / Châssis (VIN)</th>
                    <th className="py-3 px-4">Véhicule / Type</th>
                    <th className="py-3 px-4">Propriétaire & Chauffeur</th>
                    <th className="py-3 px-4">Statut</th>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Driver Details / Profile Modal (Shows Photograph & Emergency Contact Information) */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                  Fiche Officielle Conducteur • PostgreSQL
                </span>
                <h4 className="text-base font-extrabold">
                  {selectedDriver.person?.firstName} {selectedDriver.person?.lastName}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleCloseDriverDetails}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Top Profile Row with Photograph */}
              <div className="flex items-center space-x-4">
                {selectedDriverPhotoUrl ? (
                  <img
                    src={selectedDriverPhotoUrl}
                    alt="Portrait officiel du conducteur"
                    className="w-24 h-24 rounded-xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-300 flex flex-col items-center justify-center text-slate-500 shrink-0">
                    <Camera className="w-6 h-6 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold">Sans photo</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div>{renderStatusBadge(selectedDriver.status)}</div>
                  <div className="text-xs font-mono text-slate-600">
                    <strong>ID Base :</strong> {selectedDriver.id}
                  </div>
                  <div className="text-xs font-mono text-slate-700">
                    <strong>NIN :</strong> {selectedDriver.person?.nin}
                  </div>
                  <div className="text-xs text-slate-600">
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

              {/* License Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-xs">
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
    </div>
  );
};

export default RegistrationDesk;

