import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Clima atual da cidade, usando a chave da OpenWeatherMap do usuário logado (a chave nunca vai ao navegador)
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const city = Number(req.nextUrl.searchParams.get('city'));
  if (!Number.isInteger(city) || city <= 0) return NextResponse.json({ error: 'city required' }, { status: 400 });

  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  if (!data?.owm_key) return NextResponse.json({ error: 'no_key' }, { status: 400 });

  const r = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?id=${city}&units=metric&lang=pt_br&appid=${encodeURIComponent(data.owm_key)}`,
    { cache: 'no-store' });
  if (r.status === 401) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  if (!r.ok) return NextResponse.json({ error: 'owm_error' }, { status: 502 });

  const w = await r.json();
  return NextResponse.json({
    name: w.name, description: w.weather?.[0]?.description, icon: w.weather?.[0]?.icon,
    temp: w.main?.temp, feels_like: w.main?.feels_like, humidity: w.main?.humidity,
    pressure: w.main?.pressure, wind_kmh: w.wind?.speed != null ? Math.round(w.wind.speed * 3.6) : null,
    sunrise: w.sys?.sunrise, sunset: w.sys?.sunset, dt: w.dt, timezone: w.timezone ?? 0,
  });
}
