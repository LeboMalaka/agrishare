import type { EquipmentCategory as ApiEquipmentCategory } from '@/lib/api';

export const equipmentCategoryLabels = [
  'All',
  'Tractors',
  'Planters',
  'Agricultural drones',
  'Cold-storage facilities',
  'Agricultural transport vehicles',
  'Harvesting equipment',
  'Other agricultural machinery',
] as const;

export type EquipmentCategoryLabel = (typeof equipmentCategoryLabels)[number];

export const categoryByLabel: Partial<Record<EquipmentCategoryLabel, ApiEquipmentCategory>> = {
  Tractors: 'TRACTORS',
  Planters: 'PLANTERS',
  'Agricultural drones': 'AGRICULTURAL_DRONES',
  'Cold-storage facilities': 'COLD_STORAGE',
  'Agricultural transport vehicles': 'TRANSPORT_VEHICLES',
  'Harvesting equipment': 'HARVESTING_EQUIPMENT',
  'Other agricultural machinery': 'OTHER_MACHINERY',
};

const labelByCategory: Record<ApiEquipmentCategory, Exclude<EquipmentCategoryLabel, 'All'>> = {
  TRACTORS: 'Tractors',
  PLANTERS: 'Planters',
  AGRICULTURAL_DRONES: 'Agricultural drones',
  COLD_STORAGE: 'Cold-storage facilities',
  TRANSPORT_VEHICLES: 'Agricultural transport vehicles',
  HARVESTING_EQUIPMENT: 'Harvesting equipment',
  OTHER_MACHINERY: 'Other agricultural machinery',
};

export function getEquipmentCategoryLabel(category: ApiEquipmentCategory) {
  return labelByCategory[category];
}
