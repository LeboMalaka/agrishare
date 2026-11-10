export type Coordinates = {
  latitude: number;
  longitude: number;
};

const earthRadiusKm = 6371.0088;

export function haversineDistanceKm(from: Coordinates, to: Coordinates) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
