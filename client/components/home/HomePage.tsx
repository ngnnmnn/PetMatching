'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/login');
      return;
    }
    
    setUser(JSON.parse(userData));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🏠 Home Page</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.avatarUrl && (
                <img 
                  src={user.avatarUrl} 
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <span className="font-medium text-gray-700">👤 {user.name}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
              user.role === 'MODERATOR' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {user.role}
            </span>
            {user.isVerified && (
              <span className="text-blue-500 text-sm">✅ Verified</span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chào mừng bạn đến với Home Page!
          </h2>
          <p className="text-gray-600 mb-6">Đây là trang chủ của ứng dụng PetMatching.</p>
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="text-gray-700"><strong>ID:</strong> {user.id}</p>
            <p className="text-gray-700"><strong>Email:</strong> {user.email}</p>
            <p className="text-gray-700"><strong>Name:</strong> {user.name}</p>
            <p className="text-gray-700"><strong>Role:</strong> {user.role}</p>
            <p className="text-gray-700"><strong>Phone:</strong> {user.phone || 'Chưa cập nhật'}</p>
            <p className="text-gray-700"><strong>Verified:</strong> {user.isVerified ? '✅ Có' : '❌ Chưa'}</p>
          </div>
        </div>

        {/* Role-specific content */}
        <div className="bg-white rounded-xl shadow-md p-8">
          {user.role === 'ADMIN' && (
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">🔧 Admin Panel</h3>
              <p className="text-gray-600 mb-4">Bạn có quyền quản trị viên!</p>
              <div className="flex gap-3 flex-wrap">
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                  Quản lý người dùng
                </button>
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                  Quản lý pet
                </button>
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                  Duyệt giấy tờ
                </button>
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                  Báo cáo
                </button>
              </div>
            </div>
          )}
          
          {user.role === 'MODERATOR' && (
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">📋 Moderator Panel</h3>
              <p className="text-gray-600 mb-4">Bạn có quyền kiểm duyệt!</p>
              <div className="flex gap-3 flex-wrap">
                <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                  Duyệt giấy tờ
                </button>
                <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                  Kiểm tra báo cáo
                </button>
              </div>
            </div>
          )}
          
          {user.role === 'USER' && (
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">👤 User Panel</h3>
              <p className="text-gray-600 mb-4">Bạn có quyền người dùng thông thường!</p>
              <div className="flex gap-3 flex-wrap">
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                  Quản lý pet
                </button>
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                  Tìm kiếm bạn đồng hành
                </button>
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                  Cập nhật hồ sơ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}