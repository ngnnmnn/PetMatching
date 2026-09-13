/**
 * Script cập nhật địa chỉ và toạ độ GPS chính xác cho toàn bộ thú cưng hiện có
 * theo định dạng mới tích hợp OpenStreetMap.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PET_ADDRESS_UPDATES = {
  // Gâu đần đực (Golden Retriever Đực)
  cmtaa0qln0003dr3nkr0w80wa: {
    location: 'Số 28 Phố Nhà Chung, Phường Hàng Trống, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Hàng Trống',
    latitude: 21.028912,
    longitude: 105.849174,
  },
  // asdasd (Shiba Inu Cái)
  cmta4hzdk00013j64167nj4xf: {
    location: 'Số 65 Phố Hàng Bông, Phường Hàng Bông, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Hàng Bông',
    latitude: 21.030512,
    longitude: 105.847231,
  },
  // cho co (Chó Phú Quốc Cái)
  cmte5qns80001u1kwdwh7oan2: {
    location: 'Số 18 Phố Ngọc Hà, Phường Ngọc Hà, Quận Ba Đình, Thành phố Hà Nội',
    district: 'Quận Ba Đình',
    ward: 'Phường Ngọc Hà',
    latitude: 21.038415,
    longitude: 105.831524,
  },
  // cokia (becgie duc Đực)
  cmsbb1bpc000baz2divi10oqb: {
    location: 'Số 182 Phố Ô Chợ Dừa, Phường Ô Chợ Dừa, Quận Đống Đa, Thành phố Hà Nội',
    district: 'Quận Đống Đa',
    ward: 'Phường Ô Chợ Dừa',
    latitude: 21.022950,
    longitude: 105.826135,
  },
  // becgie male (becgie duc Đực)
  cmstlycsk00013j6s68gkp9wx: {
    location: 'Số 74 Phố Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Thành phố Hà Nội',
    district: 'Quận Đống Đa',
    ward: 'Phường Quang Trung',
    latitude: 21.007624,
    longitude: 105.828452,
  },
  // Chihuahua Cái (Chihuahua Cái)
  cmtaaibut000ddr3n9gyx49bp: {
    location: 'Số 42 Phố Hàng Bài, Phường Hàng Bài, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Hàng Bài',
    latitude: 21.022756,
    longitude: 105.853245,
  },
  // ChoHuskyCai (Husky Cái)
  cmst3cjou0009g8356cme7xwq: {
    location: 'Số 45 Phố Bồ Đề, Phường Bồ Đề, Quận Long Biên, Thành phố Hà Nội',
    district: 'Quận Long Biên',
    ward: 'Phường Bồ Đề',
    latitude: 21.036125,
    longitude: 105.871745,
  },
  // Mây (Corgi Cái)
  cmstlf0lg00013jxoidbw2d6t: {
    location: 'Số 72 Phố Dịch Vọng, Phường Dịch Vọng, Quận Cầu Giấy, Thành phố Hà Nội',
    district: 'Quận Cầu Giấy',
    ward: 'Phường Dịch Vọng',
    latitude: 21.034012,
    longitude: 105.793045,
  },
  // mat ong (phoc huou Đực)
  cmsb2u1pj00013jtkrgw4iyvu: {
    location: 'Khu Công Nghệ Cao Hòa Lạc, Xã Tân Xã, Huyện Thạch Thất, Thành phố Hà Nội',
    district: 'Huyện Thạch Thất',
    ward: 'Xã Tân Xã',
    latitude: 21.021256,
    longitude: 105.551208,
  },
  // asdcxz (Samoyed Cái)
  cmta4jwiu00033j6476ukpokv: {
    location: 'Số 12 Phố Đinh Tiên Hoàng, Phường Hàng Bạc, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Hàng Bạc',
    latitude: 21.031852,
    longitude: 105.852943,
  },
  // ChoHuskyDuc (Husky Đực)
  cmst3arpt0005g835hqkgjmwb: {
    location: 'Số 136 Đường Nguyễn Văn Cừ, Phường Bồ Đề, Quận Long Biên, Thành phố Hà Nội',
    district: 'Quận Long Biên',
    ward: 'Phường Bồ Đề',
    latitude: 21.044690,
    longitude: 105.870374,
  },
  // Poodle1 (Poodle Đực)
  cmt1ng47t0005im35mgm3dwhb: {
    location: 'Số 15 Phố Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Tràng Tiền',
    latitude: 21.024146,
    longitude: 105.855780,
  },
  // Poodle4 (Poodle Cái)
  cmt1nj2cs000bim35iceqbwbu: {
    location: 'Số 8 Phố Lý Thường Kiệt, Phường Phan Chu Trinh, Quận Hoàn Kiếm, Thành phố Hà Nội',
    district: 'Quận Hoàn Kiếm',
    ward: 'Phường Phan Chu Trinh',
    latitude: 21.023845,
    longitude: 105.858124,
  },
  // Test Khác Quận (Hà Nội - Đống Đa) (Corgi Đực)
  cmstlldr900033jgsjw5eyv3z: {
    location: 'Số 120 Phố Thái Hà, Phường Trung Liệt, Quận Đống Đa, Thành phố Hà Nội',
    district: 'Quận Đống Đa',
    ward: 'Phường Trung Liệt',
    latitude: 21.012543,
    longitude: 105.819321,
  },
  // Simba (Corgi Đực)
  cmstlf0xv00033jxok8rdi94h: {
    location: 'Số 88 Phố Xuân Diệu, Phường Quảng An, Quận Tây Hồ, Thành phố Hà Nội',
    district: 'Quận Tây Hồ',
    ward: 'Phường Quảng An',
    latitude: 21.062382,
    longitude: 105.830103,
  },
  // Husky Đẹp Trai (Husky Đực)
  cmstlj1xc00013jzgez8vew5j: {
    location: 'Số 82 Phố Ngọc Lâm, Phường Ngọc Lâm, Quận Long Biên, Thành phố Hà Nội',
    district: 'Quận Long Biên',
    ward: 'Phường Ngọc Lâm',
    latitude: 21.045214,
    longitude: 105.868932,
  },
  // a (Shiba Inu Đực)
  cmstmj52k000avjagvbyagrze: {
    location: 'Số 32 Phố Đội Cấn, Phường Đội Cấn, Quận Ba Đình, Thành phố Hà Nội',
    district: 'Quận Ba Đình',
    ward: 'Phường Đội Cấn',
    latitude: 21.034254,
    longitude: 105.830997,
  },
  // Sico (Alaska Đực)
  cmtmq2vkh000ag435pkflj1x2: {
    location: 'Số 19 Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Thành phố Hà Nội',
    district: 'Quận Cầu Giấy',
    ward: 'Phường Dịch Vọng Hậu',
    latitude: 21.029327,
    longitude: 105.781524,
  },
  // kikii (Sphynx Mèo Cái)
  cmtxcf5tb00053jc07qrpffou: {
    location: 'Số 55 Phố Liễu Giai, Phường Liễu Giai, Quận Ba Đình, Thành phố Hà Nội',
    district: 'Quận Ba Đình',
    ward: 'Phường Liễu Giai',
    latitude: 21.033621,
    longitude: 105.814234,
  },
};

async function main() {
  console.log('--- Bắt đầu cập nhật địa chỉ thú cưng theo định dạng mới OpenStreetMap ---');
  let updatedCount = 0;

  for (const [petId, data] of Object.entries(PET_ADDRESS_UPDATES)) {
    try {
      const pet = await prisma.pet.update({
        where: { id: petId },
        data: {
          location: data.location,
          district: data.district,
          ward: data.ward,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
      console.log(`[OK] Đã cập nhật cho pet: ${pet.name} (${pet.id}) -> ${data.location} [${data.latitude}, ${data.longitude}]`);
      updatedCount++;
    } catch (err) {
      console.error(`[LỖI] Không cập nhật được pet ${petId}:`, err.message);
    }
  }

  console.log(`--- Hoàn thành cập nhật ${updatedCount}/${Object.keys(PET_ADDRESS_UPDATES).length} thú cưng! ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
