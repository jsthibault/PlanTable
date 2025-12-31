import type {
  Guest,
  Couple,
  ExclusionConstraint,
  Table,
  Warning,
  SeatingPlanResult,
  AlgorithmInput,
  PlanConfiguration,
} from '@/types';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Récupère le nom complet d'un invité
 */
function getFullName(guest: Guest): string {
  return guest.lastName 
    ? `${guest.firstName} ${guest.lastName}`
    : guest.firstName;
}

/**
 * Vérifie si deux invités ont une exclusion entre eux
 */
function haveExclusion(
  guestA: Guest,
  guestB: Guest,
  exclusions: ExclusionConstraint[]
): boolean {
  return exclusions.some(
    (e) =>
      (e.guestAId === guestA.id && e.guestBId === guestB.id) ||
      (e.guestAId === guestB.id && e.guestBId === guestA.id)
  );
}

/**
 * Récupère le partenaire d'un invité dans un couple
 */
function getCouplePartner(
  guest: Guest,
  couples: Couple[],
  allGuests: Guest[]
): Guest | null {
  const couple = couples.find(
    (c) => c.guestAId === guest.id || c.guestBId === guest.id
  );
  if (!couple) return null;

  const partnerId = couple.guestAId === guest.id ? couple.guestBId : couple.guestAId;
  return allGuests.find((g) => g.id === partnerId) ?? null;
}

// ============================================
// VALIDATION - Solvability Check
// ============================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Valide si une configuration est réalisable
 */
export function validateConfiguration(input: AlgorithmInput): ValidationResult {
  const errors: string[] = [];
  const { guests, couples, exclusions, configuration } = input;

  // 1. Vérifier que le nombre total d'invités correspond
  if (guests.length === 0) {
    errors.push('Aucun invité n\'a été ajouté.');
    return { isValid: false, errors };
  }

  // 2. Calculer le nombre total de places disponibles
  const honorTableGuests = guests.filter(
    (g) => g.role === 'married' || g.role === 'witness'
  );
  
  // Vérifier que la table d'honneur peut accueillir tous les témoins/mariés + leurs conjoints
  const honorTableWithPartners = new Set<string>();
  honorTableGuests.forEach((g) => {
    honorTableWithPartners.add(g.id);
    const partner = getCouplePartner(g, couples, guests);
    if (partner) {
      honorTableWithPartners.add(partner.id);
    }
  });

  if (honorTableWithPartners.size > configuration.honorTableSeats) {
    errors.push(
      `La table d'honneur ne peut accueillir que ${configuration.honorTableSeats} personnes, ` +
      `mais ${honorTableWithPartners.size} personnes doivent y être placées ` +
      `(témoins/mariés et leurs conjoints).`
    );
  }

  // 3. Vérifier les contraintes circulaires d'exclusion
  // Ex: A exclut B, B exclut C, C exclut A et ils sont tous en couple
  const exclusionGraph = new Map<string, Set<string>>();
  
  guests.forEach((g) => {
    exclusionGraph.set(g.id, new Set());
  });

  exclusions.forEach((e) => {
    exclusionGraph.get(e.guestAId)?.add(e.guestBId);
    exclusionGraph.get(e.guestBId)?.add(e.guestAId);
  });

  // 4. Vérifier qu'un couple n'a pas d'exclusion interne
  couples.forEach((couple) => {
    if (exclusionGraph.get(couple.guestAId)?.has(couple.guestBId)) {
      const guestA = guests.find((g) => g.id === couple.guestAId);
      const guestB = guests.find((g) => g.id === couple.guestBId);
      if (guestA && guestB) {
        errors.push(
          `Conflit : ${getFullName(guestA)} et ${getFullName(guestB)} ` +
          `sont en couple mais ont une exclusion entre eux.`
        );
      }
    }
  });

  // 5. Calculer le nombre de tables nécessaires
  const regularGuests = guests.filter(
    (g) => !honorTableWithPartners.has(g.id)
  );
  // Note: Le nombre de tables est maintenant configuré manuellement

  // 6. Vérifier que les groupes (couples + exclusions) peuvent tenir
  // Un groupe lié par couple ne peut pas dépasser une table
  const coupleGroups = findCoupleGroups(guests, couples);
  coupleGroups.forEach((group) => {
    const groupInHonorTable = group.some((gId) => honorTableWithPartners.has(gId));
    const maxCapacity = groupInHonorTable 
      ? configuration.honorTableSeats 
      : configuration.seatsPerTable;
    
    if (group.length > maxCapacity) {
      const names = group.map((g) => {
        const guest = guests.find((gu) => gu.id === g);
        return guest ? getFullName(guest) : 'Inconnu';
      }).join(', ');
      errors.push(
        `Le groupe de couples (${names}) contient ${group.length} personnes, ` +
        `mais la capacité maximale d'une table est de ${maxCapacity}.`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Trouve les groupes connectés par les couples
 */
function findCoupleGroups(guests: Guest[], couples: Couple[]): string[][] {
  const visited = new Set<string>();
  const groups: string[][] = [];

  function dfs(guestId: string, group: string[]): void {
    if (visited.has(guestId)) return;
    visited.add(guestId);
    group.push(guestId);

    // Trouver les couples liés
    couples.forEach((couple) => {
      if (couple.guestAId === guestId && !visited.has(couple.guestBId)) {
        dfs(couple.guestBId, group);
      }
      if (couple.guestBId === guestId && !visited.has(couple.guestAId)) {
        dfs(couple.guestAId, group);
      }
    });
  }

  guests.forEach((guest) => {
    if (!visited.has(guest.id)) {
      const group: string[] = [];
      dfs(guest.id, group);
      if (group.length > 0) {
        groups.push(group);
      }
    }
  });

  return groups.filter((g) => g.length > 1);
}

// ============================================
// MAIN ALGORITHM
// ============================================

/**
 * Classe helper pour le logging de debug
 */
class DebugLogger {
  private logs: string[] = [];
  
  log(message: string): void {
    this.logs.push(`[${new Date().toISOString().split('T')[1]?.split('.')[0]}] ${message}`);
  }
  
  section(title: string): void {
    this.logs.push('');
    this.logs.push(`=== ${title} ===`);
  }
  
  getOutput(): string {
    return this.logs.join('\n');
  }
}

/**
 * Algorithme principal de génération du plan de table
 */
export function generateSeatingPlan(input: AlgorithmInput): SeatingPlanResult {
  const { guests, couples, exclusions, configuration } = input;
  const warnings: Warning[] = [];
  const tables: Table[] = [];
  const debug = new DebugLogger();
  
  debug.section('DÉBUT DE LA GÉNÉRATION');
  debug.log(`Nombre d'invités: ${guests.length}`);
  debug.log(`Nombre de couples: ${couples.length}`);
  debug.log(`Nombre d'exclusions: ${exclusions.length}`);
  debug.log(`Configuration: ${configuration.numberOfTables} tables de ${configuration.seatsPerTable} places + table d'honneur (${configuration.honorTableSeats} places)`);

  // Lister toutes les exclusions
  if (exclusions.length > 0) {
    debug.section('EXCLUSIONS DÉFINIES');
    exclusions.forEach((e, i) => {
      const guestA = guests.find(g => g.id === e.guestAId);
      const guestB = guests.find(g => g.id === e.guestBId);
      debug.log(`${i + 1}. "${guestA?.firstName ?? 'Inconnu'} ${guestA?.lastName ?? ''}" <-> "${guestB?.firstName ?? 'Inconnu'} ${guestB?.lastName ?? ''}"`);
      debug.log(`   IDs: ${e.guestAId} <-> ${e.guestBId}`);
    });
  }

  // 1. Validation préliminaire
  debug.section('VALIDATION');
  const validation = validateConfiguration(input);
  if (!validation.isValid) {
    debug.log(`ÉCHEC: ${validation.errors.join(', ')}`);
    return {
      success: false,
      tables: [],
      warnings: [],
      errors: validation.errors,
      debugLog: debug.getOutput(),
    };
  }
  debug.log('Validation OK');

  // 2. Créer la table d'honneur
  debug.section('CRÉATION DES TABLES');
  const honorTable: Table = {
    id: generateId(),
    number: 1,
    name: 'Table d\'honneur',
    guests: [],
    capacity: configuration.honorTableSeats,
  };
  tables.push(honorTable);
  debug.log(`Table d'honneur créée (ID: ${honorTable.id}, capacité: ${honorTable.capacity})`);

  // 2b. Pré-créer les tables selon la configuration
  for (let i = 0; i < configuration.numberOfTables; i++) {
    const table = {
      id: generateId(),
      number: i + 2,
      name: `Table ${i + 2}`,
      guests: [],
      capacity: configuration.seatsPerTable,
    };
    tables.push(table);
    debug.log(`Table ${i + 2} créée (ID: ${table.id}, capacité: ${table.capacity})`);
  }

  // 3. Identifier les invités de la table d'honneur (mariés, témoins + conjoints)
  debug.section('TABLE D\'HONNEUR');
  const honorTableGuestIds = new Set<string>();
  const honorGuests = guests.filter(
    (g) => g.role === 'married' || g.role === 'witness'
  );

  honorGuests.forEach((g) => {
    honorTableGuestIds.add(g.id);
    debug.log(`Ajout à table d'honneur: ${g.firstName} ${g.lastName ?? ''} (${g.role})`);
    const partner = getCouplePartner(g, couples, guests);
    if (partner) {
      honorTableGuestIds.add(partner.id);
      debug.log(`  + son partenaire: ${partner.firstName} ${partner.lastName ?? ''}`);
    }
  });

  // Placer les invités de la table d'honneur
  guests
    .filter((g) => honorTableGuestIds.has(g.id))
    .forEach((g) => {
      honorTable.guests.push(g);
    });
  debug.log(`Total table d'honneur: ${honorTable.guests.length} personnes`);

  // 4. Préparer les invités restants
  debug.section('PLACEMENT DES AUTRES INVITÉS');
  let remainingGuests = guests.filter((g) => !honorTableGuestIds.has(g.id));
  debug.log(`Invités restants à placer: ${remainingGuests.length}`);

  // 5. Trier selon les critères (avec exclusions en priorité, auto-générés en dernier)
  remainingGuests = sortGuests(remainingGuests, configuration, couples, exclusions);
  
  // Log de l'ordre de tri
  const guestsWithConstraints = remainingGuests.filter(g => 
    exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id)
  );
  const autoGenerated = remainingGuests.filter(g => isAutoGeneratedGuest(g));
  const realGuests = remainingGuests.filter(g => 
    !isAutoGeneratedGuest(g) && !guestsWithConstraints.includes(g)
  );
  
  debug.log(`Ordre de placement:`);
  debug.log(`  1. Invités avec exclusions: ${guestsWithConstraints.length}`);
  guestsWithConstraints.forEach(g => debug.log(`     - ${g.firstName} ${g.lastName ?? ''}`));
  debug.log(`  2. Autres invités réels: ${realGuests.length}`);
  debug.log(`  3. Invités auto-générés: ${autoGenerated.length}`);

  // 6. Grouper par famille si le critère est actif
  // LOGIQUE DE PLACEMENT:
  // - Les GRANDES familles en premier (pour avoir assez de place)
  // - Chaque famille inclut aussi les conjoints (même s'ils ont un autre nom)
  // - Les invités auto-générés en dernier
  let orderedGuests: Guest[];
  
  if (configuration.sortingCriteria.byFamily) {
    // Séparer les vrais invités des auto-générés
    const realGuestsAll = remainingGuests.filter(g => !isAutoGeneratedGuest(g));
    const autoGeneratedAll = remainingGuests.filter(g => isAutoGeneratedGuest(g));
    
    // Grouper par famille les vrais invités
    const familyGroups = groupByFamily(realGuestsAll);
    
    // IMPORTANT: Trier les groupes par taille AVANT de créer les groupes étendus
    // Cela garantit que les grandes familles gardent leurs membres
    // (ex: pauline thibault reste avec les Thibault, pas avec le groupe de son conjoint)
    familyGroups.sort((a, b) => b.length - a.length);
    
    // Étendre chaque groupe familial pour inclure les conjoints
    // (même s'ils ont un nom de famille différent)
    const extendedFamilyGroups: Guest[][] = [];
    const processedGuestIds = new Set<string>();
    
    for (const group of familyGroups) {
      const extendedGroup: Guest[] = [];
      
      for (const member of group) {
        if (processedGuestIds.has(member.id)) continue;
        
        extendedGroup.push(member);
        processedGuestIds.add(member.id);
        
        // Ajouter le conjoint s'il n'est pas déjà dans le groupe
        const partner = getCouplePartner(member, couples, guests);
        if (partner && !processedGuestIds.has(partner.id) && !honorTableGuestIds.has(partner.id)) {
          extendedGroup.push(partner);
          processedGuestIds.add(partner.id);
        }
      }
      
      if (extendedGroup.length > 0) {
        extendedFamilyGroups.push(extendedGroup);
      }
    }
    
    // Trier les groupes par TAILLE (du plus grand au plus petit)
    extendedFamilyGroups.sort((groupA, groupB) => {
      // Priorité 1 : Taille du groupe (du plus grand au plus petit)
      const sizeDiff = groupB.length - groupA.length;
      if (sizeDiff !== 0) return sizeDiff;
      
      // Priorité 2 : Si même taille, ceux avec exclusions en premier
      const aHasExclusion = groupA.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      const bHasExclusion = groupB.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      if (aHasExclusion && !bHasExclusion) return -1;
      if (!aHasExclusion && bHasExclusion) return 1;
      
      return 0;
    });
    
    // Au sein de chaque groupe, mettre les invités avec exclusions en premier
    const sortedFamilyGroups = extendedFamilyGroups.map(group => {
      return group.sort((a, b) => {
        const aHasExclusion = exclusions.some(e => e.guestAId === a.id || e.guestBId === a.id);
        const bHasExclusion = exclusions.some(e => e.guestAId === b.id || e.guestBId === b.id);
        if (aHasExclusion && !bHasExclusion) return -1;
        if (!aHasExclusion && bHasExclusion) return 1;
        return 0;
      });
    });
    
    // Reconstruire la liste : familles groupées (grandes d'abord) puis auto-générés
    orderedGuests = [...sortedFamilyGroups.flat(), ...autoGeneratedAll];
    
    debug.log(`Groupes de famille étendus (avec conjoints, triés par taille):`);
    sortedFamilyGroups.forEach((group, i) => {
      const familyName = group[0]?.lastName?.trim() ?? 'Sans nom';
      const hasExclusion = group.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      const members = group.map(g => `${g.firstName} ${g.lastName ?? ''}`.trim()).join(', ');
      debug.log(`  ${i + 1}. ${familyName} (${group.length} pers.)${hasExclusion ? ' ⚠ a des exclusions' : ''}`);
      debug.log(`     Membres: ${members}`);
    });
  } else {
    // Sans regroupement par famille, on trie juste : vrais invités d'abord, auto-générés ensuite
    const realGuestsAll = remainingGuests.filter(g => !isAutoGeneratedGuest(g));
    const autoGeneratedAll = remainingGuests.filter(g => isAutoGeneratedGuest(g));
    
    // Trier les vrais invités : ceux avec exclusions en premier
    realGuestsAll.sort((a, b) => {
      const aHasExclusion = exclusions.some(e => e.guestAId === a.id || e.guestBId === a.id);
      const bHasExclusion = exclusions.some(e => e.guestAId === b.id || e.guestBId === b.id);
      if (aHasExclusion && !bHasExclusion) return -1;
      if (!aHasExclusion && bHasExclusion) return 1;
      return 0;
    });
    
    orderedGuests = [...realGuestsAll, ...autoGeneratedAll];
    debug.log(`Pas de regroupement par famille`);
  }

  // 7. Placer les invités table par table
  // LOGIQUE: Essayer de garder les familles ensemble, et les couples en priorité
  const placedGuestIds = new Set(honorTableGuestIds);
  
  // Map pour tracker quelle table contient quels noms de famille
  const familyTableMap = new Map<string, string>(); // familyName -> tableId

  for (const guest of orderedGuests) {
    if (placedGuestIds.has(guest.id)) continue;

    // Trouver le partenaire s'il y en a un (TOUJOURS garder les couples ensemble)
    const partner = getCouplePartner(guest, couples, guests);
    const guestsToPlace = partner && !placedGuestIds.has(partner.id)
      ? [guest, partner]
      : [guest];

    debug.log(`\nRecherche table pour: ${guestsToPlace.map(g => `${g.firstName} ${g.lastName ?? ''}`).join(' + ')}`);
    
    // Vérifier les exclusions de ces invités
    const guestExclusions = exclusions.filter(e => 
      guestsToPlace.some(g => e.guestAId === g.id || e.guestBId === g.id)
    );
    if (guestExclusions.length > 0) {
      debug.log(`  Exclusions pour ces invités:`);
      guestExclusions.forEach(e => {
        const otherGuestId = guestsToPlace.some(g => g.id === e.guestAId) ? e.guestBId : e.guestAId;
        const otherGuest = guests.find(g => g.id === otherGuestId);
        debug.log(`    - Ne peut pas être avec: ${otherGuest?.firstName ?? 'Inconnu'} ${otherGuest?.lastName ?? ''}`);
      });
    }

    // Chercher d'abord une table où la famille est déjà présente
    const familyName = guest.lastName?.toLowerCase().trim();
    let preferredTableId: string | undefined;
    
    if (familyName && configuration.sortingCriteria.byFamily) {
      preferredTableId = familyTableMap.get(familyName);
      if (preferredTableId) {
        debug.log(`  Famille "${guest.lastName?.trim()}" déjà sur une table, essai de regroupement...`);
      }
    }

    // Trouver une table appropriée (en préférant la table familiale)
    const suitableTable = findSuitableTableWithFamilyPreference(
      tables,
      guestsToPlace,
      exclusions,
      configuration.seatsPerTable,
      warnings,
      guests,
      debug,
      preferredTableId
    );

    if (suitableTable) {
      // Placer les invités
      guestsToPlace.forEach((g) => {
        suitableTable.guests.push(g);
        placedGuestIds.add(g.id);
        
        // Enregistrer la table pour cette famille (avec trim)
        if (g.lastName && configuration.sortingCriteria.byFamily) {
          const fName = g.lastName.toLowerCase().trim();
          if (!familyTableMap.has(fName)) {
            familyTableMap.set(fName, suitableTable.id);
          }
        }
      });
      debug.log(`  ✓ Placé à ${suitableTable.name} (maintenant ${suitableTable.guests.length}/${suitableTable.capacity})`);
    } else {
      // Pas de table disponible - essayer la table d'honneur en dernier recours
      const honorTable = tables.find(t => t.number === 1);
      const guestNames = guestsToPlace.map(g => getFullName(g)).join(' et ');
      
      if (honorTable && honorTable.guests.length + guestsToPlace.length <= honorTable.capacity) {
        // Vérifier qu'il n'y a pas d'exclusion avec la table d'honneur
        const hasExclusionWithHonorTable = guestsToPlace.some(guestToPlace => {
          return exclusions.some(exc => {
            const isGuestInExclusion = exc.guestAId === guestToPlace.id || exc.guestBId === guestToPlace.id;
            if (!isGuestInExclusion) return false;
            const otherGuestId = exc.guestAId === guestToPlace.id ? exc.guestBId : exc.guestAId;
            return honorTable.guests.some(g => g.id === otherGuestId);
          });
        });
        
        if (!hasExclusionWithHonorTable) {
          // Placer sur la table d'honneur
          guestsToPlace.forEach((g) => {
            honorTable.guests.push(g);
            placedGuestIds.add(g.id);
          });
          debug.log(`  ⚠ Placé à ${honorTable.name} (dernier recours) (maintenant ${honorTable.guests.length}/${honorTable.capacity})`);
          warnings.push({
            type: 'exclusion_violated',
            message: `${guestNames} placé(s) à la table d'honneur faute de place ailleurs.`,
            guestIds: guestsToPlace.map(g => g.id),
          });
        } else {
          debug.log(`  ✗ ERREUR: Impossible de placer - toutes les tables pleines (exclusion avec table d'honneur)!`);
          warnings.push({
            type: 'exclusion_violated',
            message: `Impossible de placer ${guestNames} : toutes les tables sont pleines et exclusion avec la table d'honneur.`,
            guestIds: guestsToPlace.map(g => g.id),
          });
        }
      } else if (honorTable && honorTable.guests.length + guestsToPlace.length > honorTable.capacity) {
        debug.log(`  ✗ ERREUR: Impossible de placer - toutes les tables pleines (table d'honneur pleine aussi)!`);
        warnings.push({
          type: 'exclusion_violated',
          message: `Impossible de placer ${guestNames} : toutes les tables sont pleines, y compris la table d'honneur.`,
          guestIds: guestsToPlace.map(g => g.id),
        });
      } else {
        debug.log(`  ✗ ERREUR: Impossible de placer - toutes les tables pleines!`);
        warnings.push({
          type: 'exclusion_violated',
          message: `Impossible de placer ${guestNames} : toutes les tables sont pleines.`,
          guestIds: guestsToPlace.map(g => g.id),
        });
      }
    }
  }

  // 8. Mélanger aléatoirement si demandé (après le tri initial)
  if (configuration.sortingCriteria.random) {
    debug.log('\nMélange aléatoire activé');
    tables.forEach((table) => {
      if (table.number !== 1) {
        // Ne pas mélanger la table d'honneur
        shuffleArray(table.guests);
      }
    });
  }

  // Résumé final
  debug.section('RÉSUMÉ FINAL');
  tables.forEach(table => {
    debug.log(`${table.name}: ${table.guests.length}/${table.capacity} personnes`);
    table.guests.forEach(g => {
      debug.log(`  - ${g.firstName} ${g.lastName ?? ''} (ID: ${g.id.substring(0, 8)}...)`);
    });
  });
  
  if (warnings.length > 0) {
    debug.section('WARNINGS');
    warnings.forEach((w, i) => {
      debug.log(`${i + 1}. ${w.message}`);
    });
  }

  return {
    success: true,
    tables,
    warnings,
    errors: [],
    debugLog: debug.getOutput(),
  };
}

/**
 * Vérifie si un invité est auto-généré (pattern "Invité X" ou "Guest X")
 */
function isAutoGeneratedGuest(guest: Guest): boolean {
  const name = `${guest.firstName} ${guest.lastName ?? ''}`.trim();
  return /^(Invité|Guest)\s+\d+$/.test(name);
}

/**
 * Trie les invités selon les critères configurés
 * PRIORITÉ : Invités avec contraintes > Invités réels > Invités auto-générés
 */
function sortGuests(
  guests: Guest[],
  config: PlanConfiguration,
  _couples: Couple[],
  exclusions: ExclusionConstraint[] = []
): Guest[] {
  const sorted = [...guests];
  
  // Créer un set des IDs d'invités avec exclusions pour lookup rapide
  const guestsWithExclusions = new Set<string>();
  exclusions.forEach(e => {
    guestsWithExclusions.add(e.guestAId);
    guestsWithExclusions.add(e.guestBId);
  });

  // Ordre de priorité : Contraintes > Vrais invités > Auto-générés > Rôle > Famille > Âge
  sorted.sort((a, b) => {
    // 0. PRIORITÉ MAXIMALE : Invités avec exclusions en premier
    const aHasExclusion = guestsWithExclusions.has(a.id);
    const bHasExclusion = guestsWithExclusions.has(b.id);
    if (aHasExclusion && !bHasExclusion) return -1;
    if (!aHasExclusion && bHasExclusion) return 1;
    
    // 1. Invités auto-générés en DERNIER (ils peuvent aller n'importe où)
    const aIsAuto = isAutoGeneratedGuest(a);
    const bIsAuto = isAutoGeneratedGuest(b);
    if (aIsAuto && !bIsAuto) return 1;  // a après b
    if (!aIsAuto && bIsAuto) return -1; // a avant b
    
    // 2. Par rôle (témoins en premier - mais ils sont déjà à la table d'honneur)
    if (config.sortingCriteria.byRole) {
      const roleOrder = { married: 0, witness: 1, regular: 2 };
      const roleCompare = roleOrder[a.role] - roleOrder[b.role];
      if (roleCompare !== 0) return roleCompare;
    }

    // 3. Par famille (case-insensitive, trimmed)
    if (config.sortingCriteria.byFamily && a.lastName && b.lastName) {
      const familyCompare = a.lastName.toLowerCase().trim().localeCompare(b.lastName.toLowerCase().trim());
      if (familyCompare !== 0) return familyCompare;
    }

    // 4. Par âge (grouper les âges similaires)
    if (config.sortingCriteria.byAge && a.age !== undefined && b.age !== undefined) {
      return a.age - b.age;
    }

    return 0;
  });

  return sorted;
}

/**
 * Groupe les invités par famille (nom de famille, case-insensitive, trimmed)
 */
function groupByFamily(guests: Guest[]): Guest[][] {
  const familyMap = new Map<string, Guest[]>();

  guests.forEach((guest) => {
    // Normaliser en minuscules ET trimmer pour éviter les espaces parasites
    const familyKey = guest.lastName?.toLowerCase().trim() || '_no_family_';
    const family = familyMap.get(familyKey) ?? [];
    family.push(guest);
    familyMap.set(familyKey, family);
  });

  return Array.from(familyMap.values());
}

/**
 * Trouve une table appropriée pour un groupe d'invités (avec debug)
 */
function findSuitableTableWithDebug(
  tables: Table[],
  guestsToPlace: Guest[],
  exclusions: ExclusionConstraint[],
  seatsPerTable: number,
  warnings: Warning[],
  allGuests: Guest[],
  debug: DebugLogger
): Table | null {
  // Ignorer la table d'honneur (index 0)
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;
    
    debug.log(`  Essai ${table.name} (${table.guests.length}/${table.capacity}):`);
    
    // Vérifier la capacité
    if (table.guests.length + guestsToPlace.length > seatsPerTable) {
      debug.log(`    ✗ Table pleine`);
      continue;
    }

    // Vérifier les exclusions
    let hasExclusion = false;
    let exclusionDetails = '';

    for (const newGuest of guestsToPlace) {
      for (const existingGuest of table.guests) {
        if (haveExclusion(newGuest, existingGuest, exclusions)) {
          hasExclusion = true;
          exclusionDetails = `${newGuest.firstName} ne peut pas être avec ${existingGuest.firstName}`;
          break;
        }
      }
      if (hasExclusion) break;
    }

    if (!hasExclusion) {
      debug.log(`    ✓ Table OK - pas d'exclusion`);
      return table;
    } else {
      debug.log(`    ✗ Exclusion: ${exclusionDetails}`);
    }
  }

  // Si aucune table sans exclusion n'est trouvée, on applique le mode "best effort"
  debug.log(`  Mode "best effort" - recherche table avec place malgré exclusions...`);
  
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;
    
    if (table.guests.length + guestsToPlace.length <= seatsPerTable) {
      debug.log(`  ⚠ ${table.name} a de la place - placement forcé avec warnings`);
      
      // Ajouter des warnings pour les exclusions violées
      for (const newGuest of guestsToPlace) {
        for (const existingGuest of table.guests) {
          if (haveExclusion(newGuest, existingGuest, exclusions)) {
            const message = `${getFullName(newGuest)} et ${getFullName(existingGuest)} sont à la même table malgré l'exclusion.`;
            debug.log(`    ⚠ WARNING: ${message}`);
            warnings.push({
              type: 'exclusion_violated',
              message,
              guestIds: [newGuest.id, existingGuest.id],
            });
          }
        }
      }
      return table;
    }
  }

  return null;
}

/**
 * Trouve une table appropriée avec préférence pour la table familiale
 * Essaie d'abord la table où la famille est déjà présente
 */
function findSuitableTableWithFamilyPreference(
  tables: Table[],
  guestsToPlace: Guest[],
  exclusions: ExclusionConstraint[],
  seatsPerTable: number,
  warnings: Warning[],
  allGuests: Guest[],
  debug: DebugLogger,
  preferredTableId?: string
): Table | null {
  // Si on a une table préférée (famille déjà présente), essayer d'abord celle-là
  if (preferredTableId) {
    const preferredTable = tables.find(t => t.id === preferredTableId);
    if (preferredTable && preferredTable.number !== 1) { // Pas la table d'honneur
      debug.log(`  Essai table familiale ${preferredTable.name} (${preferredTable.guests.length}/${preferredTable.capacity}):`);
      
      // Vérifier la capacité
      if (preferredTable.guests.length + guestsToPlace.length <= seatsPerTable) {
        // Vérifier les exclusions
        let hasExclusion = false;
        let exclusionDetails = '';

        for (const newGuest of guestsToPlace) {
          for (const existingGuest of preferredTable.guests) {
            if (haveExclusion(newGuest, existingGuest, exclusions)) {
              hasExclusion = true;
              exclusionDetails = `${newGuest.firstName} ne peut pas être avec ${existingGuest.firstName}`;
              break;
            }
          }
          if (hasExclusion) break;
        }

        if (!hasExclusion) {
          debug.log(`    ✓ Table familiale OK - famille regroupée!`);
          return preferredTable;
        } else {
          debug.log(`    ✗ Exclusion sur table familiale: ${exclusionDetails}`);
        }
      } else {
        debug.log(`    ✗ Table familiale pleine, recherche autre table...`);
      }
    }
  }
  
  // Sinon, utiliser la logique standard
  return findSuitableTableWithDebug(tables, guestsToPlace, exclusions, seatsPerTable, warnings, allGuests, debug);
}

/**
 * Trouve une table appropriée pour un groupe d'invités
 */
function findSuitableTable(
  tables: Table[],
  guestsToPlace: Guest[],
  exclusions: ExclusionConstraint[],
  seatsPerTable: number,
  warnings: Warning[],
  _allGuests: Guest[]
): Table | null {
  // Ignorer la table d'honneur (index 0)
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;
    
    // Vérifier la capacité
    if (table.guests.length + guestsToPlace.length > seatsPerTable) {
      continue;
    }

    // Vérifier les exclusions
    let hasExclusion = false;

    for (const newGuest of guestsToPlace) {
      for (const existingGuest of table.guests) {
        if (haveExclusion(newGuest, existingGuest, exclusions)) {
          hasExclusion = true;
          // On va essayer de trouver une autre table
          break;
        }
      }
      if (hasExclusion) break;
    }

    if (!hasExclusion) {
      return table;
    }
  }

  // Si aucune table sans exclusion n'est trouvée, on applique le mode "best effort"
  // On cherche une table avec de la place et on ajoute un warning
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;
    
    if (table.guests.length + guestsToPlace.length <= seatsPerTable) {
      // Ajouter des warnings pour les exclusions violées
      for (const newGuest of guestsToPlace) {
        for (const existingGuest of table.guests) {
          if (haveExclusion(newGuest, existingGuest, exclusions)) {
            warnings.push({
              type: 'exclusion_violated',
              message: `${getFullName(newGuest)} et ${getFullName(existingGuest)} sont à la même table malgré l'exclusion.`,
              guestIds: [newGuest.id, existingGuest.id],
            });
          }
        }
      }
      return table;
    }
  }

  return null; // Créer une nouvelle table
}

/**
 * Mélange un tableau aléatoirement (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Génère le contenu CSV pour l'export
 */
export function generateCSV(tables: Table[]): string {
  const headers = ['Numéro Table', 'Nom Table', 'Invité', 'Rôle', 'Famille'];
  const rows: string[] = [headers.join(',')];

  tables.forEach((table) => {
    table.guests.forEach((guest) => {
      const roleLabels: Record<string, string> = {
        married: 'Marié(e)',
        witness: 'Témoin',
        regular: 'Invité',
      };
      
      rows.push(
        [
          table.number.toString(),
          `"${table.name}"`,
          `"${getFullName(guest)}"`,
          roleLabels[guest.role] ?? 'Invité',
          guest.lastName ? `"${guest.lastName}"` : '',
        ].join(',')
      );
    });
  });

  return rows.join('\n');
}

/**
 * Télécharge un fichier
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
