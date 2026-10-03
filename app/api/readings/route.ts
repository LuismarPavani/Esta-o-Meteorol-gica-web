import { NextRequest, NextResponse } from 'next/server';
import { canAccessDevice, forbidden, getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);

// ESP8266 envia a leitura (autenticado por x-device-key)
export async function POST(req: NextRequest) {
  if (req.headers.get('x-device-key') !== process.env.DEVICE_KEY)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const temperature = num(b?.temperature), humidity = num(b?.humidity);
  const id = typeof b?.device_id === 'string' ? b.device_id.trim() : '';
  if (!id || id.length > 64 || temperature === null || humidity === null)
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  // Cidade (código da OpenWeatherMap, ex.: 3463011); aceita número ou texto numérico
  const cid = Number(b.city_id);
  const cityId = Number.isInteger(cid) && cid > 0 ? cid : null;
  const cityName = typeof b.city_name === 'string' && b.city_name.trim() ? b.city_name.trim().slice(0, 80) : null;

  const fields = {
    ip: b.ip ?? null, rssi: num(b.rssi), battery: num(b.battery),
    battery_voltage: num(b.battery_voltage),
    battery_active: typeof b.battery_active === 'boolean' ? b.battery_active : num(b.battery) !== null,
    firmware: b.firmware ?? null, last_temperature: temperature,
    last_humidity: humidity, last_seen: new Date().toISOString(),
    ...(cityId ? { city_id: cityId, city_name: cityName } : {}),
  };

  // Atualiza o ESP; se o ID ainda não existe, cadastra automaticamente (sem dono, nome e descrição em branco)
  const { data: dev, error: e1 } = await supabase.from('devices').update(fields).eq('id', id).select('id');
  if (e1) return NextResponse.json({ error: 'db error' }, { status: 500 });
  if (!dev?.length) {
    const { error: e3 } = await supabase.from('devices').insert({ id, name: '', description: null, ...fields });
    if (e3) return NextResponse.json({ error: 'db error' }, { status: 500 });
  }

  const { error: e2 } = await supabase.from('readings')
    .insert({ device_id: id, temperature, humidity, city_id: cityId, city_name: cityName });
  if (e2) return NextResponse.json({ error: 'db error' }, { status: 500 });

  if (cityId)
    await supabase.from('device_cities').upsert(
      { device_id: id, city_id: cityId, city_name: cityName, last_seen: fields.last_seen },
      { onConflict: 'device_id,city_id' });
  return NextResponse.json({ ok: true });
}

// Painel consulta as leituras de um ESP (e, opcionalmente, de uma cidade)
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const device = req.nextUrl.searchParams.get('device');
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 });
  if (!(await canAccessDevice(u, device))) return forbidden();
  const city = Number(req.nextUrl.searchParams.get('city')) || null;
  const hours = Math.min(Number(req.nextUrl.searchParams.get('hours')) || 24, 720);
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  // O Supabase limita 1000 linhas por consulta; pagina até acabar (30 dias ≈ 1440 linhas)
  const rows: unknown[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    let q = supabase.from('readings').select('created_at, temperature, humidity')
      .eq('device_id', device).gte('created_at', since);
    if (city) q = q.eq('city_id', city);
    const { data, error } = await q.order('created_at').range(from, from + 999);
    if (error) return NextResponse.json({ error: 'db error' }, { status: 500 });
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return NextResponse.json(rows);
}
