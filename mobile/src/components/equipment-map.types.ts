import type { Coordinates, NearbyEquipment } from '@/lib/api';

export type EquipmentMapProps = {
  center: Coordinates;
  radiusKm: number;
  equipment: NearbyEquipment[];
};
