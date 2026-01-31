const LANGUAGE_CODES = {
  es: 'es',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
  zh: 'zh-CN',
  ja: 'ja',
  pt: 'pt',
  ar: 'ar',
  ko: 'ko',
  it: 'it'
} as const;

export async function translateText(text: string): Promise<Record<string, string>> {
  const translations: Record<string, string> = {};

  for (const [code, targetLang] of Object.entries(LANGUAGE_CODES)) {
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);

      if (!response.ok) {
        console.error(`Translation failed for ${code}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const translated = data[0].map((item: any) => item[0]).join('');
      translations[code] = translated;

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error translating to ${code}:`, error);
    }
  }

  return translations;
}
