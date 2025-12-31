// ============================================
// CORE TYPES - Guest Management
// ============================================

/**
 * Rôle spécial d'un invité (pour la table d'honneur)
 */
export type GuestRole = 'married' | 'witness' | 'regular';

/**
 * Invité individuel avec tous ses attributs
 */
export interface Guest {
  id: string;
  firstName: string;
  lastName?: string | undefined; // Activé si critère "Par Famille"
  age?: number | undefined; // Activé si critère "Par Âge"
  role: GuestRole; // Activé si critère "Par Rôle"
  coupleId?: string | undefined; // Référence au couple si l'invité fait partie d'un couple
}

/**
 * Couple (deux invités qui doivent être ensemble)
 */
export interface Couple {
  id: string;
  guestAId: string;
  guestBId: string;
}

// ============================================
// CONSTRAINTS
// ============================================

/**
 * Contrainte d'exclusion : deux invités ne peuvent pas être à la même table
 */
export interface ExclusionConstraint {
  id: string;
  guestAId: string;
  guestBId: string;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Critères de tri sélectionnables par l'utilisateur
 */
export interface SortingCriteria {
  byFamily: boolean;
  byAge: boolean;
  byRole: boolean;
  random: boolean;
}

/**
 * Forme des tables dans la vue visuelle
 */
export type TableShape = 'round' | 'square';

/**
 * Configuration globale du plan de table
 */
export interface PlanConfiguration {
  totalGuests: number;
  numberOfTables: number; // Nombre de tables (hors table d'honneur)
  seatsPerTable: number;
  honorTableSeats: number; // Nombre de places à la table d'honneur
  sortingCriteria: SortingCriteria;
  tableShape: TableShape;
}

// ============================================
// TABLES & OUTPUT
// ============================================

/**
 * Table avec ses invités assignés
 */
export interface Table {
  id: string;
  number: number; // 1 = table d'honneur
  name: string;
  guests: Guest[];
  capacity: number;
}

/**
 * Avertissement généré par l'algorithme (contrainte souple non respectée)
 */
export interface Warning {
  type: 'exclusion_violated' | 'family_split' | 'age_mismatch';
  message: string;
  guestIds: string[];
}

/**
 * Résultat de la génération du plan de table
 */
export interface SeatingPlanResult {
  success: boolean;
  tables: Table[];
  warnings: Warning[];
  errors: string[];
  debugLog?: string | undefined; // Log de debug optionnel
}

// ============================================
// ALGORITHM INPUT
// ============================================

/**
 * Input complet pour l'algorithme de placement
 */
export interface AlgorithmInput {
  guests: Guest[];
  couples: Couple[];
  exclusions: ExclusionConstraint[];
  configuration: PlanConfiguration;
}

// ============================================
// STORE STATE
// ============================================

/**
 * État complet de l'application
 */
export interface AppState {
  // Data
  guests: Guest[];
  couples: Couple[];
  exclusions: ExclusionConstraint[];
  configuration: PlanConfiguration;
  
  // Generated result
  result: SeatingPlanResult | null;
  
  // UI State
  viewMode: 'cards' | 'visual';
  isGenerating: boolean;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Type pour les positions dans la vue visuelle des tables
 */
export interface TablePosition {
  tableId: string;
  x: number;
  y: number;
}

/**
 * Type pour l'export CSV
 */
export interface CSVRow {
  tableNumber: number;
  tableName: string;
  guestName: string;
  role: string;
  family?: string;
}
