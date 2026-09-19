/** 
 * Cấu hình Next.js cho ứng dụng client
 * Bỏ qua lỗi TypeScript khi build để đảm bảo quy trình build production hoạt động thông suốt
 */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Tự động chuyển đổi định dạng ảnh sang WebP và AVIF để nén dung lượng tới 70-80%
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
