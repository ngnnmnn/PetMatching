import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function main() {
  console.log('🚀 Bắt đầu cập nhật toàn bộ sản phẩm và variant...');

  const updates = [
    {
      id: '513240',
      name: 'Bát Ăn Tự Động Thông Minh PUKY 4L (Có Camera & Loa Khứ Hồi)',
      description: 'Bát ăn tự động thông minh PUKY dung tích 4L, hỗ trợ cài đặt tối đa 6 bữa/ngày. Tích hợp camera ghi hình HD 1080p, loa đàm thoại 2 chiều và kết nối Wi-Fi qua ứng dụng di động giúp bạn theo dõi và chăm sóc thú cưng mọi lúc mọi nơi.',
      brand: 'PUKY',
      unit: 'Cái',
      specifications: {
        'Dung tích': '4 Lít',
        'Số bữa ăn': 'Tối đa 6 bữa/ngày (1-20 phần/bữa)',
        'Kích thước': '20cm x 20cm x 33cm',
        'Camera': 'HD 1080p góc rộng, quay đêm hồng ngoại',
        'Kết nối': 'Wi-Fi 2.4GHz / App di động',
        'Chất liệu': 'Nhựa ABS cao cấp & Khay inox 304',
      },
      variants: [
        { name: 'Bản Thường (Không Camera)', sellingPrice: 850000, salePrice: 790000, stock: 15, attributes: { version: 'Thường' } },
        { name: 'Bản Cao Cấp (Có Camera HD & Wi-Fi)', sellingPrice: 1350000, salePrice: 1250000, stock: 10, attributes: { version: 'Camera HD' } },
      ],
    },
    {
      id: '465361',
      name: 'Thức Ăn Hạt Royal Canin Corgi Adult',
      description: 'Thức ăn hạt cao cấp dành riêng cho giống chó Corgi từ 12 tháng tuổi trở lên. Công thức đặc chế giúp duy trì cân nặng lý tưởng, hỗ trợ xương khớp dẻo dai và nuôi dưỡng bộ lông mượt mà.',
      brand: 'Royal Canin',
      unit: 'Túi',
      specifications: {
        'Độ tuổi': 'Chó trưởng thành (> 12 tháng)',
        'Giống chó': 'Corgi Pembroke & Cardigan',
        'Trọng lượng túi': '1.5kg (Túi nhỏ), 3kg (Túi vừa), 10kg (Túi lớn)',
        'Thành phần chính': 'Thịt gia cầm, gạo, ngô, protein động vật, dầu cá, Glucosamine',
        'Xuất xứ': 'Pháp',
      },
      variants: [
        { name: 'Túi 1.5kg', sellingPrice: 650000, salePrice: 620000, stock: 50, attributes: { weight: '1.5kg' } },
        { name: 'Túi 3kg', sellingPrice: 1200000, salePrice: 1150000, stock: 30, attributes: { weight: '3kg' } },
        { name: 'Túi 10kg', sellingPrice: 3500000, salePrice: 3350000, stock: 12, attributes: { weight: '10kg' } },
      ],
    },
    {
      id: '637852',
      name: 'Thức Ăn Hạt Cho Mèo Whiskas Vị Cá Ngừ',
      description: 'Thức ăn hạt Whiskas hương vị cá ngừ thơm ngon đậm đà, giàu Protein, Omega 3 & 6 cùng 41 dưỡng chất thiết yếu giúp mèo phát triển khỏe mạnh, mắt sáng và lông bóng mượt.',
      brand: 'Whiskas',
      unit: 'Túi',
      specifications: {
        'Đối tượng': 'Mèo từ 1 tuổi trở lên',
        'Hương vị': 'Cá ngừ đại dương',
        'Trọng lượng': '1.2kg (Túi vừa), 3kg (Túi tiết kiệm)',
        'Hạn sử dụng': '18 tháng kể từ ngày sản xuất',
        'Xuất xứ': 'Thái Lan',
      },
      variants: [
        { name: 'Túi 1.2kg', sellingPrice: 1350000, salePrice: 125000, stock: 40, attributes: { weight: '1.2kg' } },
        { name: 'Túi 3kg', sellingPrice: 310000, salePrice: 295000, stock: 25, attributes: { weight: '3kg' } },
      ],
    },
    {
      id: '145836',
      name: 'Ổ Đệm Tròn Nỉ Bông Siêu Mềm Cho Chó Mèo',
      description: 'Ổ đệm tròn bông xù siêu êm ái, bọc vải flannel giữ ấm tốt, có đế chống trượt hiệu quả. Giúp thú cưng có giấc ngủ ngon, giảm căng thẳng và bảo vệ xương khớp.',
      brand: 'PetCare',
      unit: 'Cái',
      specifications: {
        'Kích thước': 'Đường kính 40cm (Size S - Mèo < 4kg), 50cm (Size M - Mèo < 8kg), 60cm (Size L - Cún & Mèo < 13kg)',
        'Chất liệu': 'Bông PP cao cấp, vải nhung Flannel, đế cao su hạt chống trượt',
        'Màu sắc': 'Xám Ghi, Hồng Phấn, Nâu Kem',
        'Xuất xứ': 'Đài Loan',
      },
      variants: [
        { name: 'Size S (40cm) - Xám Ghi', sellingPrice: 140000, salePrice: 129000, stock: 20, attributes: { size: 'S', color: 'Xám Ghi' } },
        { name: 'Size M (50cm) - Xám Ghi', sellingPrice: 175000, salePrice: 159000, stock: 15, attributes: { size: 'M', color: 'Xám Ghi' } },
        { name: 'Size L (60cm) - Hồng Phấn', sellingPrice: 210000, salePrice: 189000, stock: 12, attributes: { size: 'L', color: 'Hồng Phấn' } },
      ],
    },
    {
      id: '436240',
      name: 'Thức Ăn Dạng Pate Pedigree Cho Chó (Hộp 12 Gói x 130g)',
      description: 'Pate tươi Pedigree vị thịt bò và gà sốt đậm đà, bổ sung chất xơ, Canxi và Vitamin E. Tiện lợi mở gói ăn liền, kích thích vị giác giúp chó ăn ngon miệng hơn.',
      brand: 'Pedigree',
      unit: 'Hộp',
      specifications: {
        'Quy cách': 'Hộp 12 gói (130g/gói)',
        'Hương vị': 'Vị Thịt Bò Sốt, Vị Gà & Nấm',
        'Độ tuổi': 'Chó từ 3 tháng tuổi trở lên',
        'Bảo quản': 'Nơi khô ráo, giữ lạnh sau khi mở gói tối đa 3 ngày',
      },
      variants: [
        { name: 'Vị Thịt Bò Sốt (Hộp 12 gói)', sellingPrice: 220000, salePrice: 199000, stock: 30, attributes: { flavor: 'Thịt Bò' } },
        { name: 'Vị Gà & Nấm (Hộp 12 gói)', sellingPrice: 220000, salePrice: 199000, stock: 25, attributes: { flavor: 'Gà & Nấm' } },
      ],
    },
    {
      id: '128686',
      name: 'Cần Câu Đồ Chơi Lông Vũ Cho Mèo (Tương Tác Dây Thép Dẻo)',
      description: 'Cần câu mèo dây thép dẻo đính lông vũ tự nhiên và chuông leng keng vui tai. Dụng cụ giải trí tuyệt vời giúp mèo vận động linh hoạt, giải tỏa năng lượng tích tụ và tăng tình cảm với chủ.',
      brand: 'PetJoy',
      unit: 'Cái',
      specifications: {
        'Chiều dài cần': '90cm (Thép dẻo đàn hồi cao)',
        'Phụ kiện đi kèm': 'Lông vũ nhiều màu + Chuông nhỏ',
        'Chất liệu': 'Cần nhựa + Dây thép không gỉ + Lông vũ tự nhiên',
        'Trọng lượng': '50g',
      },
      variants: [
        { name: 'Đầu Lông Vũ Tự Nhiên', sellingPrice: 35000, salePrice: null, stock: 50, attributes: { type: 'Lông Vũ' } },
        { name: 'Đầu Con Sâu Vải Mềm', sellingPrice: 40000, salePrice: null, stock: 40, attributes: { type: 'Con Sâu' } },
      ],
    },
    {
      id: '789288',
      name: 'Sữa Tắm Thơm Lâu Khử Mùi Cho Chó Joyce & Dolls (500ml)',
      description: 'Sữa tắm lưu hương hoa phấn dịu nhẹ Joyce & Dolls giúp dưỡng lông mềm mượt, khử mùi hôi hiệu quả trong 7 ngày, kháng khuẩn và dịu nhẹ cho da nhạy cảm của cún cưng.',
      brand: 'Joyce & Dolls',
      unit: 'Chai',
      specifications: {
        'Dung tích': '500ml (Chai vòi nhấn tiện lợi)',
        'Mùi hương': 'Hương Hoa Phấn (Phấn baby), Hương Hoa Rose',
        'Công dụng': 'Dưỡng lông, khử mùi, diệt khuẩn gàu rận',
        'Xuất xứ': 'Hồng Kông',
      },
      variants: [
        { name: 'Hương Phấn Baby (500ml)', sellingPrice: 165000, salePrice: 149000, stock: 30, attributes: { scent: 'Phấn Baby' } },
        { name: 'Hương Hoa Rose (500ml)', sellingPrice: 165000, salePrice: 149000, stock: 20, attributes: { scent: 'Hoa Rose' } },
      ],
    },
    {
      id: '848721',
      name: 'Bóng Cao Su Đồ Chơi Gắn Chuông Cho Chó',
      description: 'Bóng cao su đúc nguyên khối siêu bền, chịu lực cắn tốt, có rãnh làm sạch răng và phát ra tiếng kêu vui tai khi chó cắn vần. Thích hợp cho các trò chơi nhặt đồ, huấn luyện.',
      brand: 'DogToy',
      unit: 'Quả',
      specifications: {
        'Kích thước': 'Đường kính 5.5cm (Size S - Chó nhỏ < 8kg), 7cm (Size L - Chó trung & lớn)',
        'Chất liệu': 'Cao su tự nhiên TPR an toàn không độc hại',
        'Màu sắc': 'Xanh Dương, Cam',
      },
      variants: [
        { name: 'Size S (5.5cm) - Xanh Dương', sellingPrice: 45000, salePrice: null, stock: 40, attributes: { size: 'S', color: 'Xanh Dương' } },
        { name: 'Size L (7cm) - Cam', sellingPrice: 65000, salePrice: 59000, stock: 30, attributes: { size: 'L', color: 'Cam' } },
      ],
    },
    {
      id: '832425',
      name: 'Chuồng Sắt Sơn Tĩnh Điện Gấp Gọn Có Khay Vệ Sinh',
      description: 'Chuồng sắt sơn tĩnh điện cao cấp chống gỉ sét, thiết kế 2 cửa mở tiện lợi, có khay hứng vệ sinh bên dưới dễ dàng tháo rửa. Dễ dàng gấp gọn để di chuyển hoặc cất giữ.',
      brand: 'PetHome',
      unit: 'Bộ',
      specifications: {
        'Kích thước': '50cm x 35cm x 42cm (Size S), 60cm x 42cm x 50cm (Size M), 75cm x 55cm x 65cm (Size L)',
        'Chất liệu': 'Thép sơn tĩnh điện đen mờ, khay nhựa PP',
        'Tải trọng': 'Chịu lực từ 10kg đến 30kg tùy size',
        'Trọng lượng chuồng': '4.5kg (Size S), 6.2kg (Size M), 8.5kg (Size L)',
      },
      variants: [
        { name: 'Size S (50x35x42cm)', sellingPrice: 290000, salePrice: 269000, stock: 15, attributes: { size: 'S' } },
        { name: 'Size M (60x42x50cm)', sellingPrice: 380000, salePrice: 349000, stock: 20, attributes: { size: 'M' } },
        { name: 'Size L (75x55x65cm)', sellingPrice: 520000, salePrice: 489000, stock: 10, attributes: { size: 'L' } },
      ],
    },
    {
      id: '848880',
      name: 'Dây Dắt Chó Tự Động Rút Thông Minh (Tích Hợp Khóa An Toàn)',
      description: 'Dây dắt tự rút chiều dài 3m / 5m cuộn êm ái, trang bị nút khóa hãm lực tức thì giúp điều khiển hướng đi của cún dễ dàng. Tay cầm bọc cao su chống trượt tạo cảm giác êm ái.',
      brand: 'FlexiPet',
      unit: 'Cái',
      specifications: {
        'Chiều dài dây': '3m (Cho cún < 12kg), 5m (Cho cún < 25kg)',
        'Chất liệu': 'Dây nylon dệt mật độ cao + Vỏ nhựa ABS + Móc khóa hợp kim chống gỉ',
        'Màu sắc': 'Đen Tuyền, Xanh Mint',
      },
      variants: [
        { name: 'Dài 3m - Đen Tuyền', sellingPrice: 110000, salePrice: 99000, stock: 25, attributes: { length: '3m', color: 'Đen Tuyền' } },
        { name: 'Dài 5m - Xanh Mint', sellingPrice: 150000, salePrice: 135000, stock: 20, attributes: { length: '5m', color: 'Xanh Mint' } },
      ],
    },
    {
      id: '151763',
      name: 'Cát Vệ Sinh Bentonite Cho Mèo Hương Táo Kwik Cat (10L / 8kg)',
      description: 'Cát vệ sinh Bentonite đất sét tự nhiên vón cục siêu nhanh, không bụi 99%, lưu hương táo thơm mát kéo dài và kiểm soát mùi hôi khay cát vượt trội.',
      brand: 'Kwik Cat',
      unit: 'Túi',
      specifications: {
        'Thể tích / Trọng lượng': '10 Lít (Tương đương ~ 8kg)',
        'Mùi hương': 'Hương Táo Tây, Hương Lavender',
        'Tính năng': 'Vón cục nhanh trong 3 giây, hút ẩm 350%, bụi thấp',
        'Xuất xứ': 'Thổ Nhĩ Kỳ',
      },
      variants: [
        { name: 'Hương Táo (10L)', sellingPrice: 115000, salePrice: 105000, stock: 50, attributes: { scent: 'Táo' } },
        { name: 'Hương Lavender (10L)', sellingPrice: 115000, salePrice: 105000, stock: 40, attributes: { scent: 'Lavender' } },
      ],
    },
    {
      id: '670253',
      name: 'Bát Ăn Inox Đôi Đế Cao Su Chống Trượt Cho Chó Mèo',
      description: 'Bát ăn inox 304 sáng bóng không gỉ, thiết kế lòng sâu vừa phải kèm vòng cao su chống trượt ở đế giúp bát không bị xê dịch hay đổ thức ăn khi chó mèo ăn uống.',
      brand: 'PetKitchen',
      unit: 'Cái',
      specifications: {
        'Kích thước đường kính': '15cm (Size S - 300ml), 22cm (Size M - 700ml), 26cm (Size L - 1200ml)',
        'Chất liệu': 'Inox 304 cao cấp + Đế cao su thiên nhiên',
        'Đặc tính': 'Dễ rửa sạch, dùng được cho máy rửa bát',
      },
      variants: [
        { name: 'Size S (15cm - 300ml)', sellingPrice: 45000, salePrice: null, stock: 35, attributes: { size: 'S' } },
        { name: 'Size M (22cm - 700ml)', sellingPrice: 70000, salePrice: 65000, stock: 30, attributes: { size: 'M' } },
        { name: 'Size L (26cm - 1200ml)', sellingPrice: 95000, salePrice: 89000, stock: 20, attributes: { size: 'L' } },
      ],
    },
    {
      id: '751142',
      name: 'Áo Hoodie Nỉ Bông Thu Đông Cho Chó Mèo',
      description: 'Áo hoodie chất liệu vải nỉ bông mềm mại, dày dặn giữ ấm cơ thể mùa lạnh. Thiết kế có mũ thời trang, cúc bấm hoặc bo thun bụng giúp thú cưng vận động thoải mái.',
      brand: 'PetFashion',
      unit: 'Cái',
      specifications: {
        'Vòng ngực & Chiều dài lưng': 'Size S (Ngực 32cm, Lưng 20cm), Size M (Ngực 37cm, Lưng 25cm), Size L (Ngực 42cm, Lưng 30cm)',
        'Chất liệu': 'Vải nỉ cotton co giãn 4 chiều',
        'Màu sắc': 'Đỏ Đô, Vàng Mù Tạt',
      },
      variants: [
        { name: 'Size S - Màu Đỏ', sellingPrice: 150000, salePrice: 135000, stock: 20, attributes: { size: 'S', color: 'Đỏ' } },
        { name: 'Size M - Màu Đỏ', sellingPrice: 160000, salePrice: 145000, stock: 15, attributes: { size: 'M', color: 'Đỏ' } },
        { name: 'Size L - Màu Đỏ', sellingPrice: 170000, salePrice: 155000, stock: 10, attributes: { size: 'L', color: 'Đỏ' } },
        { name: 'Size S - Màu Vàng', sellingPrice: 150000, salePrice: 135000, stock: 25, attributes: { size: 'S', color: 'Vàng' } },
        { name: 'Size M - Màu Vàng', sellingPrice: 160000, salePrice: 145000, stock: 18, attributes: { size: 'M', color: 'Vàng' } },
        { name: 'Size L - Màu Vàng', sellingPrice: 170000, salePrice: 155000, stock: 8, attributes: { size: 'L', color: 'Vàng' } },
      ],
    },
    {
      id: '829731',
      name: 'Pate Thơm Ngon Cho Mèo Vị Gà & Cá Hồi CIAO',
      description: 'Pate CIAO lon 80g kết hợp từ thịt gà xé tươi và cá hồi nauy giàu Omega 3. Kết cấu pate mịn mượt cung cấp độ ẩm dồi dào, ngừa sỏi thận cho mèo ít uống nước.',
      brand: 'CIAO',
      unit: 'Lon',
      specifications: {
        'Trọng lượng lon': 'Lon 80g / Hộp 12 lon',
        'Thành phần': 'Thịt gà (45%), Cá hồi (30%), Nước dùng, Vitamin E, Taurine',
        'Xuất xứ': 'Nhật Bản',
      },
      variants: [
        { name: 'Lon Đơn 80g', sellingPrice: 22000, salePrice: 19000, stock: 100, attributes: { pack: 'Lon Đơn 80g' } },
        { name: 'Lốc 6 Lon (80g/lon)', sellingPrice: 125000, salePrice: 110000, stock: 30, attributes: { pack: 'Lốc 6 Lon' } },
      ],
    },
    {
      id: '128222',
      name: 'Lược Chải Lông Tự Động Kèm Nút Bấm Đẩy Lông Rụng',
      description: 'Lược chải lông thú cưng thông minh tích hợp nút bấm đẩy gạt lông rụng nhanh chóng chỉ với 1 nhấn. Đầu răng lược bọc hạt massage tròn không gây trầy xước da bé.',
      brand: 'PetClean',
      unit: 'Cái',
      specifications: {
        'Kích thước': 'Size S (Mặt chải 8cm - Cho cún mèo nhỏ), Size M (Mặt chải 11cm - Cho cún mèo vừa & lớn)',
        'Chất liệu': 'Răng kim loại không gỉ bọc hạt nhựa + Thân nhựa cao cấp',
        'Màu sắc': 'Xanh Mint, Hồng Phấn',
      },
      variants: [
        { name: 'Size S - Xanh Mint', sellingPrice: 95000, salePrice: 85000, stock: 30, attributes: { size: 'S', color: 'Xanh Mint' } },
        { name: 'Size M - Xanh Mint', sellingPrice: 120000, salePrice: 105000, stock: 25, attributes: { size: 'M', color: 'Xanh Mint' } },
      ],
    },
    {
      id: '654887',
      name: 'Vòng Cổ Chuông Đêm Phản Quang Cho Chó Mèo',
      description: 'Vòng cổ bằng vải dệt dạ quang phản quang ban đêm an toàn, kèm chuông đồng leng keng giúp bạn dễ dàng xác định vị trí của thú cưng trong nhà.',
      brand: 'PetStyle',
      unit: 'Cái',
      specifications: {
        'Vòng cổ điều chỉnh': 'Từ 19cm đến 32cm (Phù hợp chó mèo từ 1kg đến 8kg)',
        'Chất liệu': 'Vải dệt Nylon dạ quang + Khóa nhựa cài an toàn',
        'Màu sắc': 'Đỏ, Xanh Phản Quang',
      },
      variants: [
        { name: 'Màu Đỏ Phản Quang', sellingPrice: 25000, salePrice: null, stock: 50, attributes: { color: 'Đỏ' } },
        { name: 'Màu Xanh Phản Quang', sellingPrice: 25000, salePrice: null, stock: 50, attributes: { color: 'Xanh' } },
      ],
    },
    {
      id: '990935',
      name: 'Balo Phi Hành Gia Trong Suốt Vận Chuyển Chó Mèo',
      description: 'Balo phi hành gia mặt kính trong suốt thông thoáng với 9 lỗ khí đối lưu. Thiết kế chống thấm nước, quai đeo đệm vai trợ lực êm ái giúp bạn dễ dàng đưa bé cưng đi chơi, đi tiêm phòng.',
      brand: 'PetTravel',
      unit: 'Cái',
      specifications: {
        'Kích thước': '33cm x 28cm x 42cm (Dài x Rộng x Cao)',
        'Tải trọng tối đa': 'Mèo dưới 7kg, Chó nhỏ dưới 5kg',
        'Chất liệu': 'Nhựa PC trong suốt cao cấp + Vải Oxford chống nước',
        'Trọng lượng balo': '1.2kg',
      },
      variants: [
        { name: 'Màu Đen Phi Hành Gia', sellingPrice: 240000, salePrice: 219000, stock: 20, attributes: { color: 'Đen' } },
        { name: 'Màu Hồng Phi Hành Gia', sellingPrice: 240000, salePrice: 219000, stock: 15, attributes: { color: 'Hồng' } },
      ],
    },
  ];

  for (const item of updates) {
    const slug = slugify(item.name) + '-' + item.id;
    
    // Update Product main fields
    await prisma.product.update({
      where: { id: item.id },
      data: {
        name: item.name,
        slug: slug,
        description: item.description,
        brand: item.brand,
        unit: item.unit,
        specifications: item.specifications,
        sellingPrice: item.variants[0]?.sellingPrice || 100000,
        salePrice: item.variants[0]?.salePrice || null,
      },
    });

    // Delete existing variants that are not referenced in OrderItem/CartItem if any, or safely handle variants
    // First let's check existing variants for this product
    const existingVariants = await prisma.productVariant.findMany({
      where: { productId: item.id },
    });

    // For safety, update existing variants or create new ones
    for (let i = 0; i < item.variants.length; i++) {
      const vData = item.variants[i];
      if (existingVariants[i]) {
        // Update existing variant
        await prisma.productVariant.update({
          where: { id: existingVariants[i].id },
          data: {
            name: vData.name,
            sellingPrice: vData.sellingPrice,
            salePrice: vData.salePrice,
            stock: vData.stock,
            attributes: vData.attributes,
          },
        });
      } else {
        // Create new variant
        await prisma.productVariant.create({
          data: {
            productId: item.id,
            name: vData.name,
            sellingPrice: vData.sellingPrice,
            salePrice: vData.salePrice,
            stock: vData.stock,
            attributes: vData.attributes,
          },
        });
      }
    }

    // If there were more existing variants than new variants, clean up extra unused ones safely
    if (existingVariants.length > item.variants.length) {
      const extraVariants = existingVariants.slice(item.variants.length);
      for (const extraV of extraVariants) {
        // Check if used in cart or order
        const inOrder = await prisma.orderItem.count({ where: { variantId: extraV.id } });
        const inCart = await prisma.cartItem.count({ where: { variantId: extraV.id } });
        if (inOrder === 0 && inCart === 0) {
          await prisma.productVariant.delete({ where: { id: extraV.id } });
        }
      }
    }

    console.log(`✅ Đã cập nhật xong sản phẩm ID ${item.id}: "${item.name}" (${item.variants.length} variants)`);
  }

  console.log('🎉 Hoàn tất cập nhật 100% sản phẩm và variant với tiếng Việt có dấu chuẩn đẹp!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi cập nhật sản phẩm:', e);
  })
  .finally(() => prisma.$disconnect());
