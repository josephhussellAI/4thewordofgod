
export const LANGUAGES: Record<string, { code: string; direction: 'ltr' | 'rtl'; name: string }> = {
    en: { code: 'en', direction: 'ltr', name: 'English' },
    es: { code: 'es', direction: 'ltr', name: 'Spanish' },
    fr: { code: 'fr', direction: 'ltr', name: 'French' },
    de: { code: 'de', direction: 'ltr', name: 'German' },
    it: { code: 'it', direction: 'ltr', name: 'Italian' },
    pt: { code: 'pt', direction: 'ltr', name: 'Portuguese' },
    ru: { code: 'ru', direction: 'ltr', name: 'Russian' },
    zh: { code: 'zh', direction: 'ltr', name: 'Chinese' },
    ja: { code: 'ja', direction: 'ltr', name: 'Japanese' },
    ko: { code: 'ko', direction: 'ltr', name: 'Korean' },
    ar: { code: 'ar', direction: 'rtl', name: 'Arabic' },
    he: { code: 'he', direction: 'rtl', name: 'Hebrew' },
    fa: { code: 'fa', direction: 'rtl', name: 'Persian' },
    ur: { code: 'ur', direction: 'rtl', name: 'Urdu' },
};

export function getLanguageDirection(code: string): 'ltr' | 'rtl' {
    return LANGUAGES[code]?.direction || 'ltr';
}
