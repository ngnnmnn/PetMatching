import * as XLSX from 'xlsx';
import * as path from 'path';

const data = [
  {
    'Mã sản phẩm': '128222',
    'Tên sản phẩm': 'Luoc chai long tu dong cho thu cung',
    'Danh mục': 'GROOMING',
    'Thương hiệu': 'FurCare',
    'Đơn vị tính': 'cái',
    'Giá nhập': 60000,
    'Giá bán': 135000,
    'Giá khuyến mãi': 109000,
    'Số lượng nhập': 10,
    'Loài mục tiêu': 'ALL',
    'Thông số kỹ thuật': 'Màu sắc: Hồng, Kích thước: Trung bình, Chất liệu: Nhựa & Thép',
    'Mô tả': 'Lược chải lông tự động cho chó mèo.'
  },
  {
    'Mã sản phẩm': '999999',
    'Tên sản phẩm': 'Sản phẩm thử nghiệm mới Excel',
    'Danh mục': 'ACCESSORY',
    'Thương hiệu': 'PetBrand',
    'Đơn vị tính': 'cái',
    'Giá nhập': 50000,
    'Giá bán': 100000,
    'Giá khuyến mãi': '',
    'Số lượng nhập': 20,
    'Loài mục tiêu': 'CAT',
    'Thông số kỹ thuật': 'Chất liệu: Cotton, Độ bền: Cao',
    'Mô tả': 'Sản phẩm test tạo mới hoàn toàn từ file Excel.'
  }
];

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sản phẩm nhập');

const destinationPath = path.join(__dirname, '../../client/public/import_template.xlsx');
XLSX.writeFile(workbook, destinationPath);
console.log('Successfully generated import_template.xlsx at client/public/');
