declare global {
  interface Window {
    google?: {
      maps: typeof google.maps;
    };
  }
}

type GoogleMapsApi = NonNullable<Window['google']>;

let mapsApiPromise: Promise<GoogleMapsApi> | undefined;

export function loadGoogleMapsApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in a browser.'));
  }
  if (window.google?.maps) return Promise.resolve(window.google);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        'Town and address search on web needs EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env. Enable Maps JavaScript API and Geocoding API, then restart Expo.',
      ),
    );
  }

  if (!mapsApiPromise) {
    mapsApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-agrishare-google-maps]');
      const script = existingScript ?? document.createElement('script');
      script.dataset.agrishareGoogleMaps = 'true';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.async = true;
      script.onload = () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error('Google Maps loaded without its JavaScript API.'));
      };
      script.onerror = () => {
        mapsApiPromise = undefined;
        script.remove();
        reject(new Error(
          'Google Maps could not load. Check that the Maps JavaScript API and Geocoding API are enabled, billing is active, and the browser key allows this site.',
        ));
      };
      if (!existingScript) document.head.appendChild(script);
    });
  }
  return mapsApiPromise;
}

export async function geocodeAddress(address: string) {
  const maps = await loadGoogleMapsApi();
  const response = await new maps.maps.Geocoder().geocode({ address });
  return response.results.slice(0, 5).map((result) => {
    const coordinates = result.geometry.location;
    return {
      label: result.formatted_address,
      coordinates: { latitude: coordinates.lat(), longitude: coordinates.lng() },
    };
  });
}
