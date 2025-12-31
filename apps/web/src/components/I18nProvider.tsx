import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { I18nContext, detectLocale, translate, type Locale, type TranslationKey } from '@/lib/i18n';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      return translate(locale, key, params);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
    }),
    [locale, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
