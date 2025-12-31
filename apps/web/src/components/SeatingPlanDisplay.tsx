import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Crown, Users, AlertTriangle, GripVertical, Heart, Pencil, Check, X, Bug, Copy, CheckCheck, RefreshCw, HeartCrack, UserX, Circle, Square } from 'lucide-react';
import type { Guest, Table } from '@/types';

export function SeatingPlanDisplay() {
  const { result, viewMode, setViewMode, moveGuestToTable, couples, planNeedsRegeneration, generate, exclusions, configuration } = useAppStore();
  const { locale } = useI18n();
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Vérifier les contraintes à chaque changement du plan
  const constraintWarnings = useMemo(() => {
    if (!result || !result.success) return [];
    
    const warnings: { type: 'exclusion' | 'couple' | 'family' | 'capacity'; message: string }[] = [];
    
    // Exclure la table d'honneur des vérifications (sauf capacité)
    const tablesToCheck = result.tables.filter(t => t.number !== 1);
    
    // 0. Vérifier la capacité de toutes les tables (y compris table d'honneur)
    for (const table of result.tables) {
      if (table.guests.length > table.capacity) {
        warnings.push({
          type: 'capacity',
          message: locale === 'fr'
            ? `${table.name} dépasse sa capacité (${table.guests.length}/${table.capacity})`
            : `${table.name} exceeds capacity (${table.guests.length}/${table.capacity})`
        });
      }
    }
    
    // 1. Vérifier les exclusions (personnes qui NE doivent PAS être ensemble)
    for (const exclusion of exclusions) {
      let tableA: string | null = null;
      let tableB: string | null = null;
      let guestA: Guest | undefined;
      let guestB: Guest | undefined;
      
      for (const table of tablesToCheck) {
        const foundA = table.guests.find(g => g.id === exclusion.guestAId);
        const foundB = table.guests.find(g => g.id === exclusion.guestBId);
        if (foundA) { tableA = table.id; guestA = foundA; }
        if (foundB) { tableB = table.id; guestB = foundB; }
      }
      
      if (tableA && tableB && tableA === tableB && guestA && guestB) {
        warnings.push({
          type: 'exclusion',
          message: locale === 'fr'
            ? `${guestA.firstName} et ${guestB.firstName} ne devraient pas être à la même table`
            : `${guestA.firstName} and ${guestB.firstName} should not be at the same table`
        });
      }
    }
    
    // 2. Vérifier les couples (personnes qui DOIVENT être ensemble)
    for (const couple of couples) {
      let tableA: string | null = null;
      let tableB: string | null = null;
      let guestA: Guest | undefined;
      let guestB: Guest | undefined;
      
      for (const table of tablesToCheck) {
        const foundA = table.guests.find(g => g.id === couple.guestAId);
        const foundB = table.guests.find(g => g.id === couple.guestBId);
        if (foundA) { tableA = table.id; guestA = foundA; }
        if (foundB) { tableB = table.id; guestB = foundB; }
      }
      
      // Seulement si les deux sont sur des tables normales (pas la table d'honneur)
      if (tableA && tableB && tableA !== tableB && guestA && guestB) {
        warnings.push({
          type: 'couple',
          message: locale === 'fr'
            ? `${guestA.firstName} et ${guestB.firstName} sont en couple mais séparés`
            : `${guestA.firstName} and ${guestB.firstName} are a couple but separated`
        });
      }
    }
    
    // 3. Vérifier les familles (si option activée)
    if (configuration.sortingCriteria.byFamily) {
      // Grouper les invités par table et par nom de famille (hors table d'honneur)
      const familyByTable = new Map<string, Map<string, Guest[]>>();
      
      for (const table of tablesToCheck) {
        const families = new Map<string, Guest[]>();
        for (const guest of table.guests) {
          const familyName = (guest.lastName ?? '').toLowerCase().trim();
          if (!familyName || guest.firstName.startsWith('Invité')) continue; // Ignorer les auto-générés
          
          if (!families.has(familyName)) {
            families.set(familyName, []);
          }
          families.get(familyName)!.push(guest);
        }
        familyByTable.set(table.id, families);
      }
      
      // Compter combien de personnes de chaque famille sont sur chaque table
      const familyDistribution = new Map<string, { tables: Map<string, number>; total: number }>();
      
      for (const [tableId, families] of familyByTable) {
        for (const [familyName, members] of families) {
          if (!familyDistribution.has(familyName)) {
            familyDistribution.set(familyName, { tables: new Map(), total: 0 });
          }
          const dist = familyDistribution.get(familyName)!;
          dist.tables.set(tableId, members.length);
          dist.total += members.length;
        }
      }
      
      // Signaler les familles qui sont séparées (sur plus d'une table)
      for (const [familyName, dist] of familyDistribution) {
        if (dist.tables.size > 1 && dist.total >= 2) {
          // Trouver les noms pour le message
          const familyGuests: string[] = [];
          for (const table of tablesToCheck) {
            for (const guest of table.guests) {
              if ((guest.lastName ?? '').toLowerCase().trim() === familyName) {
                familyGuests.push(guest.firstName);
              }
            }
          }
          
          warnings.push({
            type: 'family',
            message: locale === 'fr'
              ? `Famille ${familyName} séparée (${familyGuests.join(', ')})`
              : `Family ${familyName} separated (${familyGuests.join(', ')})`
          });
        }
      }
    }
    
    return warnings;
  }, [result, exclusions, couples, configuration.sortingCriteria.byFamily, locale]);

  const handleCopyDebug = async () => {
    if (result?.debugLog) {
      await navigator.clipboard.writeText(result.debugLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!result) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{locale === 'fr' ? 'Configurez les invités et générez le plan de table' : 'Configure guests and generate the seating plan'}</p>
      </div>
    );
  }

  // Afficher les erreurs si la génération a échoué
  if (!result.success) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>{locale === 'fr' ? 'Impossible de générer le plan de table' : 'Cannot generate seating plan'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {result.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const guestId = event.active.id as string;
    // Trouver l'invité dans toutes les tables
    for (const table of result.tables) {
      const guest = table.guests.find((g) => g.id === guestId);
      if (guest) {
        setActiveGuest(guest);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGuest(null);

    if (!over) return;

    const guestId = active.id as string;
    const targetTableId = over.id as string;

    // Vérifier si on drop sur une table (les IDs de table commencent par "table-drop-")
    if (targetTableId.startsWith('table-drop-')) {
      const realTableId = targetTableId.replace('table-drop-', '');
      moveGuestToTable(guestId, realTableId);
    }
  };

  const isInCouple = (guestId: string): boolean => {
    return couples.some((c) => c.guestAId === guestId || c.guestBId === guestId);
  };

  return (
    <div className="space-y-4">
      {/* Avertissements de contraintes non respectées */}
      {constraintWarnings.length > 0 && (
        <Alert className="animate-in fade-in slide-in-from-top-2 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            {locale === 'fr' ? 'Contraintes non respectées' : 'Constraints not respected'}
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            <ul className="list-disc list-inside mt-2 space-y-1">
              {constraintWarnings.map((warning, index) => (
                <li key={index} className="flex items-center gap-2">
                  {warning.type === 'exclusion' && <UserX className="h-3 w-3 inline" />}
                  {warning.type === 'couple' && <HeartCrack className="h-3 w-3 inline" />}
                  {warning.type === 'family' && <Users className="h-3 w-3 inline" />}
                  {warning.type === 'capacity' && <AlertTriangle className="h-3 w-3 inline" />}
                  {warning.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Plan obsolète - demande de régénération */}
      {planNeedsRegeneration && (
        <Alert className="bg-amber-50 border-amber-200">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">
            {locale === 'fr' ? 'Plan obsolète' : 'Plan outdated'}
          </AlertTitle>
          <AlertDescription className="text-amber-700">
            <div className="flex items-center justify-between">
              <span>
                {locale === 'fr' 
                  ? 'Des modifications ont été apportées. Régénérez le plan pour les prendre en compte.'
                  : 'Changes have been made. Regenerate the plan to apply them.'}
              </span>
              <Button 
                size="sm" 
                onClick={generate}
                className="ml-4 bg-amber-600 hover:bg-amber-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {locale === 'fr' ? 'Régénérer' : 'Regenerate'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{locale === 'fr' ? 'Avertissements' : 'Warnings'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Debug Panel */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDebug(!showDebug)}
          className="gap-2"
        >
          <Bug className="h-4 w-4" />
          {showDebug ? (locale === 'fr' ? 'Masquer debug' : 'Hide debug') : 'Debug'}
        </Button>
      </div>

      {showDebug && result.debugLog && (
        <Card className="bg-slate-950 text-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                {locale === 'fr' ? 'Log de l\'algorithme' : 'Algorithm Log'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyDebug}
                className="text-slate-300 hover:text-white"
              >
                {copied ? (
                  <>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    {locale === 'fr' ? 'Copié !' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {locale === 'fr' ? 'Copier' : 'Copy'}
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96 p-2 bg-slate-900 rounded">
              {result.debugLog}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tabs pour les deux modes de vue */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'cards' | 'visual')}>
        <TabsList>
          <TabsTrigger value="cards">{locale === 'fr' ? '📋 Vue Cartes' : '📋 Card View'}</TabsTrigger>
          <TabsTrigger value="visual">{locale === 'fr' ? '🎯 Vue Visuelle' : '🎯 Visual View'}</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {result.tables.map((table) => (
                <DroppableTableCard
                  key={table.id}
                  table={table}
                  isInCouple={isInCouple}
                  locale={locale}
                />
              ))}
            </div>

            <DragOverlay>
              {activeGuest ? (
                <div className="bg-primary text-primary-foreground px-3 py-2 rounded-md shadow-lg">
                  <span className="font-medium">
                    {activeGuest.firstName} {activeGuest.lastName ?? ''}
                  </span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="visual">
          <VisualTableView tables={result.tables} isInCouple={isInCouple} locale={locale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// DROPPABLE TABLE CARD
// ============================================

interface DroppableTableCardProps {
  table: Table;
  isInCouple: (guestId: string) => boolean;
  locale: 'fr' | 'en';
}

function DroppableTableCard({ table, isInCouple, locale }: DroppableTableCardProps) {
  const { renameTable } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(table.name);

  const { setNodeRef, isOver } = useDroppable({
    id: `table-drop-${table.id}`,
  });

  const isHonorTable = table.number === 1;
  const isFull = table.guests.length >= table.capacity;

  const handleSaveName = () => {
    if (editName.trim()) {
      renameTable(table.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(table.name);
    setIsEditing(false);
  };

  return (
    <Card
      ref={setNodeRef}
      className={`
        transition-all duration-200
        ${isHonorTable ? 'ring-2 ring-primary' : ''}
        ${isOver && !isFull ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' : ''}
        ${isOver && isFull ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950' : ''}
      `}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isHonorTable && <Crown className="h-4 w-4 text-primary" />}
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 w-28 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleSaveName}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <span
                className="cursor-pointer hover:text-primary flex items-center gap-1"
                onClick={() => setIsEditing(true)}
              >
                {table.name}
                <Pencil className="h-3 w-3 opacity-50" />
              </span>
            )}
          </div>
          <Badge
            variant={isFull ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {table.guests.length}/{table.capacity}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {table.guests.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            {locale === 'fr' ? 'Glissez des invités ici' : 'Drag guests here'}
          </p>
        ) : (
          <ul className="space-y-1">
            {table.guests.map((guest) => (
              <DraggableGuest
                key={guest.id}
                guest={guest}
                isInCouple={isInCouple(guest.id)}
                locale={locale}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// DRAGGABLE GUEST
// ============================================

interface DraggableGuestProps {
  guest: Guest;
  isInCouple: boolean;
  locale: 'fr' | 'en';
}

function DraggableGuest({ guest, isInCouple, locale }: DraggableGuestProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guest.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const roleColors: Record<string, string> = {
    married: 'text-pink-600 dark:text-pink-400',
    witness: 'text-yellow-600 dark:text-yellow-400',
    bridesmaid: 'text-purple-600 dark:text-purple-400',
    groomsman: 'text-blue-600 dark:text-blue-400',
    regular: '',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex items-center gap-2 text-xs p-2 rounded-md
        bg-muted/50 hover:bg-muted cursor-grab active:cursor-grabbing
        transition-colors
        ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}
        ${roleColors[guest.role]}
      `}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 truncate">
        {guest.firstName} {guest.lastName ?? ''}
      </span>
      {isInCouple && <Heart className="h-3 w-3 text-pink-400" />}
      {guest.age !== undefined && (
        <Badge variant="outline" className="text-xs">
          {guest.age} {locale === 'fr' ? 'ans' : 'y/o'}
        </Badge>
      )}
    </li>
  );
}

// ============================================
// VISUAL TABLE VIEW
// ============================================

interface VisualTableViewProps {
  tables: Table[];
  isInCouple: (guestId: string) => boolean;
  locale: 'fr' | 'en';
}

function VisualTableView({ tables, isInCouple, locale }: VisualTableViewProps) {
  const { tablePositions, updateTablePosition, renameTable, configuration, updateConfiguration } = useAppStore();
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempPosition, setTempPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const tableShape = configuration.tableShape ?? 'round';

  const handleStartEdit = (table: Table) => {
    setEditingTableId(table.id);
    setEditName(table.name);
  };

  const handleSaveEdit = () => {
    if (editingTableId && editName.trim()) {
      renameTable(editingTableId, editName.trim());
    }
    setEditingTableId(null);
  };

  // Helper pour obtenir les initiales
  const getInitials = (guest: Guest): string => {
    const first = guest.firstName.charAt(0).toUpperCase();
    const last = guest.lastName ? guest.lastName.charAt(0).toUpperCase() : '';
    return first + last;
  };

  // Handlers pour le drag fluide
  const handleMouseDown = (e: React.MouseEvent, tableId: string, currentX: number, currentY: number) => {
    if (editingTableId) return; // Ne pas drag si on édite
    e.preventDefault();
    setDraggingTable(tableId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - currentX,
        y: e.clientY - rect.top - currentY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingTable || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    setTempPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
  };

  const handleMouseUp = () => {
    if (draggingTable && tempPosition) {
      updateTablePosition(draggingTable, tempPosition.x, tempPosition.y);
    }
    setDraggingTable(null);
    setTempPosition(null);
  };

  const handleMouseLeave = () => {
    if (draggingTable && tempPosition) {
      updateTablePosition(draggingTable, tempPosition.x, tempPosition.y);
    }
    setDraggingTable(null);
    setTempPosition(null);
  };

  return (
    <div 
      className="relative w-full h-[600px] bg-muted/30 rounded-lg border overflow-auto"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sélecteur de forme de table */}
      <div className="absolute top-4 right-4 z-10 bg-background/90 rounded-lg p-2 border shadow-sm flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {locale === 'fr' ? 'Forme :' : 'Shape:'}
        </span>
        <Button
          size="sm"
          variant={tableShape === 'round' ? 'default' : 'outline'}
          className="h-7 w-7 p-0"
          onClick={() => updateConfiguration({ tableShape: 'round' })}
          title={locale === 'fr' ? 'Tables rondes' : 'Round tables'}
        >
          <Circle className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={tableShape === 'square' ? 'default' : 'outline'}
          className="h-7 w-7 p-0"
          onClick={() => updateConfiguration({ tableShape: 'square' })}
          title={locale === 'fr' ? 'Tables carrées' : 'Square tables'}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>

      <div 
        ref={containerRef}
        className="relative min-w-[1000px] min-h-[600px] p-4"
      >
        {tables.map((table, index) => {
          const position = tablePositions.find((p) => p.tableId === table.id);
          const baseX = position?.x ?? 100 + (index % 4) * 250;
          const baseY = position?.y ?? 100 + Math.floor(index / 4) * 200;
          
          // Utiliser la position temporaire si cette table est en cours de drag
          const x = draggingTable === table.id && tempPosition ? tempPosition.x : baseX;
          const y = draggingTable === table.id && tempPosition ? tempPosition.y : baseY;
          const isHonorTable = table.number === 1;
          const isDragging = draggingTable === table.id;

          // Dimensions de la table
          const tableSize = 144; // w-36 = 144px
          const guestSize = 32; // w-8 = 32px
          const guestRadius = tableSize / 2 + guestSize / 2 + 8; // Rayon pour placer les invités autour

          return (
            <div
              key={table.id}
              className={`absolute select-none transition-shadow ${isDragging ? 'z-50 cursor-grabbing' : 'cursor-grab'}`}
              style={{
                left: x,
                top: y,
                width: tableSize + guestSize * 2 + 20,
                height: tableSize + guestSize * 2 + 20,
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              onMouseDown={(e) => handleMouseDown(e, table.id, x, y)}
            >
              {/* Table - ronde ou carrée selon la configuration */}
              <div
                className={`
                  absolute flex flex-col items-center justify-center
                  ${tableShape === 'round' ? 'rounded-full' : 'rounded-lg'}
                  ${isHonorTable 
                    ? 'bg-primary/20 border-4 border-primary shadow-lg' 
                    : 'bg-card border-2 border-border shadow'
                  }
                `}
                style={{
                  width: tableSize,
                  height: tableSize,
                  left: guestSize + 10,
                  top: guestSize + 10,
                }}
              >
                {editingTableId === table.id ? (
                  <div className="flex flex-col items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-5 w-24 text-xs text-center"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditingTableId(null);
                      }}
                      onBlur={handleSaveEdit}
                    />
                  </div>
                ) : (
                  <>
                    <span
                      className="font-semibold text-sm flex items-center justify-center gap-1 cursor-pointer hover:text-primary text-center w-full px-1"
                      onClick={() => handleStartEdit(table)}
                    >
                      {isHonorTable && <Crown className="h-3 w-3 text-primary flex-shrink-0" />}
                      <span className="truncate">{table.name}</span>
                      <Pencil className="h-2 w-2 opacity-50 flex-shrink-0" />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {table.guests.length}/{table.capacity}
                    </span>
                  </>
                )}
              </div>

              {/* Invités autour de la table */}
              {table.guests.map((guest, guestIndex) => {
                const guestCount = table.guests.length;
                const containerCenter = tableSize / 2 + guestSize + 10;
                
                let guestX: number;
                let guestY: number;
                
                if (tableShape === 'round') {
                  // Placement circulaire
                  const angle = (guestIndex / guestCount) * 2 * Math.PI - Math.PI / 2;
                  guestX = containerCenter + Math.cos(angle) * guestRadius - guestSize / 2;
                  guestY = containerCenter + Math.sin(angle) * guestRadius - guestSize / 2;
                } else {
                  // Placement sur les côtés du carré
                  const perSide = Math.ceil(guestCount / 4);
                  const side = Math.floor(guestIndex / perSide);
                  const posOnSide = guestIndex % perSide;
                  const spacing = tableSize / (perSide + 1);
                  const offset = spacing * (posOnSide + 1);
                  
                  const halfTable = tableSize / 2;
                  const margin = guestRadius; // Distance du bord de la table
                  
                  switch (side) {
                    case 0: // Haut
                      guestX = containerCenter - halfTable + offset - guestSize / 2;
                      guestY = containerCenter - margin - guestSize / 2;
                      break;
                    case 1: // Droite
                      guestX = containerCenter + margin - guestSize / 2;
                      guestY = containerCenter - halfTable + offset - guestSize / 2;
                      break;
                    case 2: // Bas
                      guestX = containerCenter + halfTable - offset - guestSize / 2;
                      guestY = containerCenter + margin - guestSize / 2;
                      break;
                    case 3: // Gauche
                    default:
                      guestX = containerCenter - margin - guestSize / 2;
                      guestY = containerCenter + halfTable - offset - guestSize / 2;
                      break;
                  }
                }

                return (
                  <div
                    key={guest.id}
                    className={`
                      absolute rounded-full flex items-center justify-center
                      text-xs font-medium border-2 shadow-sm
                      ${guest.role === 'married' 
                        ? 'bg-pink-100 border-pink-400 text-pink-700' 
                        : guest.role === 'witness'
                          ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                          : 'bg-white border-gray-300 text-gray-700'
                      }
                    `}
                    style={{
                      width: guestSize,
                      height: guestSize,
                      left: guestX,
                      top: guestY,
                    }}
                    title={`${guest.firstName} ${guest.lastName ?? ''}`}
                  >
                    {getInitials(guest)}
                    {isInCouple(guest.id) && (
                      <Heart className="absolute -top-1 -right-1 h-3 w-3 text-pink-500 fill-pink-500" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="absolute bottom-4 left-4 bg-background/90 rounded-lg p-3 text-xs space-y-1 border shadow-sm">
        <div className="font-semibold mb-2">{locale === 'fr' ? 'Légende' : 'Legend'}</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-pink-100 border-2 border-pink-400" />
          <span>{locale === 'fr' ? 'Marié(e)' : 'Married'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-100 border-2 border-yellow-400" />
          <span>{locale === 'fr' ? 'Témoin' : 'Witness'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-purple-100 border-2 border-purple-400" />
          <span>{locale === 'fr' ? 'Demoiselle d\'honneur' : 'Bridesmaid'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-400" />
          <span>{locale === 'fr' ? 'Garçon d\'honneur' : 'Groomsman'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
          <span>{locale === 'fr' ? 'Invité' : 'Guest'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-3 w-3 text-pink-500 fill-pink-500" />
          <span>{locale === 'fr' ? 'En couple' : 'Couple'}</span>
        </div>
      </div>
    </div>
  );
}
