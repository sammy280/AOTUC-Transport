import React, { useState } from 'react';
import { UserContext, ValidationItem, ValidationAction } from '../../types';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  Eye,
  FileText,
  MapPin,
  Lock,
} from 'lucide-react';
import { PERMISSIONS, hasRolePermission } from '../../utils/permissions';

interface ValidationQueueProps {
  currentUser: UserContext;
}

export const ValidationQueue: React.FC<ValidationQueueProps> = ({ currentUser }) => {
  // Mock data representing live backend dossiers in various validation states
  const [items, setItems] = useState<ValidationItem[]>([
    {
      id: 'val-001',
      requestNumber: 'VAL-2026-A19F8',
      entityType: 'DRIVER_ENROLMENT',
      applicantName: 'Mamadou Oury Bah',
      applicantPhone: '+224 622 14 55 90',
      targetDetails: 'Permis B • Exp. 24/09/2028 • Syndicat FNTG',
      communeName: 'Matoto',
      currentLevel: 2,
      status: 'SOUMIS_NIVEAU2',
      submittedAt: 'Aujourd hui à 09:15',
      submitterName: 'Sekou Conte (Agent Enrôleur)',
      documents: [
        { category: 'PHOTO_PORTRAIT', label: 'Photo d identité 4x4', url: '#' },
        { category: 'CNI_RECTO', label: 'Carte Nationale d Identité (Recto)', url: '#' },
        { category: 'PERMIS_CONDUIRE', label: 'Permis de Conduire biométrique', url: '#' },
      ],
      history: [
        {
          reviewerName: 'Sekou Conte',
          role: 'AGENT_TERRAIN',
          action: 'SUBMIT',
          comment: 'Enrôlement physique complet effectué au bureau Matoto.',
          timestamp: '03/11/2026 09:15',
        },
      ],
    },
    {
      id: 'val-002',
      requestNumber: 'VAL-2026-F44C2',
      entityType: 'VEHICLE_ENROLMENT',
      applicantName: 'Société Transport Étoile Conakry',
      applicantPhone: '+224 628 90 12 34',
      targetDetails: 'Toyota Hiace (Magbana) • Plaque RC-5412-M • Châssis JTE199',
      communeName: 'Matoto',
      currentLevel: 3,
      status: 'EN_ATTENTE_NIVEAU3',
      submittedAt: 'Hier à 16:40',
      submitterName: 'Sekou Conte (Agent Enrôleur)',
      documents: [
        { category: 'CARTE_GRISE', label: 'Carte Grise officielle', url: '#' },
        { category: 'VISITE_TECHNIQUE', label: 'Certificat Contrôle Technique valide', url: '#' },
        { category: 'PHOTO_VEHICULE_AVANT', label: 'Photo Véhicule (Face avant)', url: '#' },
      ],
      history: [
        {
          reviewerName: 'Sekou Conte',
          role: 'AGENT_TERRAIN',
          action: 'SUBMIT',
          comment: 'Dossier véhicule saisi avec photos des 4 faces.',
          timestamp: '02/11/2026 14:10',
        },
        {
          reviewerName: 'Fanta Soumah',
          role: 'CHEF_SERVICE',
          action: 'FORWARD_TO_L3',
          comment: 'Vérification effectuée. Numéro de châssis conforme au registre national.',
          timestamp: '02/11/2026 16:40',
        },
      ],
    },
    {
      id: 'val-003',
      requestNumber: 'VAL-2026-B88E1',
      entityType: 'DRIVER_ENROLMENT',
      applicantName: 'Ibrahima Sory Camara',
      applicantPhone: '+224 621 33 44 55',
      targetDetails: 'Permis C • Exp. 12/03/2027 • Taxi Collectif',
      communeName: 'Kaloum',
      currentLevel: 2,
      status: 'RETOURNE_POUR_CORRECTION',
      submittedAt: '31/10/2026 11:20',
      submitterName: 'Alpha Barry (Agent Kaloum)',
      documents: [
        { category: 'CNI_RECTO', label: 'CNI Recto (Floue)', url: '#' },
      ],
      history: [
        {
          reviewerName: 'Alpha Barry',
          role: 'CHEF_SERVICE',
          action: 'RETURN_FOR_CORRECTION',
          comment: 'La photo du permis est illisible sous le flash. Veuillez re-scanner le document.',
          timestamp: '31/10/2026 15:30',
        },
      ],
    },
  ]);

  const [selectedItem, setSelectedItem] = useState<ValidationItem | null>(null);
  const [commentText, setCommentText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle decisions with strict state machine and anti-fraud enforcement
  const handleDecision = (action: ValidationAction) => {
    if (!selectedItem) return;

    // Rule: Rejection and return require comments
    if ((action === 'REJECT' || action === 'RETURN_FOR_CORRECTION') && commentText.trim().length < 5) {
      setFeedbackMessage({
        type: 'error',
        text: 'Un motif d au moins 5 caractères est obligatoire pour rejeter ou renvoyer un dossier.',
      });
      return;
    }

    // Rule: Level 3 approval strictly by Director General (Super Admin cannot approve)
    if (action === 'APPROVE_FINAL' && !hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L3)) {
      setFeedbackMessage({
        type: 'error',
        text: 'Action refusée. Seul le Directeur Général a l autorité d approuver définitivement (Niveau 3).',
      });
      return;
    }

    // Rule: Forward to L3 strictly by Chef de Service (Super Admin cannot forward)
    if (action === 'FORWARD_TO_L3' && !hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L2)) {
      setFeedbackMessage({
        type: 'error',
        text: 'Action refusée. Seul un Chef de Service territorial peut transmettre un dossier au Niveau 3.',
      });
      return;
    }

    // Rule: Rejection or Return authority check
    if (
      (action === 'RETURN_FOR_CORRECTION' || action === 'REJECT') &&
      !hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_RETURN)
    ) {
      setFeedbackMessage({
        type: 'error',
        text: 'Action refusée. Votre rôle ne dispose pas des droits d instruction sur ce dossier.',
      });
      return;
    }

    // Rule: Scope check for territorial Chefs de Service
    if (
      currentUser.role === 'CHEF_SERVICE' &&
      currentUser.communeName !== selectedItem.communeName &&
      !currentUser.communeName.includes(selectedItem.communeName)
    ) {
      setFeedbackMessage({
        type: 'error',
        text: `Accès refusé. Vous êtes affecté à ${currentUser.communeName}, vous ne pouvez pas traiter un dossier de ${selectedItem.communeName}.`,
      });
      return;
    }

    // Determine new status
    let nextStatus = selectedItem.status;
    let nextLevel = selectedItem.currentLevel;

    if (action === 'FORWARD_TO_L3') {
      nextStatus = 'EN_ATTENTE_NIVEAU3';
      nextLevel = 3;
    } else if (action === 'APPROVE_FINAL') {
      nextStatus = 'VALIDE';
      nextLevel = 3;
    } else if (action === 'RETURN_FOR_CORRECTION') {
      nextStatus = 'RETOURNE_POUR_CORRECTION';
      nextLevel = 1;
    } else if (action === 'REJECT') {
      nextStatus = 'REJETE';
    }

    // Update state
    const updatedHistory = [
      ...selectedItem.history,
      {
        reviewerName: currentUser.name,
        role: currentUser.role,
        action,
        comment: commentText.trim() || null,
        timestamp: new Date().toLocaleString('fr-FR'),
      },
    ];

    const updatedItem = {
      ...selectedItem,
      status: nextStatus,
      currentLevel: nextLevel as 1 | 2 | 3,
      history: updatedHistory,
    };

    setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? updatedItem : item)));
    setSelectedItem(updatedItem);
    setCommentText('');
    setFeedbackMessage({
      type: 'success',
      text: `Décision enregistrée avec succès (${action}). Traçabilité d audit générée.`,
    });
  };

  const filteredItems = items.filter((item) => {
    if (filterStatus === 'ALL') return true;
    return item.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Guichet de Validation Multi-Niveaux
          </h1>
          <p className="text-xs text-slate-500">
            Instruction hiérarchique : Agent Terrain $\rightarrow$ Chef de Service Territorial $\rightarrow$ Directeur Général.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { id: 'ALL', label: 'Tous les dossiers' },
            { id: 'SOUMIS_NIVEAU2', label: 'Niveau 2 (Commune)' },
            { id: 'EN_ATTENTE_NIVEAU3', label: 'Niveau 3 (Direction)' },
            { id: 'RETOURNE_POUR_CORRECTION', label: 'À corriger' },
            { id: 'VALIDE', label: 'Validés' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Main Grid: Dossiers List (Left) + Detailed Inspector Pane (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {filteredItems.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setFeedbackMessage(null);
                }}
                className={`p-4 bg-white border rounded-xl cursor-pointer transition shadow-sm ${
                  isSelected
                    ? 'border-slate-900 ring-2 ring-slate-900/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-700">
                      {item.requestNumber}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                      {item.entityType === 'DRIVER_ENROLMENT' ? 'CHAUFFEUR' : 'VÉHICULE'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === 'VALIDE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'SOUMIS_NIVEAU2'
                        ? 'bg-amber-100 text-amber-900'
                        : item.status === 'EN_ATTENTE_NIVEAU3'
                        ? 'bg-blue-100 text-blue-900'
                        : item.status === 'RETOURNE_POUR_CORRECTION'
                        ? 'bg-orange-100 text-orange-900'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-2">
                  <div className="text-sm font-bold text-slate-900">{item.applicantName}</div>
                  <div className="text-xs text-slate-500">{item.targetDetails}</div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Commune : {item.communeName}</span>
                  </div>
                  <span>{item.submittedAt}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Inspector & Decision Desk (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          {selectedItem ? (
            <div className="space-y-6">
              {/* Dossier Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedItem.applicantName}
                    </h2>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      ({selectedItem.requestNumber})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Téléphone : {selectedItem.applicantPhone} • Soumis par {selectedItem.submitterName}
                  </p>
                </div>

                {/* Level Badge */}
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Palier Actuel</div>
                  <div className="text-sm font-bold text-slate-900">Niveau {selectedItem.currentLevel} / 3</div>
                </div>
              </div>

              {/* Uploaded Documents Review List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pièces Jointes & Justificatifs Biométriques
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedItem.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="truncate text-slate-800 font-medium">{doc.label}</span>
                      </div>
                      <button
                        onClick={() => alert(`Aperçu sécurisé du document : ${doc.label}`)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Examiner la pièce"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review Timeline History */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Historique des Décisions (Traçabilité Inaltérable)
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-3">
                  {selectedItem.history.map((step, idx) => (
                    <div key={idx} className="text-xs flex items-start space-x-2.5">
                      <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          {step.reviewerName} <span className="text-slate-500 font-normal">({step.role})</span> — <span className="font-bold text-blue-700">{step.action}</span>
                        </div>
                        {step.comment && (
                          <div className="text-slate-600 italic mt-0.5">« {step.comment} »</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">{step.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Action Bar (Role Aware) */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Prendre une Décision Administrative
                </div>

                {/* Comment Box */}
                <div>
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Commentaire officiel ou motif en cas de rejet / renvoi (obligatoire pour renvoi)..."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
                  />
                </div>

                {/* Role-Specific Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Niveau 2 : Chef de Service Actions */}
                  {selectedItem.status === 'SOUMIS_NIVEAU2' &&
                    hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L2) && (
                      <button
                        onClick={() => handleDecision('FORWARD_TO_L3')}
                        className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Transmettre au Niveau 3 (Direction)</span>
                      </button>
                    )}

                  {/* Niveau 3 : Directeur Général Actions */}
                  {selectedItem.status === 'EN_ATTENTE_NIVEAU3' &&
                    hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L3) && (
                      <button
                        onClick={() => handleDecision('APPROVE_FINAL')}
                        className="flex items-center space-x-1.5 bg-[#009460] hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approbation Finale (Délivrance Badge)</span>
                      </button>
                    )}

                  {/* Return for Correction */}
                  {(selectedItem.status === 'SOUMIS_NIVEAU2' || selectedItem.status === 'EN_ATTENTE_NIVEAU3') &&
                    hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_RETURN) && (
                      <button
                        onClick={() => handleDecision('RETURN_FOR_CORRECTION')}
                        className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Renvoyer pour Correction</span>
                      </button>
                    )}

                  {/* Rejection */}
                  {(selectedItem.status === 'SOUMIS_NIVEAU2' || selectedItem.status === 'EN_ATTENTE_NIVEAU3') &&
                    hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_REJECT) && (
                      <button
                        onClick={() => handleDecision('REJECT')}
                        className="flex items-center space-x-1.5 bg-[#CE1126] hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rejeter Définitivement</span>
                      </button>
                    )}

                  {/* Read-Only Notice for Users Without Validation Powers */}
                  {!hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L2) &&
                    !hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_APPROVE_L3) &&
                    !hasRolePermission(currentUser.role, PERMISSIONS.APPLICATIONS_RETURN) && (
                      <div className="flex items-center space-x-2 p-3 bg-slate-100 text-slate-600 rounded-lg text-xs w-full">
                        <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>
                          Mode Consultation : Votre rôle ({currentUser.roleLabel}) ne dispose pas des droits de validation administrative.
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <FileText className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <span>Sélectionnez un dossier dans la liste pour démarrer l instruction.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationQueue;
