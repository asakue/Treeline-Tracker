/**
 * @fileoverview Central Modular View & Navigation Registry
 * Single Source of Truth for all top-level application views, metadata, icons, and categories.
 */

import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/core/domain/types';
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
  allowedRoles?: UserRole[];
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
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  tracker: {
    id: 'tracker',
    label: 'Трекер',
    shortLabel: 'Трекер',
    tooltip: 'Трекер группы и статус туристов',
    icon: Users,
    category: 'navigation',
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  routes: {
    id: 'routes',
    label: 'Маршруты',
    shortLabel: 'Маршруты',
    tooltip: 'Планировщик и архив горных маршрутов',
    icon: Waypoints,
    category: 'navigation',
    allowedRoles: ['guide', 'rescuer', 'admin'],
  },
  analytics: {
    id: 'analytics',
    label: 'Отчёты / Аналитика',
    shortLabel: 'Отчёты',
    tooltip: 'Сводный отчёт по походам (ФЗ-05)',
    icon: BarChart3,
    category: 'navigation',
    allowedRoles: ['guide', 'admin'],
  },
  chat: {
    id: 'chat',
    label: 'Чат',
    shortLabel: 'Чат',
    tooltip: 'Групповой E2EE чат (Mesh/Web)',
    icon: MessageSquare,
    category: 'navigation',
    fullScreen: true,
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  weather: {
    id: 'weather',
    label: 'Погода',
    shortLabel: 'Погода',
    tooltip: 'Прогноз погоды и лавинная опасность',
    icon: CloudSun,
    category: 'navigation',
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  search: {
    id: 'search',
    label: 'SOS Поиск (SAR)',
    shortLabel: 'Поиск',
    tooltip: 'AI-генерация поисковых полигонов для потерявшегося туриста',
    icon: Search,
    category: 'safety',
    allowedRoles: ['rescuer', 'admin'],
  },
  emergency: {
    id: 'emergency',
    label: 'Вызов служб',
    shortLabel: 'SOS',
    tooltip: 'Экстренный сигнал SOS и связь с 112',
    icon: Siren,
    category: 'safety',
    isEmergency: true,
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  profile: {
    id: 'profile',
    label: 'Мой профиль',
    shortLabel: 'Профиль',
    tooltip: 'Настройки профиля и криптографическая безопасность',
    icon: User,
    category: 'info',
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  about: {
    id: 'about',
    label: 'О нас',
    shortLabel: 'О нас',
    tooltip: 'Информация о проекте Treeline',
    icon: Info,
    category: 'info',
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
  'about-app': {
    id: 'about-app',
    label: 'О приложении',
    shortLabel: 'О коде',
    tooltip: 'Архитектурный стек и протоколы',
    icon: Code,
    category: 'info',
    allowedRoles: ['hiker', 'guide', 'rescuer', 'admin'],
  },
};

/**
 * Filter items by user role
 */
function filterByRole(items: ViewDefinition[], role?: UserRole): ViewDefinition[] {
  if (!role) return items;
  return items.filter((item) => !item.allowedRoles || item.allowedRoles.includes(role));
}

/**
 * Returns desktop sidebar primary navigation items
 */
export function getDesktopPrimaryNav(role?: UserRole): ViewDefinition[] {
  const items = [
    VIEW_REGISTRY.map,
    VIEW_REGISTRY.tracker,
    VIEW_REGISTRY.routes,
    VIEW_REGISTRY.analytics,
    VIEW_REGISTRY.chat,
    VIEW_REGISTRY.weather,
  ];
  return filterByRole(items, role);
}

/**
 * Returns desktop sidebar safety & emergency items
 */
export function getDesktopSafetyNav(role?: UserRole): ViewDefinition[] {
  const items = [VIEW_REGISTRY.search, VIEW_REGISTRY.emergency];
  return filterByRole(items, role);
}

/**
 * Returns mobile bottom bar quick navigation items
 */
export function getMobileBottomNavItems(role?: UserRole): ViewDefinition[] {
  if (role === 'hiker') {
    return [
      VIEW_REGISTRY.map,
      VIEW_REGISTRY.tracker,
      VIEW_REGISTRY.chat,
      VIEW_REGISTRY.emergency,
    ];
  }
  if (role === 'rescuer') {
    return [
      VIEW_REGISTRY.map,
      VIEW_REGISTRY.tracker,
      VIEW_REGISTRY.search,
      VIEW_REGISTRY.emergency,
    ];
  }
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
export function getMobileDrawerItems(role?: UserRole): ViewDefinition[] {
  const items = [
    VIEW_REGISTRY.chat,
    VIEW_REGISTRY.tracker,
    VIEW_REGISTRY.routes,
    VIEW_REGISTRY.analytics,
    VIEW_REGISTRY.weather,
    VIEW_REGISTRY.search,
    VIEW_REGISTRY.about,
    VIEW_REGISTRY['about-app'],
  ];
  return filterByRole(items, role);
}

export function getViewDefinition(viewId: ViewId): ViewDefinition {
  return VIEW_REGISTRY[viewId] || VIEW_REGISTRY.map;
}
