import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, verifySession } from './auth';
import { supabase } from './supabase';

export type User = { id: string; username: string; role: 'admin' | 'user' };

// Lê o usuário no banco a cada requisição: mudar o tipo ou excluir vale na hora
export async function getUser(): Promise<User | null> {
  const s = await verifySession((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const { data } = await supabase.from('users').select('id, username, role').eq('id', s.uid).maybeSingle();
  return (data as User | null) ?? null;
}

export async function canAccessDevice(u: User, deviceId: string) {
  if (u.role === 'admin') return true;
  const { data } = await supabase.from('user_devices').select('device_id')
    .eq('user_id', u.id).eq('device_id', deviceId).maybeSingle();
  return !!data;
}

// Substitui a lista de dispositivos que o usuário pode ver
export async function setUserDevices(userId: string, ids: unknown) {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  await supabase.from('user_devices').delete().eq('user_id', userId);
  if (list.length)
    await supabase.from('user_devices').insert(list.map(device_id => ({ user_id: userId, device_id })));
}

// Usuário principal: o ADMIN_USER do .env / variáveis do Vercel
export const isRootUser = (username: string) =>
  username === process.env.ADMIN_USER?.trim().toLowerCase();

export const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: 'forbidden' }, { status: 403 });
