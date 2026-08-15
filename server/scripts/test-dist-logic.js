const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Emulate getProvinceCoords
const PROVINCE_COORDINATES = {
  'ha noi': { lat: 21.0285, lng: 105.8542 },
  'tp. ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'hai phong': { lat: 20.8449, lng: 106.6881 },
  // ... others
};

function removeVietnameseTones(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function getProvinceCoords(locationName) {
  if (!locationName) return null;
  const normalized = removeVietnameseTones(locationName);
  
  if (PROVINCE_COORDINATES[normalized]) return PROVINCE_COORDINATES[normalized];
  
  const cleaned = normalized.replace(/^(tp\.?|thanh pho|tinh)\s+/i, '').trim();
  if (PROVINCE_COORDINATES[cleaned]) return PROVINCE_COORDINATES[cleaned];
  
  for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
    if (normalized.includes(key) || key.includes(normalized) || cleaned.includes(key)) {
      return coords;
    }
  }
  return null;
}

async function testMatchingServiceLogic() {
  const femalePet = await prisma.pet.findUnique({
    where: { id: 'cmstm0wyp000d3j6s31a8jlsh' } // begie female
  });
  
  const candidates = await prisma.pet.findMany({
    where: { gender: 'MALE' }
  });
  
  for (const candidate of candidates) {
      let distanceKm = 10;
      const femaleLat = femalePet.latitude;
      const femaleLng = femalePet.longitude;
      const candLat = candidate.latitude;
      const candLng = candidate.longitude;

      const isSameLocation =
        femalePet.location &&
        candidate.location &&
        femalePet.location.trim().toLowerCase() === candidate.location.trim().toLowerCase();

      const isSameDistrict =
        isSameLocation &&
        femalePet.district &&
        candidate.district &&
        femalePet.district.trim().toLowerCase() === candidate.district.trim().toLowerCase();

      if (femaleLat != null && femaleLng != null && candLat != null && candLng != null) {
        distanceKm = calculateHaversineDistance(femaleLat, femaleLng, candLat, candLng);
      } else if (isSameDistrict) {
        distanceKm = 3.5;
      } else if (isSameLocation) {
        distanceKm = 12.0;
      } else {
        const fCoords =
          femaleLat != null && femaleLng != null
            ? { lat: femaleLat, lng: femaleLng }
            : getProvinceCoords(femalePet.location);
        const cCoords =
          candLat != null && candLng != null
            ? { lat: candLat, lng: candLng }
            : getProvinceCoords(candidate.location);

        if (fCoords && cCoords) {
          distanceKm = calculateHaversineDistance(
            fCoords.lat,
            fCoords.lng,
            cCoords.lat,
            cCoords.lng,
          );
        } else {
          distanceKm = 250.0;
        }
      }
      console.log(`To ${candidate.name} (${candidate.location}): ${distanceKm} km (candLat: ${candLat}, candLng: ${candLng})`);
  }
}

testMatchingServiceLogic().finally(() => prisma.$disconnect());
