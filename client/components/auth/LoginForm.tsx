'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/login', formData);
      
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        router.push('/home');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (username: string, password: string) => {
    setFormData({ username, password });
    setTimeout(() => {
      const form = document.getElementById('login-form') as HTMLFormElement;
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Đăng Nhập
        </h2>
        
        <form id="login-form" onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Tên đăng nhập
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              placeholder="Nhập tên đăng nhập"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              placeholder="Nhập mật khẩu"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-600">
          <p>
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-purple-600 font-semibold hover:underline">
              Đăng ký
            </Link>
          </p>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-center text-gray-600 text-sm mb-3">
            Demo Accounts:
          </h4>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => quickLogin('admin', '123')}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
            >
              Admin
            </button>
            <button
              onClick={() => quickLogin('manager', '123')}
              className="px-4 py-2 bg-yellow-400 text-gray-800 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition"
            >
              Manager
            </button>
            <button
              onClick={() => quickLogin('user1', '123')}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
            >
              User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}