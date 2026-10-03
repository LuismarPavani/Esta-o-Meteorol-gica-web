import { NextRequest, NextResponse } from 'next/server';
import { getUser, unauthorized } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const FORECAST_DAYS = 4; // quantos dias à frente mostrar (a API gratuita cobre até 5)

// Previsão dos próximos dias: junta os blocos de 3 em 3 horas da OpenWeatherMap em um resumo por dia
export async function GET(req: NextRequest) {
  const u = await getUser();
  if (!u) return unauthorized();
  const city = Number(req.nextUrl.searchParams.get('city'));
  if (!Number.isInteger(city) || city <= 0) return NextResponse.json({ error: 'city required' }, { status: 400 });

  const { data } = await supabase.from('users').select('owm_key').eq('id', u.id).single();
  if (!data?.owm_key) return NextResponse.json({ error: 'no_key' }, { status: 400 });

  const r = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?id=${city}&units=metric&lang=pt_br&appid=${encodeURIComponent(data.owm_key)}`,
    { cache: 'no-store' });
  if (r.status === 401) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  if (!r.ok) return NextResponse.json({ error: 'owm_error' }, { status: 502 });

  const f = await r.json();
  const tz: number = f.city?.timezone ?? 0;
  const local = (sec: number) => new Date((sec + tz) * 1000).toISOString(); // hora local da cidade
  const today = local(Date.now() / 1000).slice(0, 10);

  type Acc = { min: number; max: number; pop: number; best: { diff: number; icon: string; description: string } };
  const byDay = new Map<string, Acc>();
  for (const it of f.list ?? []) {
    const iso = local(it.dt), date = iso.slice(0, 10);
    if (date <= today) continue;
    const diff = Math.abs(Number(iso.slice(11, 13)) - 13); // o bloco mais perto do início da tarde representa o dia
    const a = byDay.get(date) ?? { min: Infinity, max: -Infinity, pop: 0, best: { diff: 99, icon: '01d', description: '' } };
    a.min = Math.min(a.min, it.main?.temp_min ?? it.main?.temp);
    a.max = Math.max(a.max, it.main?.temp_max ?? it.main?.temp);
    a.pop = Math.max(a.pop, it.pop ?? 0);
    if (diff < a.best.diff) a.best = { diff, icon: it.weather?.[0]?.icon ?? '01d', description: it.weather?.[0]?.description ?? '' };
    byDay.set(date, a);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, FORECAST_DAYS)
    .map(([date, a]) => ({
      date, min: a.min, max: a.max, pop: Math.round(a.pop * 100),
      icon: a.best.icon.replace('n', 'd'), description: a.best.description,
    }));
  return NextResponse.json(days);
}
