import * as Localization from 'expo-localization';

const fr = require('../locales/fr.json');
const en = require('../locales/en.json');

const dictionaries = { fr, en };

export type Locale = 'fr' | 'en';

/**
 * Charge le dictionnaire correspondant à la langue système ou française par défaut.
 * Standardisé sur l'approche AgriCollect Web.
 */
export function getDictionary() {
  const locale = Localization.getLocales()[0].languageCode;
  
  if (locale === 'en' || locale?.startsWith('en')) {
    return en;
  }
  
  return fr;
}

export type Dictionary = typeof fr;
