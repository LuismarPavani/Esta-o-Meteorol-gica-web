import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getUser();
  if (!u) return unauthorized();
  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  return NextResponse.json({ ...u, has_owm_key: !!data?.owm_key });
}

// O próprio usuário troca a chave da OpenWeatherMap e/ou a senha
export async function PATCH(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const b = await req.json();
  const upd: Record<string, unknown> = {};
  if ('owm_key' in b) upd.owm_key = String(b.owm_key ?? '').trim() || null;
  if (b.password) {
    if (String(b.password).length < 6) return NextResponse.json({ error: 'A senha precisa ter 6 ou mais caracteres.' }, { status: 400 });
    upd.password_hash = hashPassword(String(b.password));
  }
  if (Object.keys(upd).length) await supabase.from('users').update(upd).eq('id', u.id);
  return NextResponse.json({ ok: true });
}
