export type Locale = "ru" | "en";

export const defaultLocale: Locale =
  (process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale) || "ru";
export const fallbackLocale: Locale =
  (process.env.NEXT_PUBLIC_FALLBACK_LOCALE as Locale) || "en";

type Dict = Record<string, string>;

const ru: Dict = {
  "app.title": "TeamUp",
  "nav.dashboard": "Дашборд",
  "nav.attention": "Требует внимания",
  "nav.impact": "Эффект",
  "nav.settings.workspace": "Настройки workspace",
  "nav.settings.members": "Участники",
  "nav.settings.integrations": "Интеграции",
  "nav.settings.system": "Системные настройки",
  "sidebar.workspaceSwitch": "Рабочее пространство",
  "sidebar.personalWorkspace": "Личное",
  "sidebar.noWorkspace": "Нет доступных пространств",
  "sidebar.openUserSettings": "Настройки пользователя",
  "sidebar.openSystemSettings": "Системные настройки",
  "auth.login": "Вход",
  "auth.register": "Регистрация",
  "auth.verify": "Подтверждение почты",
  "auth.email": "Почта",
  "auth.password": "Пароль",
  "auth.fullName": "Имя",
  "common.submit": "Отправить",
  "common.save": "Сохранить",
  "common.logout": "Выйти",
  "common.unknownUser": "Пользователь",
  "landing.subtitle": "Платформа оптимизации процесса разработки",
  "dashboard.title": "Дашборд команды",
  "attention.title": "Задачи, требующие внимания",
  "impact.title": "Сравнение до / после",
  "settings.workspace.title": "Настройки рабочего пространства",
  "settings.members.title": "Участники и приглашения",
  "settings.integrations.title": "Интеграции",
  "settings.user.title": "Настройки пользователя",
  "settings.user.tab.details": "Данные пользователя",
  "settings.user.tab.notifications": "Уведомления",
  "settings.user.tab.workspaces": "Рабочие пространства",
  "settings.user.placeholder.details": "Раздел «Данные пользователя» будет добавлен позже.",
  "settings.user.placeholder.notifications": "Раздел «Уведомления» будет добавлен позже.",
  "settings.user.placeholder.workspaces": "Раздел «Рабочие пространства» будет добавлен позже.",
  "settings.system.tab.users": "Пользователи",
  "settings.system.tab.tab2": "tab2",
  "settings.system.tab.tab3": "tab3",
  "settings.system.tab.tab4": "tab4",
  "settings.system.tab.tab5": "tab5",
  "settings.system.placeholder.users": "Раздел «Пользователи» будет добавлен позже.",
  "settings.system.placeholder.tab2": "Раздел tab2 будет добавлен позже.",
  "settings.system.placeholder.tab3": "Раздел tab3 будет добавлен позже.",
  "settings.system.placeholder.tab4": "Раздел tab4 будет добавлен позже.",
  "settings.system.placeholder.tab5": "Раздел tab5 будет добавлен позже.",
  "settings.system.deniedRedirect": "Нет доступа. Перенаправление на дашборд…",
  "onboarding.clickup.title": "Подключение ClickUp",
  "onboarding.mapping.title": "Маппинг статусов",
  "verify.success": "Почта подтверждена",
  "verify.error": "Ошибка подтверждения",
  "common.loading": "Загрузка..."
};

const en: Dict = {
  "app.title": "TeamUp"
};

const dictionaries: Record<Locale, Dict> = { ru, en };

export function t(key: string, locale: Locale = defaultLocale): string {
  const dict = dictionaries[locale] || dictionaries[fallbackLocale];
  return dict[key] || dictionaries[fallbackLocale][key] || key;
}

