import { NextResponse } from 'next/server';

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function handleValidationError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error) {
    const err = error as { name: string; errors?: Record<string, { message: string }> };
    if (err.name === 'ValidationError' && err.errors) {
      const messages = Object.values(err.errors).map((e) => e.message);
      return errorResponse(messages.join('. '), 400);
    }
  }
  const message = error instanceof Error ? error.message : 'Internal server error';
  return errorResponse(message, 500);
}
