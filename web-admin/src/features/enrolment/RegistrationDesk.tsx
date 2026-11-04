import React, { useState } from 'react';
import {
  UserPlus,
  Car,
  Users,
  Upload,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
} from 'lucide-react';
import { UserContext } from '../../types';

interface DriverRegistration {
  id: string;
  dossierNumber: string;
  fullName: string;
  nin: string;
  phone: string;
  licenseNumber: string;
  categories: string;
  commune: string;
  status: 'SOUMIS_NIVEAU2' | 'BROUILLON' | 'VALIDE' | 'RETOURNE_POUR_CORRECTION';
  submittedAt: string;
}

interface VehicleRegistration {
  id: string;
  dossierNumber: string;
  plateNumber: string;
  chassisNumber: string;
  makeModel: string;
  category: string;
  seats: number;
  commune: string;
  ownerName: string;
  status: 'SOUMIS_NIVEAU2' | 'BROUILLON' | 'VALIDE';
  submittedAt: string;
}

const SAMPLE_DRIVERS: DriverRegistration[] = [
  {
    id: 'd1',
    dossierNumber: 'DOS-2026-00441',
    fullName: 'Thierno Mamadou Bah',
    nin: '1991041500892',
    phone: '+224 622 11 22 33',
    licenseNumber: 'PC-GN-2017-9912',
    categories: 'B, C1',
    commune: 'Matoto',
    status: 'SOUMIS_NIVEAU2',
    submittedAt: 'Aujourd hui à 11:24',
  },
  {
    id: 'd2',
    dossierNumber: 'DOS-2026-00440',
    fullName: 'Ibrahima Sory Bangoura',
    nin: '1987082100412',
    phone: '+224 628 44 55 66',
    licenseNumber: 'PC-GN-2014-4102',
    categories: 'B',
    commune: 'Kaloum',
    status: 'VALIDE',
    submittedAt: 'Hier à 16:45',
  },
  {
    id: 'd3',
    dossierNumber: 'DOS-2026-00439',
    fullName: 'Karamoko Camara',
    nin: '1994020300119',
    phone: '+224 664 33 22 11',
    licenseNumber: 'PC-GN-2019-1088',
    categories: 'B',
    commune: 'Ratoma',
    status: 'RETOURNE_POUR_CORRECTION',
    submittedAt: '03/11/2026 à 09:15',
  },
];

const SAMPLE_VEHICLES: VehicleRegistration[] = [
  {
    id: 'v1',
    dossierNumber: 'VEH-2026-00192',
    plateNumber: 'RC-8412-B',
    chassisNumber: 'JT123456789ABCDEF',
    makeModel: 'Toyota HiAce (Magbana)',
    category: 'MINIBUS_URBAIN',
    seats: 18,
    commune: 'Matoto',
    ownerName: 'El Hadj Ousmane Sow',
    status: 'SOUMIS_NIVEAU2',
    submittedAt: 'Aujourd hui à 10:15',
  },
  {
    id: 'v2',
    dossierNumber: 'VEH-2026-00191',
    plateNumber: 'RC-4211-C',
    chassisNumber: 'VF123456789UVWXYZ',
    makeModel: 'Renault Laguna (Taxi Jaune)',
    category: 'TAXI_COMMUNAL',
    seats: 5,
    commune: 'Kaloum',
    ownerName: 'Mamadou Bhoye Diallo',
    status: 'VALIDE',
    submittedAt: 'Hier à 14:20',
  },
];

export const RegistrationDesk: React.FC<{ currentUser: UserContext }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'drivers' | 'vehicles' | 'new-driver' | 'new-vehicle'>('drivers');
  const [drivers, setDrivers] = useState<DriverRegistration[]>(SAMPLE_DRIVERS);
  const [vehicles, setVehicles] = useState<VehicleRegistration[]>(SAMPLE_VEHICLES);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Driver Form State
  const [driverPrenom, setDriverPrenom] = useState('');
  const [driverNom, setDriverNom] = useState('');
  const [driverNin, setDriverNin] = useState('');
  const [driverPhone, setDriverPhone] = useState('+224 ');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverCategory, setDriverCategory] = useState('B');
  const [driverCommune, setDriverCommune] = useState(currentUser.communeName || 'Matoto');

  // New Vehicle Form State
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState('MINIBUS_URBAIN');
  const [vehicleSeats, setVehicleSeats] = useState(18);
  const [vehicleOwner, setVehicleOwner] = useState('');
  const [vehicleCommune, setVehicleCommune] = useState(currentUser.communeName || 'Matoto');

  const handleRegisterDriver = (e: React.FormEvent) => {
    e.preventDefault();

    // Check NIN duplicate
    if (drivers.some((d) => d.nin === driverNin.trim())) {
      alert(`Un conducteur avec le NIN "${driverNin}" est déjà enregistré dans le fichier central !`);
      return;
    }

    const newDriver: DriverRegistration = {
      id: `d-${Date.now()}`,
      dossierNumber: `DOS-2026-${Date.now().toString().slice(-5)}`,
      fullName: `${driverPrenom.trim()} ${driverNom.trim()}`,
      nin: driverNin.trim(),
      phone: driverPhone.trim(),
      licenseNumber: driverLicense.trim().toUpperCase(),
      categories: driverCategory,
      commune: driverCommune,
      status: 'SOUMIS_NIVEAU2',
      submittedAt: 'À l instant',
    };

    setDrivers([newDriver, ...drivers]);
    setActiveTab('drivers');
    setFeedback(`✓ Dossier conducteur ${newDriver.dossierNumber} (${newDriver.fullName}) créé avec succès et transmis au Chef de Service (${driverCommune}) pour examen Niveau 2.`);

    // Reset Form
    setDriverPrenom('');
    setDriverNom('');
    setDriverNin('');
    setDriverLicense('');
    setDriverPhone('+224 ');
  };

  const handleRegisterVehicle = (e: React.FormEvent) => {
    e.preventDefault();

    // Check Plate duplicate
    const cleanPlate = vehiclePlate.trim().toUpperCase();
    if (vehicles.some((v) => v.plateNumber === cleanPlate)) {
      alert(`Le véhicule immatriculé "${cleanPlate}" existe déjà dans le registre !`);
      return;
    }

    const newVehicle: VehicleRegistration = {
      id: `v-${Date.now()}`,
      dossierNumber: `VEH-2026-${Date.now().toString().slice(-5)}`,
      plateNumber: cleanPlate,
      chassisNumber: vehicleVin.trim().toUpperCase(),
      makeModel: vehicleMakeModel.trim(),
      category: vehicleCategory,
      seats: vehicleSeats,
      commune: vehicleCommune,
      ownerName: vehicleOwner.trim(),
      status: 'SOUMIS_NIVEAU2',
      submittedAt: 'À l instant',
    };

    setVehicles([newVehicle, ...vehicles]);
    setActiveTab('vehicles');
    setFeedback(`✓ Dossier véhicule ${newVehicle.dossierNumber} (${newVehicle.plateNumber}) créé avec succès et transmis au Chef de Service (${vehicleCommune}) pour examen Niveau 2.`);

    // Reset Form
    setVehiclePlate('');
    setVehicleVin('');
    setVehicleMakeModel('');
    setVehicleOwner('');
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.nin.includes(searchTerm)
  );

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.chassisNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <img
            src="/logo-guinee.png"
            alt="Sceau Officiel République de Guinée"
            className="w-11 h-11 rounded-full object-contain p-0.5 border border-slate-200 shadow-sm flex-shrink-0"
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              RÉPUBLIQUE DE GUINÉE • MINISTÈRE DES TRANSPORTS
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Bureau d Enrôlement & Registre Centralisé (Niveau 1)
            </h1>
            <p className="text-xs text-slate-500">
              Immatriculation des conducteurs, véhicules de transport urbain et propriétaires • Opérateur: <span className="font-semibold text-slate-700">{currentUser.name}</span> ({currentUser.communeName || 'Toutes Communes'})
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setActiveTab('drivers');
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'drivers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Conducteurs ({drivers.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('vehicles');
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'vehicles'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Véhicules ({vehicles.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('new-driver');
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'new-driver'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Enrôler Conducteur</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('new-vehicle');
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'new-vehicle'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>+ Enrôler Véhicule</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center space-x-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Tab 1: Drivers List */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, NIN, permis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Affichage de {filteredDrivers.length} conducteur(s)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">N° Dossier</th>
                  <th className="p-3">Conducteur</th>
                  <th className="p-3">NIN & Contact</th>
                  <th className="p-3">N° Permis</th>
                  <th className="p-3">Commune</th>
                  <th className="p-3">Date de Soumission</th>
                  <th className="p-3">Statut Pipeline</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{d.dossierNumber}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{d.fullName}</div>
                      <div className="text-[10px] text-slate-400">Catégorie: {d.categories}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-slate-700">{d.nin}</div>
                      <div className="text-[10px] text-slate-500">{d.phone}</div>
                    </td>
                    <td className="p-3 font-mono font-semibold text-slate-800">{d.licenseNumber}</td>
                    <td className="p-3 text-slate-700">{d.commune}</td>
                    <td className="p-3 text-slate-500 text-[11px]">{d.submittedAt}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'VALIDE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'SOUMIS_NIVEAU2'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.status === 'SOUMIS_NIVEAU2' ? 'En Attente Niveau 2' : d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => alert(`Détails complets du dossier ${d.dossierNumber} (${d.fullName}).`)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Consulter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Vehicles List */}
      {activeTab === 'vehicles' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par immatriculation, châssis, propriétaire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Affichage de {filteredVehicles.length} véhicule(s)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-3">N° Dossier</th>
                  <th className="p-3">Immatriculation</th>
                  <th className="p-3">Marque & Modèle</th>
                  <th className="p-3">Châssis (VIN)</th>
                  <th className="p-3">Propriétaire</th>
                  <th className="p-3">Capacité</th>
                  <th className="p-3">Commune</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-slate-900">{v.dossierNumber}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{v.plateNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{v.makeModel}</div>
                      <div className="text-[10px] text-slate-400">{v.category}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-600 text-[11px]">{v.chassisNumber}</td>
                    <td className="p-3 text-slate-800">{v.ownerName}</td>
                    <td className="p-3 font-bold text-slate-800">{v.seats} places</td>
                    <td className="p-3 text-slate-700">{v.commune}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.status === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status === 'SOUMIS_NIVEAU2' ? 'En Attente Niveau 2' : v.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => alert(`Dossier technique véhicule ${v.plateNumber}.`)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                      >
                        Consulter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: New Driver Form */}
      {activeTab === 'new-driver' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-2xl mx-auto">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Formulaire d Enrôlement Chauffeur (Niveau 1)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Saisie initiale effectuée par l agent de terrain ou l agent communal. Le dossier sera soumis au Chef de Service pour validation Niveau 2.
            </p>
          </div>

          <form onSubmit={handleRegisterDriver} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mamadou Lamarana"
                  value={driverPrenom}
                  onChange={(e) => setDriverPrenom(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de famille *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Diallo"
                  value={driverNom}
                  onChange={(e) => setDriverNom(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Téléphone Guinéen (+224) *</label>
                <input
                  type="text"
                  required
                  placeholder="+224 6XX XX XX XX"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">N° Identification Nationale (NIN) *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: 1990031500124 (13 chiffres)"
                  value={driverNin}
                  onChange={(e) => setDriverNin(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">N° Permis de Conduire *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: PC-GN-2020-008412"
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catégorie</label>
                <select
                  value={driverCategory}
                  onChange={(e) => setDriverCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold"
                >
                  <option value="B">B (Taxi / Voiture)</option>
                  <option value="B, C1">B, C1 (Minibus Magbana)</option>
                  <option value="B, D">B, D (Autocar)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Commune d Affectation / Domicile *</label>
              <select
                value={driverCommune}
                onChange={(e) => setDriverCommune(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
              >
                <option value="Kaloum">Kaloum (Centre Administratif)</option>
                <option value="Dixinn">Dixinn</option>
                <option value="Matam">Matam</option>
                <option value="Ratoma">Ratoma</option>
                <option value="Matoto">Matoto (Grand Marché & Hub)</option>
              </select>
            </div>

            {/* Document Upload Placeholder */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 text-center space-y-2">
              <Upload className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">Pièces Justificatives (Inspection Magic-Bytes)</div>
              <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                Photo d identité HD, copie couleur recto/verso du permis de conduire et attestation d affiliation syndicale (formats JPEG, PNG, PDF sécurisés).
              </p>
              <button
                type="button"
                onClick={() => alert('Sélectionnez les documents à téléverser (contrôle binaire activé).')}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Parcourir les fichiers...
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('drivers')}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5"
              >
                <span>Soumettre au Niveau 2</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: New Vehicle Form */}
      {activeTab === 'new-vehicle' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-2xl mx-auto">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Car className="w-4 h-4 text-emerald-600" />
              <span>Formulaire d Enrôlement Véhicule de Transport (Niveau 1)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enregistrement technique du véhicule. Un contrôle de non-duplication d immatriculation et de numéro de châssis est effectué automatiquement.
            </p>
          </div>

          <form onSubmit={handleRegisterVehicle} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Numéro d Immatriculation (Plaque) *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: RC-9844-AB"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Numéro de Châssis (VIN 17 car.) *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: JT1234567890ABCDE"
                  value={vehicleVin}
                  onChange={(e) => setVehicleVin(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Marque & Modèle *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Toyota HiAce Minibus"
                  value={vehicleMakeModel}
                  onChange={(e) => setVehicleMakeModel(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom du Propriétaire Légal *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: El Hadj Ousmane Sow"
                  value={vehicleOwner}
                  onChange={(e) => setVehicleOwner(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Catégorie d Exploitation *</label>
                <select
                  value={vehicleCategory}
                  onChange={(e) => setVehicleCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
                >
                  <option value="MINIBUS_URBAIN">Minibus Urbain (Magbana 18-24 places)</option>
                  <option value="TAXI_COMMUNAL">Taxi Communal Jaune (5 places)</option>
                  <option value="BUS_SOTRAC">Grand Bus Urbain (SOTRAC / AOTUC)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Capacité (Places) *</label>
                <input
                  type="number"
                  min="4"
                  max="70"
                  required
                  value={vehicleSeats}
                  onChange={(e) => setVehicleSeats(parseInt(e.target.value) || 18)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Commune d Enregistrement *</label>
              <select
                value={vehicleCommune}
                onChange={(e) => setVehicleCommune(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
              >
                <option value="Kaloum">Kaloum</option>
                <option value="Dixinn">Dixinn</option>
                <option value="Matam">Matam</option>
                <option value="Ratoma">Ratoma</option>
                <option value="Matoto">Matoto</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('vehicles')}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm flex items-center space-x-1.5"
              >
                <span>Soumettre au Niveau 2</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RegistrationDesk;