import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Multi-Level Validation State Machine Definition (Module 4)
 * Strict, deterministic transition table enforcing Guinea AOTUC administrative hierarchy
 * and rigorous separation of duties.
 * 
 * Revised Workflow:
 * - Level 1 (Agent de Terrain): Registers and SUBMITs draft applications to Level 2.
 * - Level 2 (Chef des Agents / Chef de Service Territorial):
 *   Responsible for reviewing, approving (APPROVE_FINAL), returning (RETURN_FOR_CORRECTION),
 *   or rejecting (REJECT) chauffeur and vehicle dossiers.
 *   Strictly scoped to assigned commune. Self-approval is forbidden.
 * - Directeur Général (L3):
 *   Under the revised workflow, the Director is no longer the validation level for chauffeur
 *   and vehicle dossiers. Director cannot perform chauffeur/vehicle validations.
 * - Super Administrateur (DSI) & IT:
 *   Excluded from all business validation transitions.
 * - Anti-Fraud: Self-approval is strictly forbidden (cannot approve own submission).
 */

export const VALID_TRANSITIONS = [
  // 1. Level 1: Agent Submits Draft or Corrected File to Chef des Agents (Level 2)
  {
    action: 'SUBMIT',
    from: ['BROUILLON', 'RETOURNE_POUR_CORRECTION'],
    to: 'SOUMIS_NIVEAU2',
    targetLevel: 2,
    allowedRoles: ['AGENT_TERRAIN', 'CHEF_SERVICE'],
    requireComment: false,
    disallowSelfReview: false,
  },
  // 2. Chef des Agents (Level 2): Final Approval for Chauffeurs & Véhicules
  {
    action: 'APPROVE_FINAL',
    from: ['SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3'],
    to: 'VALIDE',
    targetLevel: 2,
    allowedRoles: ['CHEF_SERVICE'],
    requireComment: false,
    disallowSelfReview: true,
  },
  // 3. Chef des Agents (Level 2): Rejection with Mandatory Reason
  {
    action: 'REJECT',
    from: ['SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3'],
    to: 'REJETE',
    targetLevel: 2,
    allowedRoles: ['CHEF_SERVICE'],
    requireComment: true,
    disallowSelfReview: true,
  },
  // 4. Chef des Agents (Level 2): Return to Agent for Document/Data Correction
  {
    action: 'RETURN_FOR_CORRECTION',
    from: ['SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3'],
    to: 'RETOURNE_POUR_CORRECTION',
    targetLevel: 1,
    allowedRoles: ['CHEF_SERVICE'],
    requireComment: true,
    disallowSelfReview: true,
  },
  // 5. Legacy/Optional: Forward to L3 (Only for non-driver/vehicle or special escalation)
  {
    action: 'FORWARD_TO_L3',
    from: ['SOUMIS_NIVEAU2'],
    to: 'EN_ATTENTE_NIVEAU3',
    targetLevel: 3,
    allowedRoles: ['CHEF_SERVICE'],
    requireComment: false,
    disallowSelfReview: true,
  },
];

export class ValidationStateMachine {
  /**
   * Validates whether a state transition is legal according to rules, roles, entity type, and scope.
   */
  static evaluate({
    currentStatus,
    action,
    reviewerUser,
    submitterId,
    comment,
    requestCommuneId,
    entityType = 'DRIVER_ENROLMENT',
  }) {
    const isChauffeurOrVehicle =
      entityType === 'DRIVER_ENROLMENT' || entityType === 'VEHICLE_ENROLMENT';

    // 1. Explicitly check if Director attempts chauffeur/vehicle validation
    const userRoles = reviewerUser.roles || [];
    const isDirector = userRoles.includes('DIRECTOR');

    if (isDirector && isChauffeurOrVehicle && ['APPROVE_FINAL', 'REJECT', 'RETURN_FOR_CORRECTION', 'FORWARD_TO_L3'].includes(action)) {
      throw new AppError(
        'La validation des dossiers chauffeurs et véhicules est attribuée exclusivement au Chef des Agents. Le Directeur Général n est plus habilité à valider ces dossiers.',
        403,
        'FORBIDDEN_DIRECTOR_VALIDATION'
      );
    }

    // 2. Find matching transition rule
    const rule = VALID_TRANSITIONS.find(
      (t) => t.action === action && t.from.includes(currentStatus)
    );

    if (!rule) {
      throw new AppError(
        `Transition impossible : l action "${action}" n est pas autorisée depuis l état actuel "${currentStatus}".`,
        400,
        'INVALID_STATE_TRANSITION'
      );
    }

    // 3. Enforce Strict Role Authority (Must be in allowedRoles)
    const hasRole = userRoles.some((r) => rule.allowedRoles.includes(r));
    if (!hasRole) {
      throw new AppError(
        `Permissions insuffisantes : votre rôle (${userRoles.join(', ')}) ne vous permet pas d exécuter l action "${action}". Seul le Chef des Agents peut valider ce dossier.`,
        403,
        'FORBIDDEN_VALIDATION_ROLE'
      );
    }

    // 4. Enforce Self-Approval Prohibition
    if (rule.disallowSelfReview && reviewerUser.id === submitterId) {
      throw new AppError(
        'Conflit d intérêt : vous ne pouvez pas approuver, rejeter ou traiter un dossier que vous avez vous-même soumis.',
        403,
        'SELF_APPROVAL_FORBIDDEN'
      );
    }

    // 5. Enforce Mandatory Comment for Rejection / Return
    if (rule.requireComment) {
      if (!comment || comment.trim().length < 5) {
        throw new AppError(
          'Un motif circonstancié (au moins 5 caractères) est obligatoire pour motiver cette décision.',
          400,
          'MANDATORY_COMMENT_REQUIRED'
        );
      }
    }

    // 6. Enforce Territorial Scope for Chef des Agents (CHEF_SERVICE)
    if (userRoles.includes('CHEF_SERVICE')) {
      if (reviewerUser.communeId && requestCommuneId && reviewerUser.communeId !== requestCommuneId) {
        throw new AppError(
          'Accès refusé. Vous ne pouvez valider que les dossiers rattachés à votre commune.',
          403,
          'FORBIDDEN_COMMUNE_SCOPE'
        );
      }
    }

    return {
      newStatus: rule.to,
      newLevel: rule.targetLevel,
    };
  }
}

export default ValidationStateMachine;
