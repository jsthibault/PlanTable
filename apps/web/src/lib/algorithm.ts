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
 * Generates a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Gets the full name of a guest
 */
function getFullName(guest: Guest): string {
  return guest.lastName
    ? `${guest.firstName} ${guest.lastName}`
    : guest.firstName;
}

/**
 * Checks if two guests have an exclusion between them
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
 * Gets the partner of a guest in a couple
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
 * Validates if a configuration is feasible
 */
export function validateConfiguration(input: AlgorithmInput): ValidationResult {
  const errors: string[] = [];
  const { guests, couples, exclusions, configuration } = input;

  // 1. Check that there are guests
  if (guests.length === 0) {
    errors.push('No guests have been added.');
    return { isValid: false, errors };
  }

  // 2. Calculate available seats
  const honorTableGuests = guests.filter(
    (g) => g.role === 'married' || g.role === 'witness'
  );

  // Check that the honor table can accommodate all witnesses/married + their partners
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
      `The honor table can only accommodate ${configuration.honorTableSeats} people, ` +
      `but ${honorTableWithPartners.size} people need to be seated there ` +
      `(witnesses/married and their partners).`
    );
  }

  // 3. Check for circular exclusion constraints
  // Ex: A excludes B, B excludes C, C excludes A and they are all in couples
  const exclusionGraph = new Map<string, Set<string>>();

  guests.forEach((g) => {
    exclusionGraph.set(g.id, new Set());
  });

  exclusions.forEach((e) => {
    exclusionGraph.get(e.guestAId)?.add(e.guestBId);
    exclusionGraph.get(e.guestBId)?.add(e.guestAId);
  });

  // 4. Check that a couple does not have an internal exclusion
  couples.forEach((couple) => {
    if (exclusionGraph.get(couple.guestAId)?.has(couple.guestBId)) {
      const guestA = guests.find((g) => g.id === couple.guestAId);
      const guestB = guests.find((g) => g.id === couple.guestBId);
      if (guestA && guestB) {
        errors.push(
          `Conflict: ${getFullName(guestA)} and ${getFullName(guestB)} ` +
          `are a couple but have an exclusion between them.`
        );
      }
    }
  });

  // Note: The number of tables is now manually configured

  // 6. Check that groups (couples + exclusions) can fit
  // A group linked by couple cannot exceed a table
  const coupleGroups = findCoupleGroups(guests, couples);
  coupleGroups.forEach((group) => {
    const groupInHonorTable = group.some((gId) => honorTableWithPartners.has(gId));
    const maxCapacity = groupInHonorTable
      ? configuration.honorTableSeats
      : configuration.seatsPerTable;

    if (group.length > maxCapacity) {
      const names = group.map((g) => {
        const guest = guests.find((gu) => gu.id === g);
        return guest ? getFullName(guest) : 'Unknown';
      }).join(', ');
      errors.push(
        `The couple group (${names}) contains ${group.length} people, ` +
        `but the maximum table capacity is ${maxCapacity}.`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Finds groups connected by couples
 */
function findCoupleGroups(guests: Guest[], couples: Couple[]): string[][] {
  const visited = new Set<string>();
  const groups: string[][] = [];

  function dfs(guestId: string, group: string[]): void {
    if (visited.has(guestId)) return;
    visited.add(guestId);
    group.push(guestId);

    // Find linked couples
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
 * Helper class for debug logging
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

  debug.section('GENERATION START');
  debug.log(`Number of guests: ${guests.length}`);
  debug.log(`Number of couples: ${couples.length}`);
  debug.log(`Number of exclusions: ${exclusions.length}`);
  debug.log(`Configuration: ${configuration.numberOfTables} tables of ${configuration.seatsPerTable} seats + honor table (${configuration.honorTableSeats} seats)`);

  // Lister toutes les exclusions
  if (exclusions.length > 0) {
    debug.section('DEFINED EXCLUSIONS');
    exclusions.forEach((e, i) => {
      const guestA = guests.find(g => g.id === e.guestAId);
      const guestB = guests.find(g => g.id === e.guestBId);
      debug.log(`${i + 1}. "${guestA?.firstName ?? 'Unknown'} ${guestA?.lastName ?? ''}" <-> "${guestB?.firstName ?? 'Unknown'} ${guestB?.lastName ?? ''}"`);
      debug.log(`   IDs: ${e.guestAId} <-> ${e.guestBId}`);
    });
  }

  // 1. Validation préliminaire
  debug.section('VALIDATION');
  const validation = validateConfiguration(input);
  if (!validation.isValid) {
    debug.log(`FAILED: ${validation.errors.join(', ')}`);
    return {
      success: false,
      tables: [],
      warnings: [],
      errors: validation.errors,
      debugLog: debug.getOutput(),
    };
  }
  debug.log('Validation OK');

  // 2. Create the honor table
  debug.section('TABLE CREATION');
  const honorTable: Table = {
    id: generateId(),
    number: 1,
    name: 'Table d\'honneur',
    guests: [],
    capacity: configuration.honorTableSeats,
  };
  tables.push(honorTable);
  debug.log(`Honor table created (ID: ${honorTable.id}, capacity: ${honorTable.capacity})`);

  // 2b. Pre-create tables according to configuration
  for (let i = 0; i < configuration.numberOfTables; i++) {
    const table = {
      id: generateId(),
      number: i + 2,
      name: `Table ${i + 2}`,
      guests: [],
      capacity: configuration.seatsPerTable,
    };
    tables.push(table);
    debug.log(`Table ${i + 2} created (ID: ${table.id}, capacity: ${table.capacity})`);
  }

  // 3. Identify honor table guests (married, witnesses + partners)
  debug.section('HONOR TABLE');
  const honorTableGuestIds = new Set<string>();
  const honorGuests = guests.filter(
    (g) => g.role === 'married' || g.role === 'witness'
  );

  honorGuests.forEach((g) => {
    honorTableGuestIds.add(g.id);
    debug.log(`Adding to honor table: ${g.firstName} ${g.lastName ?? ''} (${g.role})`);
    const partner = getCouplePartner(g, couples, guests);
    if (partner) {
      honorTableGuestIds.add(partner.id);
      debug.log(`  + partner: ${partner.firstName} ${partner.lastName ?? ''}`);
    }
  });

  // Place honor table guests
  guests
    .filter((g) => honorTableGuestIds.has(g.id))
    .forEach((g) => {
      honorTable.guests.push(g);
    });
  debug.log(`Honor table total: ${honorTable.guests.length} guests`);

  // 4. Prepare remaining guests
  debug.section('PLACING OTHER GUESTS');
  let remainingGuests = guests.filter((g) => !honorTableGuestIds.has(g.id));
  debug.log(`Remaining guests to place: ${remainingGuests.length}`);

  // 5. Sort according to criteria (exclusions first, auto-generated last)
  remainingGuests = sortGuests(remainingGuests, configuration, couples, exclusions);

  // Log sorting order
  const guestsWithConstraints = remainingGuests.filter(g =>
    exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id)
  );
  const autoGenerated = remainingGuests.filter(g => isAutoGeneratedGuest(g));
  const realGuests = remainingGuests.filter(g =>
    !isAutoGeneratedGuest(g) && !guestsWithConstraints.includes(g)
  );

  debug.log(`Placement order:`);
  debug.log(`  1. Guests with exclusions: ${guestsWithConstraints.length}`);
  guestsWithConstraints.forEach(g => debug.log(`     - ${g.firstName} ${g.lastName ?? ''}`));
  debug.log(`  2. Other real guests: ${realGuests.length}`);
  debug.log(`  3. Auto-generated guests: ${autoGenerated.length}`);

  // 6. Group by family if criteria is active
  // PLACEMENT LOGIC:
  // - LARGE families first (to have enough space)
  // - Each family also includes partners (even if they have a different name)
  // - Auto-generated guests last
  let orderedGuests: Guest[];

  if (configuration.sortingCriteria.byFamily) {
    // Separate real guests from auto-generated
    const realGuestsAll = remainingGuests.filter(g => !isAutoGeneratedGuest(g));
    const autoGeneratedAll = remainingGuests.filter(g => isAutoGeneratedGuest(g));

    // Group real guests by family
    const familyGroups = groupByFamily(realGuestsAll);

    // IMPORTANT: Sort groups by size BEFORE creating extended groups
    // This ensures that large families keep their members
    // (e.g., pauline thibault stays with the Thibaults, not with her partner's group)
    familyGroups.sort((a, b) => b.length - a.length);

    // Extend each family group to include partners
    // (even if they have a different last name)
    const extendedFamilyGroups: Guest[][] = [];
    const processedGuestIds = new Set<string>();

    for (const group of familyGroups) {
      const extendedGroup: Guest[] = [];

      for (const member of group) {
        if (processedGuestIds.has(member.id)) continue;

        extendedGroup.push(member);
        processedGuestIds.add(member.id);

        // Add partner if not already in the group
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

    // Sort groups by SIZE (largest to smallest)
    extendedFamilyGroups.sort((groupA, groupB) => {
      // Priority 1: Group size (largest to smallest)
      const sizeDiff = groupB.length - groupA.length;
      if (sizeDiff !== 0) return sizeDiff;

      // Priority 2: If same size, those with exclusions first
      const aHasExclusion = groupA.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      const bHasExclusion = groupB.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      if (aHasExclusion && !bHasExclusion) return -1;
      if (!aHasExclusion && bHasExclusion) return 1;

      return 0;
    });

    // Within each group, put guests with exclusions first
    const sortedFamilyGroups = extendedFamilyGroups.map(group => {
      return group.sort((a, b) => {
        const aHasExclusion = exclusions.some(e => e.guestAId === a.id || e.guestBId === a.id);
        const bHasExclusion = exclusions.some(e => e.guestAId === b.id || e.guestBId === b.id);
        if (aHasExclusion && !bHasExclusion) return -1;
        if (!aHasExclusion && bHasExclusion) return 1;
        return 0;
      });
    });

    // Rebuild the list: grouped families (largest first) then auto-generated
    orderedGuests = [...sortedFamilyGroups.flat(), ...autoGeneratedAll];

    debug.log(`Extended family groups (with partners, sorted by size):`);
    sortedFamilyGroups.forEach((group, i) => {
      const familyName = group[0]?.lastName?.trim() ?? 'No name';
      const hasExclusion = group.some(g => exclusions.some(e => e.guestAId === g.id || e.guestBId === g.id));
      const members = group.map(g => `${g.firstName} ${g.lastName ?? ''}`.trim()).join(', ');
      debug.log(`  ${i + 1}. ${familyName} (${group.length} pers.)${hasExclusion ? ' ⚠ has exclusions' : ''}`);
      debug.log(`     Members: ${members}`);
    });
  } else {
    // Without family grouping, just sort: real guests first, auto-generated after
    const realGuestsAll = remainingGuests.filter(g => !isAutoGeneratedGuest(g));
    const autoGeneratedAll = remainingGuests.filter(g => isAutoGeneratedGuest(g));

    // Sort real guests: those with exclusions first
    realGuestsAll.sort((a, b) => {
      const aHasExclusion = exclusions.some(e => e.guestAId === a.id || e.guestBId === a.id);
      const bHasExclusion = exclusions.some(e => e.guestAId === b.id || e.guestBId === b.id);
      if (aHasExclusion && !bHasExclusion) return -1;
      if (!aHasExclusion && bHasExclusion) return 1;
      return 0;
    });

    orderedGuests = [...realGuestsAll, ...autoGeneratedAll];
    debug.log(`No family grouping`);
  }

  // 7. Place guests table by table
  // LOGIC: Try to keep families together, and couples as priority
  const placedGuestIds = new Set(honorTableGuestIds);

  // Map to track which table contains which family names
  const familyTableMap = new Map<string, string>(); // familyName -> tableId

  for (const guest of orderedGuests) {
    if (placedGuestIds.has(guest.id)) continue;

    // Find partner if there is one (ALWAYS keep couples together)
    const partner = getCouplePartner(guest, couples, guests);
    const guestsToPlace = partner && !placedGuestIds.has(partner.id)
      ? [guest, partner]
      : [guest];

    debug.log(`\nFinding table for: ${guestsToPlace.map(g => `${g.firstName} ${g.lastName ?? ''}`).join(' + ')}`);

    // Check exclusions for these guests
    const guestExclusions = exclusions.filter(e =>
      guestsToPlace.some(g => e.guestAId === g.id || e.guestBId === g.id)
    );
    if (guestExclusions.length > 0) {
      debug.log(`  Exclusions for these guests:`);
      guestExclusions.forEach(e => {
        const otherGuestId = guestsToPlace.some(g => g.id === e.guestAId) ? e.guestBId : e.guestAId;
        const otherGuest = guests.find(g => g.id === otherGuestId);
        debug.log(`    - Cannot sit with: ${otherGuest?.firstName ?? 'Unknown'} ${otherGuest?.lastName ?? ''}`);
      });
    }

    // First look for a table where the family is already present
    const familyName = guest.lastName?.toLowerCase().trim();
    let preferredTableId: string | undefined;

    if (familyName && configuration.sortingCriteria.byFamily) {
      preferredTableId = familyTableMap.get(familyName);
      if (preferredTableId) {
        debug.log(`  Family "${guest.lastName?.trim()}" already on a table, trying to group...`);
      }
    }

    // Find a suitable table (preferring family table)
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
      // Place the guests
      guestsToPlace.forEach((g) => {
        suitableTable.guests.push(g);
        placedGuestIds.add(g.id);

        // Register the table for this family (with trim)
        if (g.lastName && configuration.sortingCriteria.byFamily) {
          const fName = g.lastName.toLowerCase().trim();
          if (!familyTableMap.has(fName)) {
            familyTableMap.set(fName, suitableTable.id);
          }
        }
      });
      debug.log(`  ✓ Placed at ${suitableTable.name} (now ${suitableTable.guests.length}/${suitableTable.capacity})`);
    } else {
      // No table available - try honor table as last resort
      const honorTable = tables.find(t => t.number === 1);
      const guestNames = guestsToPlace.map(g => getFullName(g)).join(' and ');

      if (honorTable && honorTable.guests.length + guestsToPlace.length <= honorTable.capacity) {
        // Check there's no exclusion with the honor table
        const hasExclusionWithHonorTable = guestsToPlace.some(guestToPlace => {
          return exclusions.some(exc => {
            const isGuestInExclusion = exc.guestAId === guestToPlace.id || exc.guestBId === guestToPlace.id;
            if (!isGuestInExclusion) return false;
            const otherGuestId = exc.guestAId === guestToPlace.id ? exc.guestBId : exc.guestAId;
            return honorTable.guests.some(g => g.id === otherGuestId);
          });
        });

        if (!hasExclusionWithHonorTable) {
          // Place on honor table
          guestsToPlace.forEach((g) => {
            honorTable.guests.push(g);
            placedGuestIds.add(g.id);
          });
          debug.log(`  ⚠ Placed at ${honorTable.name} (last resort) (now ${honorTable.guests.length}/${honorTable.capacity})`);
          warnings.push({
            type: 'exclusion_violated',
            message: `${guestNames} placed at honor table due to lack of space elsewhere.`,
            guestIds: guestsToPlace.map(g => g.id),
          });
        } else {
          debug.log(`  ✗ ERROR: Cannot place - all tables full (exclusion with honor table)!`);
          warnings.push({
            type: 'exclusion_violated',
            message: `Cannot place ${guestNames}: all tables are full and exclusion with honor table.`,
            guestIds: guestsToPlace.map(g => g.id),
          });
        }
      } else if (honorTable && honorTable.guests.length + guestsToPlace.length > honorTable.capacity) {
        debug.log(`  ✗ ERROR: Cannot place - all tables full (honor table also full)!`);
        warnings.push({
          type: 'exclusion_violated',
          message: `Cannot place ${guestNames}: all tables are full, including honor table.`,
          guestIds: guestsToPlace.map(g => g.id),
        });
      } else {
        debug.log(`  ✗ ERROR: Cannot place - all tables full!`);
        warnings.push({
          type: 'exclusion_violated',
          message: `Cannot place ${guestNames}: all tables are full.`,
          guestIds: guestsToPlace.map(g => g.id),
        });
      }
    }
  }

  // 8. Shuffle randomly if requested (after initial sort)
  if (configuration.sortingCriteria.random) {
    debug.log('\nRandom shuffle enabled');
    tables.forEach((table) => {
      if (table.number !== 1) {
        // Don't shuffle the honor table
        shuffleArray(table.guests);
      }
    });
  }

  // Final summary
  debug.section('FINAL SUMMARY');
  tables.forEach(table => {
    debug.log(`${table.name}: ${table.guests.length}/${table.capacity} guests`);
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
 * Checks if a guest is auto-generated (pattern "Invité X" or "Guest X")
 */
export function isAutoGeneratedGuest(guest: Guest): boolean {
  const name = `${guest.firstName} ${guest.lastName ?? ''}`.trim();
  return /^(Invité|Guest)\s+\d+$/.test(name);
}

/**
 * Sorts guests according to configured criteria
 * PRIORITY: Guests with constraints > Real guests > Auto-generated guests
 */
function sortGuests(
  guests: Guest[],
  config: PlanConfiguration,
  _couples: Couple[],
  exclusions: ExclusionConstraint[] = []
): Guest[] {
  const sorted = [...guests];

  // Create a set of guest IDs with exclusions for fast lookup
  const guestsWithExclusions = new Set<string>();
  exclusions.forEach(e => {
    guestsWithExclusions.add(e.guestAId);
    guestsWithExclusions.add(e.guestBId);
  });

  // Priority order: Constraints > Real guests > Auto-generated > Role > Family > Age
  sorted.sort((a, b) => {
    // 0. TOP PRIORITY: Guests with exclusions first
    const aHasExclusion = guestsWithExclusions.has(a.id);
    const bHasExclusion = guestsWithExclusions.has(b.id);
    if (aHasExclusion && !bHasExclusion) return -1;
    if (!aHasExclusion && bHasExclusion) return 1;

    // 1. Auto-generated guests LAST (they can go anywhere)
    const aIsAuto = isAutoGeneratedGuest(a);
    const bIsAuto = isAutoGeneratedGuest(b);
    if (aIsAuto && !bIsAuto) return 1;  // a après b
    if (!aIsAuto && bIsAuto) return -1; // a avant b

    // 2. By role (witnesses first - but they are already at the honor table)
    if (config.sortingCriteria.byRole) {
      const roleOrder: Record<string, number> = { married: 0, witness: 1, bridesmaid: 2, groomsman: 2, regular: 3 };
      const roleCompare = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
      if (roleCompare !== 0) return roleCompare;
    }

    // 3. By family (case-insensitive, trimmed)
    if (config.sortingCriteria.byFamily && a.lastName && b.lastName) {
      const familyCompare = a.lastName.toLowerCase().trim().localeCompare(b.lastName.toLowerCase().trim());
      if (familyCompare !== 0) return familyCompare;
    }

    // 4. By age (group similar ages)
    if (config.sortingCriteria.byAge && a.age !== undefined && b.age !== undefined) {
      return a.age - b.age;
    }

    return 0;
  });

  return sorted;
}

/**
 * Groups guests by family (last name, case-insensitive, trimmed)
 */
function groupByFamily(guests: Guest[]): Guest[][] {
  const familyMap = new Map<string, Guest[]>();

  guests.forEach((guest) => {
    // Normalize to lowercase AND trim to avoid stray spaces
    const familyKey = guest.lastName?.toLowerCase().trim() || '_no_family_';
    const family = familyMap.get(familyKey) ?? [];
    family.push(guest);
    familyMap.set(familyKey, family);
  });

  return Array.from(familyMap.values());
}

/**
 * Finds a suitable table for a group of guests (with debug)
 */
function findSuitableTableWithDebug(
  tables: Table[],
  guestsToPlace: Guest[],
  exclusions: ExclusionConstraint[],
  seatsPerTable: number,
  warnings: Warning[],
  _allGuests: Guest[],
  debug: DebugLogger
): Table | null {
  // Skip honor table (index 0)
  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;

    debug.log(`  Trying ${table.name} (${table.guests.length}/${table.capacity}):`);

    // Check capacity
    if (table.guests.length + guestsToPlace.length > seatsPerTable) {
      debug.log(`    ✗ Table full`);
      continue;
    }

    // Check exclusions
    let hasExclusion = false;
    let exclusionDetails = '';

    for (const newGuest of guestsToPlace) {
      for (const existingGuest of table.guests) {
        if (haveExclusion(newGuest, existingGuest, exclusions)) {
          hasExclusion = true;
          exclusionDetails = `${newGuest.firstName} cannot sit with ${existingGuest.firstName}`;
          break;
        }
      }
      if (hasExclusion) break;
    }

    if (!hasExclusion) {
      debug.log(`    ✓ Table OK - no exclusion`);
      return table;
    } else {
      debug.log(`    ✗ Exclusion: ${exclusionDetails}`);
    }
  }

  // If no table without exclusion is found, apply "best effort" mode
  debug.log(`  "Best effort" mode - searching for table with space despite exclusions...`);

  for (let i = 1; i < tables.length; i++) {
    const table = tables[i];
    if (!table) continue;

    if (table.guests.length + guestsToPlace.length <= seatsPerTable) {
      debug.log(`  ⚠ ${table.name} has space - forced placement with warnings`);

      // Add warnings for violated exclusions
      for (const newGuest of guestsToPlace) {
        for (const existingGuest of table.guests) {
          if (haveExclusion(newGuest, existingGuest, exclusions)) {
            const message = `${getFullName(newGuest)} and ${getFullName(existingGuest)} are at the same table despite exclusion.`;
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
 * Finds a suitable table with preference for family table
 * Tries first the table where the family is already present
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
  // If we have a preferred table (family already present), try that first
  if (preferredTableId) {
    const preferredTable = tables.find(t => t.id === preferredTableId);
    if (preferredTable && preferredTable.number !== 1) { // Not the honor table
      debug.log(`  Trying family table ${preferredTable.name} (${preferredTable.guests.length}/${preferredTable.capacity}):`);

      // Check capacity
      if (preferredTable.guests.length + guestsToPlace.length <= seatsPerTable) {
        // Check exclusions
        let hasExclusion = false;
        let exclusionDetails = '';

        for (const newGuest of guestsToPlace) {
          for (const existingGuest of preferredTable.guests) {
            if (haveExclusion(newGuest, existingGuest, exclusions)) {
              hasExclusion = true;
              exclusionDetails = `${newGuest.firstName} cannot sit with ${existingGuest.firstName}`;
              break;
            }
          }
          if (hasExclusion) break;
        }

        if (!hasExclusion) {
          debug.log(`    ✓ Family table OK - family grouped!`);
          return preferredTable;
        } else {
          debug.log(`    ✗ Exclusion on family table: ${exclusionDetails}`);
        }
      } else {
        debug.log(`    ✗ Family table full, searching other table...`);
      }
    }
  }

  // Otherwise, use standard logic
  return findSuitableTableWithDebug(tables, guestsToPlace, exclusions, seatsPerTable, warnings, allGuests, debug);
}

/**
 * Shuffles an array randomly (Fisher-Yates)
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
 * Generates CSV content for export
 */
export function generateCSV(tables: Table[]): string {
  const headers = ['Table Number', 'Table Name', 'Guest', 'Role', 'Family'];
  const rows: string[] = [headers.join(',')];

  tables.forEach((table) => {
    table.guests.forEach((guest) => {
      const roleLabels: Record<string, string> = {
        married: 'Married',
        witness: 'Witness',
        regular: 'Guest',
      };

      rows.push(
        [
          table.number.toString(),
          `"${table.name}"`,
          `"${getFullName(guest)}"`,
          roleLabels[guest.role] ?? 'Guest',
          guest.lastName ? `"${guest.lastName}"` : '',
        ].join(',')
      );
    });
  });

  return rows.join('\n');
}

/**
 * Downloads a file
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
