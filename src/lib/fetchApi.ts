'use client';

export async function fetchApi<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await res.json();

  if (!json.success && res.status === 401) {
    window.location.href = '/login';
  }

  return json;
}
