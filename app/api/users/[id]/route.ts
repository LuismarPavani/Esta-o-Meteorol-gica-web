import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { forbidden, getUser, isRootUser, setUserDevices, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };
const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const me = await getUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  const { id } = await params;
  const b = await req.json();
  const { data: target } = await supabase.from('users').select('username').eq('id', id).maybeSingle();
  if (!target) return err('Usuário não encontrado.', 404);
  const root = isRootUser(target.username);

  const upd: Record<string, unknown> = {};
  if (b.role) {
    if ((id === me.id || root) && b.role !== 'admin') return err('Este usuário precisa continuar como admin.');
    upd.role = b.role === 'admin' ? 'admin' : 'user';
  }
  if (typeof b.owm_key === 'string') upd.owm_key = b.owm_key.trim() || null;
  if (b.password) {
    if (root) return err('A senha do usuário principal é a variável ADMIN_PASSWORD no Vercel.');
    if (String(b.password).length < 6) return err('A senha precisa ter 6 ou mais caracteres.');
    upd.password_hash = hashPassword(String(b.password));
  }
  if (Object.keys(upd).length) await supabase.from('users').update(upd).eq('id', id);
  if (Array.isArray(b.device_ids)) await setUserDevices(id, b.device_ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const me = await getUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  const { id } = await params;
  const { data: target } = await supabase.from('users').select('username').eq('id', id).maybeSingle();
  if (id === me.id || (target && isRootUser(target.username))) return err('Este usuário não pode ser excluído.');
  await supabase.from('users').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
