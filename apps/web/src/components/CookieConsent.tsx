import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Cookie, Shield, X, Settings } from 'lucide-react';

const GA4_ID = 'G-34Z0FZ60BJ';
const CONSENT_KEY = 'plantable_cookie_consent';

// Event for reopening the consent dialog
const reopenConsentEvent = new CustomEvent('reopenCookieConsent');

let analyticsLoaded = false;

function loadAnalytics() {
    // Only load if not already loaded
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    // Load the gtag.js script FIRST (exactly like Google recommends)
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;

    // Only initialize after script loads
    script.onload = () => {
        // Initialize dataLayer
        window.dataLayer = window.dataLayer || [];

        // Define gtag function exactly like Google's code
        function gtag(..._args: any[]) {
            window.dataLayer.push(arguments);
        }

        // Make gtag globally available
        (window as any).gtag = gtag;

        // Initialize GA4
        gtag('js', new Date());
        gtag('config', GA4_ID);
    };

    script.onerror = () => {
        console.error('[GA4] Failed to load analytics script');
        analyticsLoaded = false;
    };

    document.head.appendChild(script);
}

function removeAnalytics() {
    // Remove GA scripts
    const scripts = document.querySelectorAll(`script[src*="googletagmanager.com"]`);
    scripts.forEach(script => script.remove());

    // Clear dataLayer and gtag
    if (typeof window !== 'undefined') {
        (window as any).dataLayer = [];
        delete (window as any).gtag;
    }
    analyticsLoaded = false;

    // Clear GA cookies
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
        const name = cookie.split('=')[0]?.trim();
        if (name && (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat'))) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        }
    });
}

export function CookieConsent() {
    const { locale } = useI18n();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const savedConsent = localStorage.getItem(CONSENT_KEY);
        if (savedConsent === 'accepted') {
            loadAnalytics();
            setShowBanner(false);
        } else if (savedConsent === 'refused') {
            removeAnalytics();
            setShowBanner(false);
        } else {
            setShowBanner(true);
        }

        // Listen for reopen event
        const handleReopen = () => setShowBanner(true);
        window.addEventListener('reopenCookieConsent', handleReopen);
        return () => window.removeEventListener('reopenCookieConsent', handleReopen);
    }, []);

    const handleAccept = () => {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        setShowBanner(false);
        loadAnalytics();
    };

    const handleRefuse = () => {
        localStorage.setItem(CONSENT_KEY, 'refused');
        setShowBanner(false);
        removeAnalytics();
    };

    if (!showBanner) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Cookie className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">
                                {locale === 'fr' ? 'Utilisation des cookies' : 'Cookie Usage'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {locale === 'fr' ? 'Votre vie privée compte' : 'Your privacy matters'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    <div className="flex items-start gap-3 mb-4">
                        <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {locale === 'fr'
                                ? "Nous utilisons Google Analytics pour analyser le trafic sur notre site. Ces données sont anonymes et nous aident à améliorer votre expérience. Aucune donnée personnelle n'est collectée ni partagée avec des tiers à des fins publicitaires."
                                : "We use Google Analytics to analyze traffic on our site. This data is anonymous and helps us improve your experience. No personal data is collected or shared with third parties for advertising purposes."
                            }
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleRefuse}
                        >
                            <X className="h-4 w-4 mr-2" />
                            {locale === 'fr' ? 'Refuser' : 'Decline'}
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleAccept}
                        >
                            <Cookie className="h-4 w-4 mr-2" />
                            {locale === 'fr' ? 'Accepter' : 'Accept'}
                        </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground mt-4">
                        {locale === 'fr'
                            ? 'Vous pouvez modifier votre choix à tout moment dans les paramètres.'
                            : 'You can change your choice at any time in settings.'
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}

export function CookieSettingsButton() {
    const { locale } = useI18n();

    const handleClick = () => {
        window.dispatchEvent(reopenConsentEvent);
    };

    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={locale === 'fr' ? 'Paramètres cookies' : 'Cookie settings'}
        >
            <Settings className="h-3 w-3" />
            {locale === 'fr' ? 'Cookies' : 'Cookies'}
        </button>
    );
}

// Declare global types
declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}
