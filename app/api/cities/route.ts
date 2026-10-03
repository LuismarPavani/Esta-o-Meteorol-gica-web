import { NextRequest, NextResponse } from 'next/server';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 });
  if (!(await canAccessDevice(u, device))) return forbidden();
  const { data, error } = await supabase.from('device_cities')
    .select('city_id, city_name').eq('device_id', device).order('last_seen', { ascending: false });
  if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
  return NextResponse.json(data);
}
