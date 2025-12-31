import { useAppStore } from '@/store';
import { I18nProvider } from '@/components/I18nProvider';
import { useI18n } from '@/lib/i18n';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { GuestManagement } from '@/components/GuestManagement';
import { SeatingPlanDisplay } from '@/components/SeatingPlanDisplay';
import { ExportActions } from '@/components/ExportActions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, RotateCcw, Users, Settings, LayoutGrid, Globe, Github, Heart, Sun, Moon, Monitor } from 'lucide-react';
import logoImg from '/logo.png';

function AppContent() {
  const { generate, reset, isGenerating, guests, result } = useAppStore();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentTheme = theme ?? 'system';
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]!);
  };

  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Sun className="h-4 w-4" />;
  };

  const getThemeLabel = () => {
    if (theme === 'system') return locale === 'fr' ? 'Système' : 'System';
    if (theme === 'dark') return locale === 'fr' ? 'Sombre' : 'Dark';
    return locale === 'fr' ? 'Clair' : 'Light';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="PlanTable" className="h-14 w-14 rounded-xl" />
              <div>
                <h1 className="text-xl font-bold">{t('appTitle')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('appSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com/jsthibault/PlanTable"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleTheme}
                title={getThemeLabel()}
              >
                {getThemeIcon()}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLocale}
                title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
              >
                <Globe className="h-4 w-4 mr-1" />
                {locale.toUpperCase()}
              </Button>
              <ExportActions />
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {locale === 'fr' ? 'Réinitialiser' : 'Reset'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{locale === 'fr' ? 'Configuration' : 'Config'}</span>
            </TabsTrigger>
            <TabsTrigger value="guests" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{locale === 'fr' ? 'Invités' : 'Guests'}</span>
              {guests.length > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {guests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="plan" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Plan</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            <ConfigurationPanel />
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {locale === 'fr' 
                  ? "Une fois la configuration terminée, ajoutez vos invités dans l'onglet suivant."
                  : "Once configuration is complete, add your guests in the next tab."}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="guests" className="space-y-6">
            <GuestManagement />
          </TabsContent>

          <TabsContent value="plan" className="space-y-6">
            {/* Action de génération */}
            <div className="flex flex-col items-center gap-4 py-6">
              <Button
                size="lg"
                onClick={generate}
                disabled={isGenerating || guests.length === 0}
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                {isGenerating 
                  ? t('generating')
                  : t('generatePlan')}
              </Button>
              
              {guests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {locale === 'fr' 
                    ? 'Ajoutez des invités pour générer le plan'
                    : 'Add guests to generate the plan'}
                </p>
              )}
              
              {guests.length > 0 && !result && (
                <p className="text-sm text-muted-foreground">
                  {locale === 'fr'
                    ? `${guests.length} invité(s) prêt(s) à être placé(s)`
                    : `${guests.length} guest(s) ready to be seated`}
                </p>
              )}
            </div>

            {/* Affichage du plan */}
            <SeatingPlanDisplay />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              PlanTable © {new Date().getFullYear()} - {locale === 'fr' ? 'Créez votre plan de table parfait' : 'Create your perfect seating chart'} 💒
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://paypal.me/jeanstephanethibault"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0070ba] hover:bg-[#003087] text-white rounded-full transition-colors"
              >
                <Heart className="h-3 w-3" />
                {locale === 'fr' ? 'Vous voulez plus d\'outils 100% gratuits pour votre mariage ? Soutenez-moi !' : 'Want more 100% free wedding tools? Support me!'}
              </a>
              <a 
                href="mailto:garry.factory@gmail.com" 
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {locale === 'fr' ? 'Créé par' : 'Created by'} garry.factory@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
