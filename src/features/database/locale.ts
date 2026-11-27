import { getLang } from '@/core/i18n'

/** Number and date locale of the app language. */
export const appLocale = () => (getLang() === 'ko' ? 'ko-KR' : 'en-US')
