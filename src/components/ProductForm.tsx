'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductFormProps {
  initialData?: {
    title: string;
    description: string;
    imageUrl: string;
    startingPrice: number;
  };
  productId?: string;
}

export default function ProductForm({ initialData, productId }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!productId;

  const [form, setForm] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    imageUrl: initialData?.imageUrl || '',
    startingPrice: initialData?.startingPrice || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          startingPrice: Number(form.startingPrice),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to save product');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          maxLength={120}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          required
          maxLength={2000}
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
          Image URL
        </label>
        <input
          id="imageUrl"
          type="url"
          required
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          placeholder="https://example.com/image.jpg"
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label htmlFor="startingPrice" className="block text-sm font-medium text-gray-700 mb-1">
          Starting Price ($)
        </label>
        <input
          id="startingPrice"
          type="number"
          required
          min="0.01"
          step="0.01"
          value={form.startingPrice}
          onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-medium py-2 rounded transition disabled:opacity-50"
      >
        {loading
          ? isEdit
            ? 'Updating...'
            : 'Creating...'
          : isEdit
          ? 'Update Product'
          : 'Create Product'}
      </button>
    </form>
  );
}
