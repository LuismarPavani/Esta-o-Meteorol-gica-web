import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { forbidden, getUser, isRootUser, setUserDevices, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getUser();
  if (!u) return unauthorized();
  if (u.role !== 'admin') return forbidden();
  const [users, links] = await Promise.all([
    supabase.from('users').select('id, username, role, owm_key, created_at').order('username'),
    supabase.from('user_devices').select('user_id, device_id'),
  ]);
  if (users.error || links.error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(users.data.map(({ owm_key, ...x }) => ({
    ...x, has_owm_key: !!owm_key, is_root: isRootUser(x.username),
    device_ids: links.data.filter(l => l.user_id === x.id).map(l => l.device_id),
  })));
}

export async function POST(req: NextRequest) {
  const me = await getUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  const b = await req.json();
  const username = String(b.username ?? '').trim().toLowerCase();
  const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return err('Usuário: 3 a 32 caracteres (letras, números, ponto, hífen ou _).');
  if (String(b.password ?? '').length < 6) return err('A senha precisa ter 6 ou mais caracteres.');
  const { data, error } = await supabase.from('users').insert({
    username, password_hash: hashPassword(String(b.password)),
    role: b.role === 'admin' ? 'admin' : 'user',
    owm_key: String(b.owm_key ?? '').trim() || null,
  }).select('id').single();
  if (error) return err(error.code === '23505' ? 'Esse usuário já existe.' : 'Erro ao salvar.', error.code === '23505' ? 409 : 500);
  if (b.role !== 'admin') await setUserDevices(data.id, b.device_ids);
  return NextResponse.json({ ok: true });
}
