import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Multi-Level Validation State Machine Definition (Module 4)
 * Strict, deterministic transition table enforcing Guinea AOTUC administrative hierarchy
 * and rigorous separation of duties.
 * 
 * Rules:
 * - Level 1 (Agent de Terrain): Registers and SUBMITs draft applications.
 * - Level 2 (Chef de Service Matoto): Reviews and FORWARD_TO_L3, or REJECTs / RETURN_FOR_CORRECTION.
 *   Strictly scoped to assigned commune (Matoto). Cannot perform final L3 approval.
 * - Level 3 (Directeur Général): Final APPROVE_FINAL, REJECT, or RETURN_FOR_CORRECTION.
 * - Super Administrateur (DSI): Excluded from all business validation transitions!
 *   Cannot assume Director approval authority or issue transport authorizations.
 * - Anti-Fraud: Self-approval is strictly forbidden (cannot approve own submission).
 */

export const VALID_TRANSITIONS = [
  // 1. Level 1: Agent Submits Draft or Corrected File
  {
    action: 'SUBMIT',
    from: ['BROUILLON', 'RETOURNE_POUR_CORRECTION'],
    to: 'SOUMIS_NIVEAU2',
    targetLevel: 2,
    allowedRoles: ['AGENT_TERRAIN', 'CHEF_SERVICE'],
    requireComment: false,
    disallowSelfReview: false, // Agent files their own submission
  },
  // 2. Level 2: Chef de Service Reviews and Forwards to Director
  {
    action: 'FORWARD_TO_L3',
    from: ['SOUMIS_NIVEAU2'],
    to: 'EN_ATTENTE_NIVEAU3',
    targetLevel: 3,
    allowedRoles: ['CHEF_SERVICE'],
    requireComment: false,
    disallowSelfReview: true,
  },
  // 3. Level 2 or 3: Returns File to Agent for Document/Data Correction
  {
    action: 'RETURN_FOR_CORRECTION',
    from: ['SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3'],
    to: 'RETOURNE_POUR_CORRECTION',
    targetLevel: 1,
    allowedRoles: ['CHEF_SERVICE', 'DIRECTOR'],
    requireComment: true,
    disallowSelfReview: true,
  },
  // 4. Level 3: Director Final Validation
  {
    action: 'APPROVE_FINAL',
    from: ['EN_ATTENTE_NIVEAU3'],
    to: 'VALIDE',
    targetLevel: 3,
    allowedRoles: ['DIRECTOR'],
    requireComment: false,
    disallowSelfReview: true,
  },
  // 5. Level 2 or 3: Rejection with Mandatory Reason
  {
    action: 'REJECT',
    from: ['SOUMIS_NIVEAU2', 'EN_ATTENTE_NIVEAU3'],
    to: 'REJETE',
    targetLevel: 3,
    allowedRoles: ['CHEF_SERVICE', 'DIRECTOR'],
    requireComment: true,
    disallowSelfReview: true,
  },
];

export class ValidationStateMachine {
  /**
   * Validates whether a state transition is legal according to rules, roles, and scope.
   */
  static evaluate({ currentStatus, action, reviewerUser, submitterId, comment, requestCommuneId }) {
    // 1. Find matching transition rule
    const rule = VALID_TRANSITIONS.find(
      (t) => t.action === action && t.from.includes(currentStatus)
    );

    if (!rule) {
      throw new AppError(
        `Transition impossible : l'action "${action}" n'est pas autorisée depuis l'état actuel "${currentStatus}".`,
        400,
        'INVALID_STATE_TRANSITION'
      );
    }

    // 2. Enforce Strict Role Authority (No auto-bypass for Super Admin)
    const userRoles = reviewerUser.roles || [];
    const hasRole = userRoles.some((r) => rule.allowedRoles.includes(r));
    if (!hasRole) {
      throw new AppError(
        `Permissions insuffisantes : votre rôle ne vous permet pas d'exécuter l'action "${action}".`,
        403,
        'FORBIDDEN_VALIDATION_ROLE'
      );
    }

    // 3. Enforce Self-Approval Prohibition
    if (rule.disallowSelfReview && reviewerUser.id === submitterId) {
      throw new AppError(
        'Conflit d intérêt : vous ne pouvez pas approuver, rejeter ou traiter un dossier que vous avez vous-même soumis.',
        403,
        'SELF_APPROVAL_FORBIDDEN'
      );
    }

    // 4. Enforce Mandatory Comment for Rejection / Return
    if (rule.requireComment) {
      if (!comment || comment.trim().length < 5) {
        throw new AppError(
          'Un motif circonstancié (au moins 5 caractères) est obligatoire pour cette décision.',
          400,
          'MANDATORY_COMMENT_REQUIRED'
        );
      }
    }

    // 5. Enforce Territorial Scope for Chef de Service & Agent
    const isDirector = userRoles.includes('DIRECTOR');
    if (!isDirector && userRoles.includes('CHEF_SERVICE')) {
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
