import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Admin vê todos os ESPs; usuário normal vê só os que o admin liberou para ele
export async function GET() {
  const u = await getUser();
  if (!u) return unauthorized();
  let q = supabase.from('devices').select('*').order('name');
  if (u.role !== 'admin') {
    const { data: links } = await supabase.from('user_devices').select('device_id').eq('user_id', u.id);
    const ids = links?.map(l => l.device_id) ?? [];
    if (!ids.length) return NextResponse.json([]);
    q = q.in('id', ids);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(data);
}

// Só admin cadastra ESPs
export async function POST(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  if (u.role !== 'admin') return forbidden();
  const { id, name, description } = await req.json();
  const did = String(id ?? '').trim();
  if (!did) return NextResponse.json({ error: 'Informe o ID.' }, { status: 400 });
  const { error } = await supabase.from('devices')
    .insert({ id: did, name: name?.trim() || '', description: description?.trim() || null });
  if (error) return NextResponse.json(
    { error: error.code === '23505' ? 'Esse ID já existe. Edite-o na lista abaixo.' : 'Erro ao salvar.' },
    { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
