import { NextRequest, NextResponse } from 'next/server';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Ctx = { params: Promise<{ id: string }> };

// Quem tem acesso ao ESP pode editar nome e descrição
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const u = await getUser();
  if (!u) return unauthorized();
  const { id } = await params;
  if (!(await canAccessDevice(u, id))) return forbidden();
  const { name, description } = await req.json();
  const { error } = await supabase.from('devices')
    .update({ name: name?.trim() || '', description: description?.trim() || null }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Só admin exclui
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const u = await getUser();
  if (!u) return unauthorized();
  if (u.role !== 'admin') return forbidden();
  const { id } = await params;
  const { error } = await supabase.from('devices').delete().eq('id', id); // apaga leituras, cidades e acessos junto
  if (error) return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
