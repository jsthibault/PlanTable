// ============================================
// INTERNATIONALIZATION (i18n)
// ============================================

export type Locale = 'fr' | 'en';

// Détecte la langue du navigateur
export function detectLocale(): Locale {
  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'en' ? 'en' : 'fr';
}

// Traductions
export const translations = {
  fr: {
    // App
    appTitle: 'PlanTable',
    appSubtitle: 'Générateur de plan de table pour votre mariage',
    
    // Tabs
    tabConfiguration: '⚙️ Configuration',
    tabGuests: '👥 Invités',
    tabPlan: '🪑 Plan de table',
    tabExport: '📤 Export',
    
    // Configuration Panel
    configTitle: 'Configuration du plan',
    totalGuests: 'Nombre total d\'invités',
    numberOfTables: 'Nombre de tables',
    seatsPerTable: 'Places par table',
    honorTableSeats: 'Places table d\'honneur',
    sortingCriteria: 'Critères de tri',
    byFamily: 'Par famille',
    byAge: 'Par âge',
    byRole: 'Par rôle',
    random: 'Aléatoire',
    generatePlan: 'Générer le plan',
    generating: 'Génération...',
    
    // Capacity alerts
    capacityOk: 'Capacité OK',
    capacityOkDesc: '{available} places pour {total} invités',
    insufficientCapacity: 'Capacité insuffisante',
    insufficientCapacityDesc: 'Il manque {missing} places ({available} disponibles pour {total} invités)',
    excessCapacity: 'Capacité excédentaire',
    excessCapacityDesc: '{excess} places en trop ({available} disponibles pour {total} invités)',
    autoComplete: 'Compléter les invités',
    autoCompleteDesc: 'Ajouter {count} invités génériques',
    
    // Guest Management
    guestsTitle: 'Gestion des invités',
    addGuest: 'Ajouter un invité',
    firstName: 'Prénom',
    lastName: 'Nom',
    family: 'Famille',
    age: 'Âge',
    role: 'Rôle',
    roleMarried: 'Marié(e)',
    roleWitness: 'Témoin',
    roleRegular: 'Invité',
    add: 'Ajouter',
    guestsList: 'Liste des invités',
    noGuests: 'Aucun invité pour le moment',
    years: 'ans',
    
    // Couples
    couplesTitle: 'Couples',
    createCouple: 'Créer un couple',
    selectFirstPerson: 'Sélectionner la première personne',
    selectSecondPerson: 'Sélectionner la deuxième personne',
    createCoupleBtn: 'Créer le couple',
    noCouples: 'Aucun couple défini',
    
    // Exclusions
    exclusionsTitle: 'Exclusions',
    addExclusion: 'Ajouter une exclusion',
    selectPersonToExclude: 'Personne à exclure',
    excludeFrom: 'Ne pas mettre avec',
    addExclusionBtn: 'Ajouter l\'exclusion',
    noExclusions: 'Aucune exclusion définie',
    cannotSitWith: 'ne peut pas être assis(e) avec',
    
    // Import CSV
    importCsv: 'Importer CSV',
    importCsvDesc: 'Format: prénom,nom,famille,âge,rôle (married/witness/regular)',
    
    // Seating Plan Display
    planTitle: 'Plan de table',
    configureAndGenerate: 'Configurez les invités et générez le plan de table',
    cannotGenerate: 'Impossible de générer le plan de table',
    warnings: 'Avertissements',
    viewCards: '📋 Vue Cartes',
    viewVisual: '🎯 Vue Visuelle',
    dragGuestsHere: 'Glissez des invités ici',
    legend: 'Légende',
    legendMarried: 'Marié(e)',
    legendWitness: 'Témoin',
    legendGuest: 'Invité',
    legendCouple: 'En couple',
    
    // Tables
    table: 'Table',
    honorTable: 'Table d\'honneur',
    
    // Export
    exportTitle: 'Export',
    exportCsv: 'Exporter en CSV',
    exportCsvDesc: 'Télécharger le plan de table au format CSV',
    exportPdf: 'Exporter en PDF',
    exportPdfDesc: 'Télécharger le plan de table au format PDF',
    download: 'Télécharger',
    generateFirst: 'Générez d\'abord un plan de table',
  },
  en: {
    // App
    appTitle: 'PlanTable',
    appSubtitle: 'Wedding seating chart generator',
    
    // Tabs
    tabConfiguration: '⚙️ Configuration',
    tabGuests: '👥 Guests',
    tabPlan: '🪑 Seating Plan',
    tabExport: '📤 Export',
    
    // Configuration Panel
    configTitle: 'Plan Configuration',
    totalGuests: 'Total number of guests',
    numberOfTables: 'Number of tables',
    seatsPerTable: 'Seats per table',
    honorTableSeats: 'Honor table seats',
    sortingCriteria: 'Sorting criteria',
    byFamily: 'By family',
    byAge: 'By age',
    byRole: 'By role',
    random: 'Random',
    generatePlan: 'Generate plan',
    generating: 'Generating...',
    
    // Capacity alerts
    capacityOk: 'Capacity OK',
    capacityOkDesc: '{available} seats for {total} guests',
    insufficientCapacity: 'Insufficient capacity',
    insufficientCapacityDesc: '{missing} seats missing ({available} available for {total} guests)',
    excessCapacity: 'Excess capacity',
    excessCapacityDesc: '{excess} extra seats ({available} available for {total} guests)',
    autoComplete: 'Auto-complete guests',
    autoCompleteDesc: 'Add {count} generic guests',
    
    // Guest Management
    guestsTitle: 'Guest Management',
    addGuest: 'Add a guest',
    firstName: 'First name',
    lastName: 'Last name',
    family: 'Family',
    age: 'Age',
    role: 'Role',
    roleMarried: 'Married',
    roleWitness: 'Witness',
    roleRegular: 'Guest',
    add: 'Add',
    guestsList: 'Guest list',
    noGuests: 'No guests yet',
    years: 'y/o',
    
    // Couples
    couplesTitle: 'Couples',
    createCouple: 'Create a couple',
    selectFirstPerson: 'Select first person',
    selectSecondPerson: 'Select second person',
    createCoupleBtn: 'Create couple',
    noCouples: 'No couples defined',
    
    // Exclusions
    exclusionsTitle: 'Exclusions',
    addExclusion: 'Add an exclusion',
    selectPersonToExclude: 'Person to exclude',
    excludeFrom: 'Cannot sit with',
    addExclusionBtn: 'Add exclusion',
    noExclusions: 'No exclusions defined',
    cannotSitWith: 'cannot sit with',
    
    // Import CSV
    importCsv: 'Import CSV',
    importCsvDesc: 'Format: firstName,lastName,family,age,role (married/witness/regular)',
    
    // Seating Plan Display
    planTitle: 'Seating Plan',
    configureAndGenerate: 'Configure guests and generate the seating plan',
    cannotGenerate: 'Cannot generate seating plan',
    warnings: 'Warnings',
    viewCards: '📋 Card View',
    viewVisual: '🎯 Visual View',
    dragGuestsHere: 'Drag guests here',
    legend: 'Legend',
    legendMarried: 'Married',
    legendWitness: 'Witness',
    legendGuest: 'Guest',
    legendCouple: 'Couple',
    
    // Tables
    table: 'Table',
    honorTable: 'Honor Table',
    
    // Export
    exportTitle: 'Export',
    exportCsv: 'Export to CSV',
    exportCsvDesc: 'Download the seating plan as CSV',
    exportPdf: 'Export to PDF',
    exportPdfDesc: 'Download the seating plan as PDF',
    download: 'Download',
    generateFirst: 'Generate a seating plan first',
  },
} as const;

export type TranslationKey = keyof typeof translations.fr;

// Hook context
import { createContext, useContext } from 'react';

interface I18nContextType {
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// Helper to replace placeholders
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text: string = translations[locale][key] || translations.fr[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(`{${param}}`, String(value));
    });
  }
  
  return text;
}
