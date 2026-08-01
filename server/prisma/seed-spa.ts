import { PrismaClient, Species, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Spa Brands & Services Cutepets...');

  // 1. Create or update SpaBrands
  const brandDefs = [
    { name: 'Tắm', description: 'Gói dịch vụ chỉ tắm chuyên sâu', isMain: true },
    { name: 'Cạo lông', description: 'Tư vấn cạo lông phù hợp', isMain: true },
    { name: 'Vệ sinh', description: 'Cắt móng, cạo bàn, ngoáy tai, vệ sinh tai', isMain: true },
    { name: 'Combo', description: 'Các gói kết hợp Tắm, Cạo và Vệ sinh', isMain: true },
    { name: 'Spa', description: 'Gói Spa cắt tỉa đầy đủ & tạo kiểu', isMain: true },
    { name: 'Dịch vụ lẻ', description: 'Các dịch vụ chăm sóc nhỏ chọn thêm', isMain: false },
  ];

  const brandMap: Record<string, string> = {};

  for (const b of brandDefs) {
    let brand = await prisma.spaCategory.findFirst({
      where: { name: b.name },
    });

    if (!brand) {
      brand = await prisma.spaCategory.create({
        data: {
          name: b.name,
          description: b.description,
          isMain: b.isMain,
          status: ApprovalStatus.ACTIVE,
        },
      });
    } else {
      brand = await prisma.spaCategory.update({
        where: { id: brand.id },
        data: {
          isMain: b.isMain,
          status: ApprovalStatus.ACTIVE,
        },
      });
    }
    brandMap[b.name] = brand.id;
  }

  // Clear old services to avoid duplicate seeding
  await prisma.spaService.deleteMany({});

  // 2. Define Dog Services
  const dogWeightBrackets = [
    { label: '<1.5kg', min: 0, max: 1.5 },
    { label: '1.5-3kg', min: 1.5, max: 3 },
    { label: '3-6kg', min: 3, max: 6 },
    { label: '6-10kg', min: 6, max: 10 },
    { label: '10-15kg', min: 10, max: 15 },
    { label: '15-20kg', min: 15, max: 20 },
    { label: '20-30kg', min: 20, max: 30 },
    { label: '>30kg', min: 30, max: 100 },
  ];

  const dogMainPackages = [
    {
      name: 'Chỉ Tắm',
      brand: 'Tắm',
      durMin: 20,
      durMax: 40,
      prices: [50000, 70000, 110000, 150000, 210000, 270000, 340000, 340000],
      desc: 'Bao gồm: Chải lông, tắm xà bông 2 lần, vắt tuyến hôi, sấy khô, thoa tinh dầu.',
    },
    {
      name: 'Cạo lông',
      brand: 'Cạo lông',
      durMin: 30,
      durMax: 60,
      prices: [90000, 100000, 120000, 140000, 160000, 180000, 200000, 220000],
      desc: 'Tư vấn kiểu cạo lông phù hợp cho chó.',
    },
    {
      name: 'Tắm + Vệ sinh',
      brand: 'Combo',
      durMin: 20,
      durMax: 40,
      prices: [70000, 100000, 140000, 190000, 250000, 320000, 390000, 390000],
      desc: 'Combo Tắm toàn diện kết hợp Cắt móng, cạo bàn, nhổ lông tai, vệ sinh tai, cạo lông bụng/hậu môn.',
    },
    {
      name: 'Tắm + Cạo + Vệ sinh',
      brand: 'Combo',
      durMin: 30,
      durMax: 60,
      prices: [140000, 170000, 210000, 270000, 320000, 380000, 440000, 440000],
      desc: 'Trọn gói Combo Tắm + Cạo toàn thân + Vệ sinh 6 bước.',
    },
    {
      name: 'SPA Cắt tỉa',
      brand: 'Spa',
      durMin: 150,
      durMax: 240,
      prices: [220000, 260000, 310000, 380000, 430000, 500000, 560000, 590000],
      desc: 'Đầy đủ gói Tắm + Vệ sinh + Tư vấn cắt tỉa thẩm mỹ kiểu dáng đẹp.',
    },
  ];

  const servicesToCreate: any[] = [];

  for (const pkg of dogMainPackages) {
    dogWeightBrackets.forEach((w, index) => {
      servicesToCreate.push({
        categoryId: brandMap[pkg.brand],
        name: `${pkg.name} (${w.label})`,
        description: pkg.desc,
        species: Species.DOG,
        petWeightMin: w.min,
        petWeightMax: w.max,
        price: pkg.prices[index],
        durationMin: pkg.durMin,
        durationMax: pkg.durMax,
        isMain: true,
        isActive: true,
      });
    });
  }

  // 3. Define Cat Services
  const catWeightBrackets = [
    { label: '<1.5kg', min: 0, max: 1.5 },
    { label: '1.5-3kg', min: 1.5, max: 3 },
    { label: '3-6kg', min: 3, max: 6 },
    { label: '6-10kg', min: 6, max: 10 },
    { label: '>10kg', min: 10, max: 100 },
  ];

  const catMainPackages = [
    {
      name: 'Chỉ Tắm',
      brand: 'Tắm',
      durMin: 20,
      durMax: 40,
      prices: [50000, 90000, 140000, 190000, 240000],
      desc: 'Tắm xà bông sạch sẽ dịu nhẹ cho mèo (Tặng cắt móng miễn phí khi dùng dịch vụ).',
    },
    {
      name: 'Cạo lông',
      brand: 'Cạo lông',
      durMin: 30,
      durMax: 60,
      prices: [90000, 120000, 160000, 210000, 260000],
      desc: 'Cạo lông gọn gàng phù hợp cho mèo.',
    },
    {
      name: 'Tắm + Vệ sinh',
      brand: 'Combo',
      durMin: 20,
      durMax: 40,
      prices: [70000, 110000, 160000, 220000, 280000],
      desc: 'Tắm sạch kết hợp vệ sinh tai, cạo bàn, cắt móng cho mèo.',
    },
    {
      name: 'Tắm + Cạo + Vệ sinh',
      brand: 'Combo',
      durMin: 30,
      durMax: 60,
      prices: [140000, 180000, 250000, 350000, 400000],
      desc: 'Gói toàn diện cho mèo: Tắm + Cạo lông + Vệ sinh.',
    },
  ];

  for (const pkg of catMainPackages) {
    catWeightBrackets.forEach((w, index) => {
      servicesToCreate.push({
        categoryId: brandMap[pkg.brand],
        name: `${pkg.name} (${w.label})`,
        description: pkg.desc,
        species: Species.CAT,
        petWeightMin: w.min,
        petWeightMax: w.max,
        price: pkg.prices[index],
        durationMin: pkg.durMin,
        durationMax: pkg.durMax,
        isMain: true,
        isActive: true,
      });
    });
  }

  // 4. Define Sub Services (Dịch vụ lẻ)
  const addonBrandId = brandMap['Dịch vụ lẻ'];
  const addonServices = [
    {
      name: 'Tắm nấm, bọ <5kg',
      desc: 'Dịch vụ tắm trị liệu diệt nấm bọ cho bé dưới 5kg',
      species: Species.DOG,
      petWeightMin: 0,
      petWeightMax: 5,
      price: 30000,
      durationMin: 15,
      durationMax: 20,
      isMain: false,
    },
    {
      name: 'Tắm nấm, bọ 5-15kg',
      desc: 'Dịch vụ tắm trị liệu diệt nấm bọ cho bé từ 5 đến 15kg',
      species: Species.DOG,
      petWeightMin: 5,
      petWeightMax: 15,
      price: 40000,
      durationMin: 15,
      durationMax: 20,
      isMain: false,
    },
    {
      name: 'Tắm nấm, bọ >15kg',
      desc: 'Dịch vụ tắm trị liệu diệt nấm bọ cho bé trên 15kg',
      species: Species.DOG,
      petWeightMin: 15,
      petWeightMax: 100,
      price: 70000,
      durationMin: 15,
      durationMax: 20,
      isMain: false,
    },
    {
      name: 'Cắt móng, cạo bàn',
      desc: 'Cắt móng & cạo sạch lông đệm bàn chân',
      species: null,
      price: 50000,
      durationMin: 10,
      durationMax: 15,
      isMain: false,
    },
    {
      name: 'Cạo bụng, hậu môn',
      desc: 'Vệ sinh cạo lông vùng bụng và hậu môn',
      species: null,
      price: 20000,
      durationMin: 10,
      durationMax: 15,
      isMain: false,
    },
    {
      name: 'Vệ sinh tai',
      desc: 'Vệ sinh lau sạch bụi bẩn và ráy tai',
      species: null,
      price: 20000,
      durationMin: 10,
      durationMax: 15,
      isMain: false,
    },
    {
      name: 'Bấm gọn mắt, miệng',
      desc: 'Tỉa gọn gàng vùng lông quanh mắt và khuôn miệng',
      species: null,
      price: 20000,
      durationMin: 10,
      durationMax: 15,
      isMain: false,
    },
    {
      name: 'Gỡ rối lông',
      desc: 'Gỡ các vón gút lông xơ rối',
      species: null,
      price: 50000,
      durationMin: 20,
      durationMax: 40,
      isMain: false,
    },
  ];

  for (const s of addonServices) {
    servicesToCreate.push({
      categoryId: addonBrandId,
      name: s.name,
      description: s.desc,
      species: s.species || null,
      petWeightMin: s.petWeightMin ?? null,
      petWeightMax: s.petWeightMax ?? null,
      price: s.price,
      durationMin: s.durationMin,
      durationMax: s.durationMax,
      isMain: false,
      isActive: true,
    });
  }

  // Insert all services
  await prisma.spaService.createMany({
    data: servicesToCreate,
  });

  console.log(`Successfully seeded ${servicesToCreate.length} Spa Services!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
