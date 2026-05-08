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
  "settings.user.workspaces.intro":
    "Личное рабочее пространство всегда остаётся. Дополнительные пространства не удаляются из интерфейса (как в InfraZen). Активное пространство запоминается на сервере. Приглашения и переименование — только для владельца.",
  "settings.user.workspaces.createTitle": "Новое рабочее пространство",
  "settings.user.workspaces.namePlaceholder": "Название команды",
  "settings.user.workspaces.createBtn": "Создать workspace",
  "settings.user.workspaces.listTitle": "Ваши пространства",
  "settings.user.workspaces.activeBadge": "активно в меню",
  "settings.user.workspaces.yourRole": "Ваша роль",
  "settings.user.workspaces.setActive": "Сделать активным",
  "settings.user.workspaces.expandMembers": "Участники и приглашения",
  "settings.user.workspaces.collapse": "Свернуть",
  "settings.user.workspaces.membersTitle": "Участники",
  "settings.user.workspaces.noMembers": "Нет участников или список ещё не загружен.",
  "settings.user.workspaces.inviteTitle": "Пригласить по email",
  "settings.user.workspaces.readOnlyMembers": "Список участников доступен для просмотра; пригласить можно только владельцу.",
  "settings.user.workspaces.ownerOnlyInvites": "Приглашения и история доступны только владельцу пространства.",
  "settings.user.workspaces.renameLabel": "Название",
  "settings.user.workspaces.renameSave": "Сохранить название",
  "settings.user.workspaces.renameNeedName": "Укажите название.",
  "settings.user.workspaces.renamed": "Название сохранено.",
  "settings.user.workspaces.roleUpdated": "Роль обновлена.",
  "settings.user.workspaces.inviteHistoryTitle": "История приглашений",
  "settings.user.workspaces.inviteStatus.pending": "ожидание",
  "settings.user.workspaces.inviteStatus.accepted": "принято",
  "settings.user.workspaces.inviteStatus.revoked": "отозвано",
  "settings.user.workspaces.removeMember": "Исключить",
  "settings.user.workspaces.leaveWorkspace": "Покинуть пространство",
  "settings.user.workspaces.confirmRemoveMemberPrefix": "Исключить участника",
  "settings.user.workspaces.memberRemoved": "Готово.",
  "settings.user.workspaces.created": "Workspace создан и выбран как активный.",
  "settings.user.workspaces.needEmail": "Укажите email для приглашения.",
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
  "invite.title": "Принятие приглашения",
  "invite.status.waiting": "Ожидание…",
  "invite.error.noToken": "Токен приглашения не найден",
  "invite.error.generic": "Ошибка принятия приглашения",
  "settings.members.workspaceId.placeholder": "ID workspace (берётся из меню автоматически)",
  "settings.members.email.placeholder": "Email участника",
  "settings.members.invite": "Пригласить",
  "settings.members.loadMembers": "Обновить список участников",
  "settings.members.pendingTitle": "Активные приглашения",
  "settings.members.loadPending": "Загрузить приглашения",
  "settings.members.noWorkspace": "Выберите рабочее пространство в меню или укажите его ID.",
  "settings.members.revoke": "Отозвать",
  "settings.members.role.member": "участник",
  "settings.members.role.admin": "администратор",
  "settings.members.role.owner": "владелец",
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

