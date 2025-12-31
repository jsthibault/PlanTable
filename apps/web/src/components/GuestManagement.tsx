import { useState, useRef } from 'react';
import { useAppStore } from '@/store';
import { useI18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, UserPlus, X, Heart, Upload } from 'lucide-react';
import type { Guest, GuestRole } from '@/types';

export function GuestManagement() {
  const {
    guests,
    couples,
    exclusions,
    configuration,
    addGuest,
    updateGuest,
    removeGuest,
    addCouple,
    removeCouple,
    updateGuestExclusions,
  } = useAppStore();
  const { locale } = useI18n();

  const [newGuestFirstName, setNewGuestFirstName] = useState('');
  const [newGuestLastName, setNewGuestLastName] = useState('');
  const [newGuestAge, setNewGuestAge] = useState<number | undefined>();
  const [newGuestRole, setNewGuestRole] = useState<GuestRole>('regular');

  // Couple form
  const [coupleGuestA, setCoupleGuestA] = useState('');
  const [coupleGuestB, setCoupleGuestB] = useState('');

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error state
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddGuest = () => {
    if (!newGuestFirstName.trim()) return;
    setAddError(null);

    const result = addGuest({
      firstName: newGuestFirstName.trim(),
      lastName: configuration.sortingCriteria.byFamily ? newGuestLastName.trim() : undefined,
      age: configuration.sortingCriteria.byAge ? newGuestAge : undefined,
      role: configuration.sortingCriteria.byRole ? newGuestRole : 'regular',
    });

    if (!result.success) {
      setAddError(result.error);
      return;
    }

    // Reset form
    setNewGuestFirstName('');
    setNewGuestLastName('');
    setNewGuestAge(undefined);
    setNewGuestRole('regular');
  };

  const handleAddCouple = () => {
    if (!coupleGuestA || !coupleGuestB || coupleGuestA === coupleGuestB) return;
    addCouple(coupleGuestA, coupleGuestB);
    setCoupleGuestA('');
    setCoupleGuestB('');
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if it looks like one
      const startIndex = lines[0]?.toLowerCase().includes('firstname') || 
                         lines[0]?.toLowerCase().includes('prénom') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 1 && parts[0]) {
          const firstName = parts[0];
          const lastName = parts[1] || undefined;
          const family = parts[2] || undefined;
          const age = parts[3] ? parseInt(parts[3]) : undefined;
          const roleStr = parts[4]?.toLowerCase() || 'regular';
          
          let role: GuestRole = 'regular';
          if (roleStr === 'married' || roleStr === 'marié' || roleStr === 'mariée') {
            role = 'married';
          } else if (roleStr === 'witness' || roleStr === 'témoin') {
            role = 'witness';
          }

          addGuest({
            firstName,
            lastName: lastName || family,
            age: age && !isNaN(age) ? age : undefined,
            role,
          });
        }
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getGuestById = (id: string): Guest | undefined => {
    return guests.find((g) => g.id === id);
  };

  const getGuestExclusions = (guestId: string): string[] => {
    return exclusions
      .filter((e) => e.guestAId === guestId || e.guestBId === guestId)
      .map((e) => (e.guestAId === guestId ? e.guestBId : e.guestAId));
  };

  const isInCouple = (guestId: string): boolean => {
    return couples.some((c) => c.guestAId === guestId || c.guestBId === guestId);
  };

  const getCouplePartner = (guestId: string): Guest | undefined => {
    const couple = couples.find(
      (c) => c.guestAId === guestId || c.guestBId === guestId
    );
    if (!couple) return undefined;
    const partnerId = couple.guestAId === guestId ? couple.guestBId : couple.guestAId;
    return getGuestById(partnerId);
  };

  const availableForCouple = guests.filter((g) => !isInCouple(g.id));

  const roleLabels: Record<GuestRole, string> = locale === 'fr' 
    ? {
        married: '💍 Marié(e)',
        witness: '⭐ Témoin',
        bridesmaid: '👗 Demoiselle d\'honneur',
        groomsman: '🤵 Garçon d\'honneur',
        regular: '👤 Invité',
      }
    : {
        married: '💍 Married',
        witness: '⭐ Witness',
        bridesmaid: '👗 Bridesmaid',
        groomsman: '🤵 Groomsman',
        regular: '👤 Guest',
      };

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout d'invité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {locale === 'fr' ? 'Ajouter un invité' : 'Add a guest'}
            </span>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {locale === 'fr' ? 'Importer CSV' : 'Import CSV'}
              </Button>
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {locale === 'fr' 
              ? 'Format CSV: prénom,nom,famille,âge,rôle (married/witness/regular)'
              : 'CSV format: firstName,lastName,family,age,role (married/witness/regular)'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{locale === 'fr' ? 'Prénom *' : 'First name *'}</Label>
              <Input
                id="firstName"
                placeholder={locale === 'fr' ? 'Prénom' : 'First name'}
                value={newGuestFirstName}
                onChange={(e) => setNewGuestFirstName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
              />
            </div>

            {configuration.sortingCriteria.byFamily && (
              <div className="space-y-2">
                <Label htmlFor="lastName">{locale === 'fr' ? 'Nom de famille' : 'Last name'}</Label>
                <Input
                  id="lastName"
                  placeholder={locale === 'fr' ? 'Nom' : 'Last name'}
                  value={newGuestLastName}
                  onChange={(e) => setNewGuestLastName(e.target.value)}
                />
              </div>
            )}

            {configuration.sortingCriteria.byAge && (
              <div className="space-y-2">
                <Label htmlFor="age">{locale === 'fr' ? 'Âge' : 'Age'}</Label>
                <Input
                  id="age"
                  type="number"
                  min={0}
                  max={120}
                  placeholder={locale === 'fr' ? 'Âge' : 'Age'}
                  value={newGuestAge ?? ''}
                  onChange={(e) =>
                    setNewGuestAge(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                />
              </div>
            )}

            {configuration.sortingCriteria.byRole && (
              <div className="space-y-2">
                <Label htmlFor="role">{locale === 'fr' ? 'Rôle' : 'Role'}</Label>
                <Select value={newGuestRole} onValueChange={(v) => setNewGuestRole(v as GuestRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">{roleLabels.regular}</SelectItem>
                    <SelectItem value="witness">{roleLabels.witness}</SelectItem>
                    <SelectItem value="bridesmaid">{roleLabels.bridesmaid}</SelectItem>
                    <SelectItem value="groomsman">{roleLabels.groomsman}</SelectItem>
                    <SelectItem value="married">{roleLabels.married}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {addError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {locale === 'fr' 
                  ? `Nombre maximum d'invités atteint (${configuration.totalGuests}). Augmentez le nombre total d'invités dans la configuration pour en ajouter plus.`
                  : `Maximum number of guests reached (${configuration.totalGuests}). Increase the total number of guests in configuration to add more.`}
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAddGuest} className="mt-4">
            <UserPlus className="h-4 w-4 mr-2" />
            {locale === 'fr' ? "Ajouter l'invité" : 'Add guest'}
          </Button>
        </CardContent>
      </Card>

      {/* Gestion des couples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            {locale === 'fr' ? 'Créer un couple' : 'Create a couple'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {locale === 'fr' 
              ? 'Les couples sont toujours placés à la même table.'
              : 'Couples are always seated at the same table.'}
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>{locale === 'fr' ? 'Invité A' : 'Guest A'}</Label>
              <Select value={coupleGuestA} onValueChange={setCoupleGuestA}>
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'fr' ? 'Sélectionner...' : 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableForCouple.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.firstName} {g.lastName ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>{locale === 'fr' ? 'Invité B' : 'Guest B'}</Label>
              <Select value={coupleGuestB} onValueChange={setCoupleGuestB}>
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'fr' ? 'Sélectionner...' : 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableForCouple
                    .filter((g) => g.id !== coupleGuestA)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.firstName} {g.lastName ?? ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddCouple}
              disabled={!coupleGuestA || !coupleGuestB}
              variant="secondary"
            >
              <Heart className="h-4 w-4 mr-2" />
              {locale === 'fr' ? 'Créer le couple' : 'Create couple'}
            </Button>
          </div>

          {/* Liste des couples */}
          {couples.length > 0 && (
            <div className="mt-4 space-y-2">
              <Label>{locale === 'fr' ? 'Couples créés' : 'Created couples'}</Label>
              <div className="flex flex-wrap gap-2">
                {couples.map((couple) => {
                  const guestA = getGuestById(couple.guestAId);
                  const guestB = getGuestById(couple.guestBId);
                  return (
                    <Badge key={couple.id} variant="secondary" className="py-1.5 px-3">
                      <Heart className="h-3 w-3 mr-1 text-pink-500" />
                      {guestA?.firstName} & {guestB?.firstName}
                      <button
                        onClick={() => removeCouple(couple.id)}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste des invités */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            👥 {locale === 'fr' ? 'Liste des invités' : 'Guest list'} ({guests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {locale === 'fr' 
                ? 'Aucun invité pour le moment. Ajoutez des invités ci-dessus.'
                : 'No guests yet. Add guests above.'}
            </p>
          ) : (
            <div className="space-y-3">
              {guests.map((guest) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  allGuests={guests}
                  configuration={configuration}
                  exclusions={getGuestExclusions(guest.id)}
                  partner={getCouplePartner(guest.id)}
                  onUpdate={(updates) => updateGuest(guest.id, updates)}
                  onRemove={() => removeGuest(guest.id)}
                  onExclusionsChange={(excludedIds) =>
                    updateGuestExclusions(guest.id, excludedIds)
                  }
                  roleLabels={roleLabels}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Composant pour une ligne d'invité
interface GuestRowProps {
  guest: Guest;
  allGuests: Guest[];
  configuration: {
    sortingCriteria: {
      byFamily: boolean;
      byAge: boolean;
      byRole: boolean;
    };
  };
  exclusions: string[];
  partner?: Guest | undefined;
  onUpdate: (updates: Partial<Guest>) => void;
  onRemove: () => void;
  onExclusionsChange: (excludedIds: string[]) => void;
  roleLabels: Record<GuestRole, string>;
  locale: 'fr' | 'en';
}

function GuestRow({
  guest,
  allGuests,
  configuration,
  exclusions,
  partner,
  onUpdate,
  onRemove,
  onExclusionsChange,
  roleLabels,
  locale,
}: GuestRowProps) {
  const [showExclusions, setShowExclusions] = useState(false);

  const otherGuests = allGuests.filter((g) => g.id !== guest.id);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Prénom */}
        <Input
          className="w-40"
          value={guest.firstName}
          onChange={(e) => onUpdate({ firstName: e.target.value })}
          placeholder={locale === 'fr' ? 'Prénom' : 'First name'}
        />

        {/* Nom */}
        {configuration.sortingCriteria.byFamily && (
          <Input
            className="w-40"
            value={guest.lastName ?? ''}
            onChange={(e) => onUpdate({ lastName: e.target.value || undefined })}
            placeholder={locale === 'fr' ? 'Nom' : 'Last name'}
          />
        )}

        {/* Âge */}
        {configuration.sortingCriteria.byAge && (
          <Input
            className="w-20"
            type="number"
            value={guest.age ?? ''}
            onChange={(e) =>
              onUpdate({ age: e.target.value ? parseInt(e.target.value) : undefined })
            }
            placeholder={locale === 'fr' ? 'Âge' : 'Age'}
          />
        )}

        {/* Rôle */}
        {configuration.sortingCriteria.byRole && (
          <Select
            value={guest.role}
            onValueChange={(v) => onUpdate({ role: v as GuestRole })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">{roleLabels.regular}</SelectItem>
              <SelectItem value="witness">{roleLabels.witness}</SelectItem>
              <SelectItem value="bridesmaid">{roleLabels.bridesmaid}</SelectItem>
              <SelectItem value="groomsman">{roleLabels.groomsman}</SelectItem>
              <SelectItem value="married">{roleLabels.married}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Badge couple */}
        {partner && (
          <Badge variant="outline" className="bg-pink-50">
            <Heart className="h-3 w-3 mr-1 text-pink-500" />
            {locale === 'fr' ? 'Avec' : 'With'} {partner.firstName}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExclusions(!showExclusions)}
          >
            Exclusions ({exclusions.length})
          </Button>
          <Button variant="destructive" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Panel exclusions */}
      {showExclusions && (
        <div className="border-t pt-3 mt-3">
          <Label className="text-sm mb-2 block">
            {locale === 'fr' ? 'Ne peut pas être assis avec :' : 'Cannot sit with:'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {otherGuests.map((otherGuest) => {
              const isExcluded = exclusions.includes(otherGuest.id);
              return (
                <label
                  key={otherGuest.id}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={isExcluded}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onExclusionsChange([...exclusions, otherGuest.id]);
                      } else {
                        onExclusionsChange(exclusions.filter((id) => id !== otherGuest.id));
                      }
                    }}
                  />
                  {otherGuest.firstName} {otherGuest.lastName ?? ''}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
