import { useEffect, useRef, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import type { EquipmentMapProps } from '@/components/equipment-map.types';
import { loadGoogleMapsApi } from '@/lib/google-maps';

export function EquipmentMap({ center, radiusKm, equipment }: EquipmentMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let overlays: google.maps.MVCObject[] = [];

    void loadGoogleMapsApi()
      .then((maps) => {
        if (!active || !mapElement.current) return;
        const map = new maps.maps.Map(mapElement.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: radiusKm <= 10 ? 11 : radiusKm <= 50 ? 9 : 7,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const circle = new maps.maps.Circle({
          map,
          center: { lat: center.latitude, lng: center.longitude },
          radius: radiusKm * 1000,
          fillColor: '#1f5d3f',
          fillOpacity: 0.12,
          strokeColor: '#1f5d3f',
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });
        const infoWindow = new maps.maps.InfoWindow();
        const currentMarker = new maps.maps.Marker({
          map,
          position: { lat: center.latitude, lng: center.longitude },
          title: 'Your search location',
          label: 'You',
        });
        currentMarker.addListener('click', () => {
          infoWindow.setContent('Your search location');
          infoWindow.open({ map, anchor: currentMarker });
        });
        overlays = [circle, currentMarker];

        for (const item of equipment) {
          if (item.latitude === null || item.longitude === null) continue;
          const marker = new maps.maps.Marker({
            map,
            position: { lat: item.latitude, lng: item.longitude },
            title: item.name,
          });
          marker.addListener('click', () => {
            const card = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = item.name;
            const distance = document.createElement('div');
            distance.textContent = `${item.distanceKm.toFixed(1)} km away`;
            const location = document.createElement('div');
            location.textContent = item.location;
            card.append(name, distance, location);
            infoWindow.setContent(card);
            infoWindow.open({ map, anchor: marker });
          });
          overlays.push(marker);
        }
        setError(null);
      })
      .catch((mapError: unknown) => {
        if (active) {
          setError(mapError instanceof Error ? mapError.message : 'Google Maps could not be loaded.');
        }
      });

    return () => {
      active = false;
      const maps = window.google?.maps;
      overlays.forEach((overlay) => {
        if (maps && (overlay instanceof maps.Circle || overlay instanceof maps.Marker)) {
          overlay.setMap(null);
        }
      });
    };
  }, [center.latitude, center.longitude, equipment, radiusKm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        ref={mapElement}
        aria-label="Map showing your search location and nearby equipment"
        style={{
          width: '100%',
          height: 320,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#e5f0e9',
        }}
      />
      {error ? <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText> : null}
    </div>
  );
}
