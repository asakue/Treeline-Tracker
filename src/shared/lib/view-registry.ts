/**
 * @fileoverview Central Modular View & Navigation Registry
 * Single Source of Truth for all top-level application views, metadata, icons, and categories.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Map,
  Users,
  Waypoints,
  BarChart3,
  MessageSquare,
  CloudSun,
  Search,
  Siren,
  User,
  Info,
  Code,
} from 'lucide-react';

export type ViewId =
  | 'map'
  | 'tracker'
  | 'routes'
  | 'analytics'
  | 'chat'
  | 'weather'
  | 'search'
  | 'emergency'
  | 'profile'
  | 'about'
  | 'about-app';

export type ViewCategory = 'navigation' | 'telemetry' | 'safety' | 'info';

export interface ViewDefinition {
  id: ViewId;
  label: string;
  shortLabel?: string;
  tooltip: string;
  icon: LucideIcon;
  category: ViewCategory;
  fullScreen?: boolean;
  isEmergency?: boolean;
}

export const VIEW_REGISTRY: Record<ViewId, ViewDefinition> = {
  map: {
    id: 'map',
    label: 'Карта',
    shortLabel: 'Карта',
    tooltip: 'Интерактивная карта и рельеф',
    icon: Map,
    category: 'navigation',
    fullScreen: true,
  },
  tracker: {
    id: 'tracker',
    label: 'Трекер',
    shortLabel: 'Трекер',
    tooltip: 'Трекер группы и статус туристов',
    icon: Users,
    category: 'navigation',
  },
  routes: {
    id: 'routes',
    label: 'Маршруты',
    shortLabel: 'Маршруты',
    tooltip: 'Планировщик и архив горных маршрутов',
    icon: Waypoints,
    category: 'navigation',
  },
  analytics: {
    id: 'analytics',
    label: 'Отчёты / Аналитика',
    shortLabel: 'Отчёты',
    tooltip: 'Сводный отчёт по походам (ФЗ-05)',
    icon: BarChart3,
    category: 'navigation',
  },
  chat: {
    id: 'chat',
    label: 'Чат',
    shortLabel: 'Чат',
    tooltip: 'Групповой E2EE чат (Mesh/Web)',
    icon: MessageSquare,
    category: 'navigation',
    fullScreen: true,
  },
  weather: {
    id: 'weather',
    label: 'Погода',
    shortLabel: 'Погода',
    tooltip: 'Прогноз погоды и лавинная опасность',
    icon: CloudSun,
    category: 'navigation',
  },
  search: {
    id: 'search',
    label: 'SOS Поиск',
    shortLabel: 'Поиск',
    tooltip: 'AI-генерация поисковых полигонов для потерявшегося туриста',
    icon: Search,
    category: 'safety',
  },
  emergency: {
    id: 'emergency',
    label: 'Вызов служб',
    shortLabel: 'SOS',
    tooltip: 'Экстренный сигнал SOS и связь с 112',
    icon: Siren,
    category: 'safety',
    isEmergency: true,
  },
  profile: {
    id: 'profile',
    label: 'Мой профиль',
    shortLabel: 'Профиль',
    tooltip: 'Настройки профиля и криптографическая безопасность',
    icon: User,
    category: 'info',
  },
  about: {
    id: 'about',
    label: 'О нас',
    shortLabel: 'О нас',
    tooltip: 'Информация о проекте Treeline',
    icon: Info,
    category: 'info',
  },
  'about-app': {
    id: 'about-app',
    label: 'О приложении',
    shortLabel: 'О коде',
    tooltip: 'Архитектурный стек и протоколы',
    icon: Code,
    category: 'info',
  },
};

/**
 * Returns desktop sidebar primary navigation items
 */
export function getDesktopPrimaryNav(): ViewDefinition[] {
  return [
    VIEW_REGISTRY.map,
    VIEW_REGISTRY.tracker,
    VIEW_REGISTRY.routes,
    VIEW_REGISTRY.analytics,
    VIEW_REGISTRY.chat,
    VIEW_REGISTRY.weather,
  ];
}

/**
 * Returns desktop sidebar safety & emergency items
 */
export function getDesktopSafetyNav(): ViewDefinition[] {
  return [VIEW_REGISTRY.search, VIEW_REGISTRY.emergency];
}

/**
 * Returns mobile bottom bar quick navigation items
 */
export function getMobileBottomNavItems(): ViewDefinition[] {
  return [
    VIEW_REGISTRY.map,
    VIEW_REGISTRY.tracker,
    VIEW_REGISTRY.routes,
    VIEW_REGISTRY.emergency,
  ];
}

/**
 * Returns mobile drawer "More" menu items
 */
export function getMobileDrawerItems(): ViewDefinition[] {
  return [
    VIEW_REGISTRY.chat,
    VIEW_REGISTRY.tracker,
    VIEW_REGISTRY.routes,
    VIEW_REGISTRY.analytics,
    VIEW_REGISTRY.weather,
    VIEW_REGISTRY.search,
    VIEW_REGISTRY.about,
    VIEW_REGISTRY['about-app'],
  ];
}

export function getViewDefinition(viewId: ViewId): ViewDefinition {
  return VIEW_REGISTRY[viewId] || VIEW_REGISTRY.map;
}
