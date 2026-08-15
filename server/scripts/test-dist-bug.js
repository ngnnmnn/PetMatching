const fs = require('fs');

function calculateHaversineDistance(
  lat1,
  lon1,
  lat2,
  lon2,
) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const fLat = 21.0212563;
const fLng = 105.5512084;

// Coordinates from province-coordinates.ts
const PROVINCE_COORDINATES = {
  'ha noi': { lat: 21.0285, lng: 105.8542 },
  'tp. ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'da nang': { lat: 16.0544, lng: 108.2022 },
  'hai phong': { lat: 20.8449, lng: 106.6881 },
  'thanh hoa': { lat: 19.8067, lng: 105.7851 },
  'ha nam': { lat: 20.5453, lng: 105.9126 }
};

for (const [prov, coords] of Object.entries(PROVINCE_COORDINATES)) {
    const dist = calculateHaversineDistance(fLat, fLng, coords.lat, coords.lng);
    console.log(`Distance to ${prov}: ${dist} km`);
}
