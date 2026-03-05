import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: {
        title: 'Easywork Refactor Scaffold',
        subtitle: 'Web and Core baseline is running.'
      }
    },
    zh: {
      translation: {
        title: 'Easywork 重构脚手架',
        subtitle: 'Web 与 Core 基础架构已启动。'
      }
    }
  }
});

export default i18n;
