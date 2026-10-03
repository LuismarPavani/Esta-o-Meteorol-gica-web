import { NextResponse } from 'next/server';
import { COOKIE, createSession } from '@/lib/auth';
import { checkPassword, hashPassword } from '@/lib/password';
import { isRootUser } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const { user, password } = await req.json();
  const username = String(user ?? '').trim().toLowerCase();
  const bad = () => NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  if (!username || !password) return bad();

  let uid: string | null = null;

  // Usuário principal (ADMIN_USER / ADMIN_PASSWORD): sempre admin, criado ou restaurado no login.
  // Serve de acesso de emergência se alguém esquecer a senha.
  if (isRootUser(username) && password === process.env.ADMIN_PASSWORD) {
    const { data } = await supabase.from('users')
      .upsert({ username, password_hash: hashPassword(password), role: 'admin' }, { onConflict: 'username' })
      .select('id').single();
    uid = data?.id ?? null;
  } else {
    const { data } = await supabase.from('users').select('id, password_hash').eq('username', username).maybeSingle();
    if (data && checkPassword(String(password), data.password_hash)) uid = data.id;
  }
  if (!uid) return bad();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSession(uid), {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
