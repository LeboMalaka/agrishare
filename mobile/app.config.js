const { expo } = require('./app.json');

module.exports = ({ config }) => {
  const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    ...expo,
    android: {
      ...config.android,
      ...expo.android,
      ...(androidMapsKey
        ? {
            config: {
              ...config.android?.config,
              ...expo.android?.config,
              googleMaps: { apiKey: androidMapsKey },
            },
          }
        : {}),
    },
    ios: {
      ...config.ios,
      ...expo.ios,
    },
    plugins: [
      ...(expo.plugins ?? []),
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'AgriShare uses your location to find nearby equipment.',
        },
      ],
      [
        'expo-maps',
        {
          requestLocationPermission: true,
          locationPermission: 'AgriShare uses your location to find nearby equipment.',
        },
      ],
    ],
  };
};
