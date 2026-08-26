const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HANOI_POPULAR_WARDS = [
  { name: 'Phường Hoàn Kiếm', lat: 21.0285, lng: 105.8542 },
  { name: 'Phường Cầu Giấy', lat: 21.0338, lng: 105.7944 },
  { name: 'Phường Ba Đình', lat: 21.0345, lng: 105.8236 },
  { name: 'Phường Tây Hồ', lat: 21.0667, lng: 105.8192 },
  { name: 'Phường Đống Đa', lat: 21.0156, lng: 105.8289 },
  { name: 'Phường Hai Bà Trưng', lat: 21.0108, lng: 105.8522 },
  { name: 'Phường Thanh Xuân', lat: 20.9989, lng: 105.8089 },
  { name: 'Phường Nghĩa Đô', lat: 21.0456, lng: 105.7958 },
  { name: 'Phường Yên Hòa', lat: 21.0189, lng: 105.7911 },
  { name: 'Phường Giảng Võ', lat: 21.0272, lng: 105.8197 },
  { name: 'Phường Ngọc Hà', lat: 21.0378, lng: 105.8269 },
  { name: 'Phường Long Biên', lat: 21.0333, lng: 105.8894 },
  { name: 'Phường Hà Đông', lat: 20.9722, lng: 105.7761 },
  { name: 'Phường Hoàng Mai', lat: 20.9781, lng: 105.8578 },
];

async function syncPetLocations() {
  try {
    const pets = await prisma.pet.findMany();
    console.log(`Tìm thấy ${pets.length} thú cưng trong database.`);

    let updatedCount = 0;
    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i];
      // Nếu pet chưa có toạ độ hoặc toạ độ null
      if (pet.latitude == null || pet.longitude == null || pet.location !== 'Hà Nội') {
        const assignedWard = HANOI_POPULAR_WARDS[i % HANOI_POPULAR_WARDS.length];
        await prisma.pet.update({
          where: { id: pet.id },
          data: {
            location: 'Hà Nội',
            district: null,
            ward: pet.ward || assignedWard.name,
            latitude: pet.latitude || assignedWard.lat,
            longitude: pet.longitude || assignedWard.lng,
          },
        });
        console.log(`✓ Đã cập nhật Pet: "${pet.name}" -> ${assignedWard.name}, Hà Nội (${assignedWard.lat}, ${assignedWard.lng})`);
        updatedCount++;
      }
    }

    console.log(`\n Hoàn thành cập nhật ${updatedCount}/${pets.length} thú cưng sang toạ độ chuẩn Hà Nội.`);
  } catch (err) {
    console.error('Lỗi khi đồng bộ vị trí pet:', err);
  } finally {
    await prisma.$disconnect();
  }
}

syncPetLocations();
