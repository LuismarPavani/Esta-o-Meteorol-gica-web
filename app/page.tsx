'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import TopBar from '@/components/TopBar';
import Battery from '@/components/Battery';
import { Device, isOnline, timeAgo, wifiPct } from '@/lib/format';

type Reading = { created_at: string; temperature: number; humidity: number };
type City = { city_id: number; city_name: string | null };
type Weather = {
  name: string; description: string; icon: string; temp: number; feels_like: number;
  humidity: number; pressure: number; wind_kmh: number | null;
  sunrise: number; sunset: number; dt: number; timezone: number;
};
type Day = { date: string; min: number; max: number; pop: number; icon: string; description: string };
const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const PERIODS = [{ h: 24, l: '24 horas' }, { h: 168, l: '7 dias' }, { h: 720, l: '30 dias' }];
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hm = (sec: number, tz: number) => new Date((sec + tz) * 1000).toISOString().slice(11, 16); // hora local da cidade

export default function Dashboard() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [sel, setSel] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<number | null>(null);
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<Reading[]>([]);
  const [wx, setWx] = useState<{ data?: Weather; error?: string } | null>(null);
  const [fx, setFx] = useState<{ data?: Day[]; error?: string } | null>(null);

  const loadDevices = useCallback(async () => {
    const r = await fetch('/api/devices');
    if (r.status === 401) { router.push('/login'); return; }
    const d: Device[] = await r.json();
    setDevices(d);
    setSel(s => {
      if (d.some(x => x.id === s)) return s;
      let saved: string | null = null; // primeira carga: usa o último ESP escolhido neste navegador
      try { saved = localStorage.getItem('lastDevice'); } catch { /* sem armazenamento */ }
      return d.find(x => x.id === saved)?.id ?? d[0]?.id ?? '';
    });
  }, [router]);

  const selectCity = (id: number) => {
    setCity(id);
    try { localStorage.setItem(`lastCity:${sel}`, String(id)); } catch { /* sem armazenamento */ }
  };

  const selectDevice = (id: string) => {
    setSel(id);
    try { localStorage.setItem('lastDevice', id); } catch { /* sem armazenamento */ }
  };
  useEffect(() => { loadDevices(); const t = setInterval(loadDevices, 60000); return () => clearInterval(t); }, [loadDevices]);

  // Cidades que o ESP selecionado já enviou
  useEffect(() => {
    if (!sel) return;
    setCities([]); setCity(null);
    fetch(`/api/cities?device=${encodeURIComponent(sel)}`).then(r => r.json()).then((c: City[]) => {
      if (!Array.isArray(c)) return;
      setCities(c);
      let saved: number | null = null; // última cidade escolhida para este ESP neste navegador
      try { saved = Number(localStorage.getItem(`lastCity:${sel}`)) || null; } catch { /* sem armazenamento */ }
      const last = devices?.find(d => d.id === sel)?.city_id;
      setCity(c.find(x => x.city_id === saved)?.city_id ?? c.find(x => x.city_id === last)?.city_id ?? c[0]?.city_id ?? null);
    });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sel) return;
    const q = `device=${encodeURIComponent(sel)}&hours=${hours}${city ? `&city=${city}` : ''}`;
    fetch(`/api/readings?${q}`).then(r => r.json()).then(r => setData(Array.isArray(r) ? r : []));
  }, [sel, hours, city, devices]);

  // Clima da cidade pela OpenWeatherMap (chave do usuário logado)
  useEffect(() => {
    if (city === null) { setWx(null); return; }
    let alive = true;
    const load = () => fetch(`/api/weather?city=${city}`).then(async r => {
      const j = await r.json(); if (alive) setWx(r.ok ? { data: j } : { error: j.error });
    });
    load(); const t = setInterval(load, 600000);
    return () => { alive = false; clearInterval(t); };
  }, [city]);

  // Previsão dos próximos dias (a OpenWeatherMap atualiza a cada 3 horas)
  useEffect(() => {
    if (city === null) { setFx(null); return; }
    let alive = true;
    const load = () => fetch(`/api/forecast?city=${city}`).then(async r => {
      const j = await r.json(); if (alive) setFx(r.ok ? { data: j } : { error: j.error });
    });
    load(); const t = setInterval(load, 1800000);
    return () => { alive = false; clearInterval(t); };
  }, [city]);

  const dev = devices?.find(d => d.id === sel);
  const chart = data.map(p => ({ t: fmt(p.created_at), temperature: p.temperature, humidity: p.humidity }));
  const w = wx?.data;
  const cityName = cities.find(c => c.city_id === city)?.city_name || w?.name || (city ? `Cidade ${city}` : '');

  return (
    <main>
      <TopBar />
      {devices === null && <p className="muted">Carregando…</p>}
      {devices?.length === 0 && (
        <p className="panel">Nenhum ESP disponível para você. Peça a um administrador para liberar um dispositivo em <b>Usuários</b>.
          Se você é admin, o ESP aparece em <Link href="/devices"><u>Dispositivos</u></Link> assim que enviar a primeira leitura.</p>
      )}
      {dev && (
        <>
          <div className="picker">
            <select value={sel} onChange={e => selectDevice(e.target.value)} aria-label="Dispositivo">
              {devices!.map(d => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
            </select>
            {cities.length > 0 && (
              <select value={city ?? ''} onChange={e => selectCity(Number(e.target.value))} aria-label="Cidade">
                {cities.map(c => <option key={c.city_id} value={c.city_id}>{c.city_name || `Cidade ${c.city_id}`}</option>)}
              </select>
            )}
            <span className="muted">{dev.description}</span>
            <span className="small"><span className={`dot ${isOnline(dev.last_seen) ? 'on' : ''}`} />
              {isOnline(dev.last_seen) ? 'Online' : 'Offline'}, visto {timeAgo(dev.last_seen)}</span>
          </div>

          {w ? (
            <section className={`hero ${w.icon.endsWith('n') ? 'night' : ''}`}>
              <div>
                <div className="eyebrow">Tempo agora</div>
                <div className="hero-city">{cityName}</div>
                <div className="hero-temp">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://openweathermap.org/img/wn/${w.icon}@2x.png`} alt="" />
                  {Math.round(w.temp)}<small>°C</small>
                </div>
                <div className="hero-desc">{w.description}, sensação de {Math.round(w.feels_like)}°</div>
              </div>
              <div className="hero-stats">
                <div><span>Umidade</span><b>{w.humidity}%</b></div>
                <div><span>Vento</span><b>{w.wind_kmh ?? '--'} km/h</b></div>
                <div><span>Pressão</span><b>{w.pressure} hPa</b></div>
                <div><span>Sol</span><b>{hm(w.sunrise, w.timezone)} / {hm(w.sunset, w.timezone)}</b></div>
              </div>
              <div className="hero-foot">Atualizado às {hm(w.dt, w.timezone)} (hora local). Fonte: OpenWeatherMap.</div>
            </section>
          ) : (
            <section className="panel" style={{ marginTop: 18 }}>
              <div className="eyebrow muted">Tempo na cidade</div>
              {city === null && <p className="muted" style={{ margin: '6px 0 0' }}>Este ESP ainda não enviou o código da cidade (city_id).</p>}
              {city !== null && !wx && <p className="muted" style={{ margin: '6px 0 0' }}>Consultando a OpenWeatherMap…</p>}
              {wx?.error === 'no_key' && <p style={{ margin: '6px 0 0' }}>Cadastre sua chave da OpenWeatherMap em <Link href="/account"><u>Minha conta</u></Link> para ver o tempo da cidade.</p>}
              {wx?.error === 'invalid_key' && <p className="error">A OpenWeatherMap recusou a chave. Confira em <Link href="/account"><u>Minha conta</u></Link>; chaves novas podem levar um tempo para ativar.</p>}
              {wx?.error === 'owm_error' && <p className="error">Não foi possível consultar a OpenWeatherMap agora.</p>}
            </section>
          )}

          {fx?.data && fx.data.length > 0 && (
            <>
              <h2>Próximos dias{city ? ` em ${cityName}` : ''}</h2>
              <section className="forecast">
                {fx.data.map(d => (
                  <div className="tile fc" key={d.date}>
                    <div className="dow">{dayLabel(d.date)}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`} alt="" />
                    <div className="temps"><span className="max">{Math.round(d.max)}°</span> <span className="min">{Math.round(d.min)}°</span></div>
                    <div className="desc">{d.description}</div>
                    <div className="rain">Chuva {d.pop}%</div>
                  </div>
                ))}
              </section>
            </>
          )}

          <h2>Sensor do ESP</h2>
          <section className="tiles">
            <div className="tile" style={{ ['--tc' as string]: 'var(--temp)' }}>
              <div className="label">Temperatura</div>
              <div className="value" style={{ color: 'var(--temp)' }}>
                {dev.last_temperature !== null ? <>{dev.last_temperature.toFixed(1)}<small> °C</small></> : '--'}
              </div>
            </div>
            <div className="tile" style={{ ['--tc' as string]: 'var(--hum)' }}>
              <div className="label">Umidade</div>
              <div className="value" style={{ color: 'var(--hum)' }}>
                {dev.last_humidity !== null ? <>{dev.last_humidity.toFixed(1)}<small> %</small></> : '--'}
              </div>
            </div>
            <div className="tile">
              <div className="label">Sinal Wi-Fi</div>
              <div className="value">{dev.rssi !== null ? <>{wifiPct(dev.rssi)}<small> %</small></> : '--'}</div>
              <div className="sub">{dev.rssi !== null ? `${dev.rssi} dBm` : 'Sem dados'}</div>
            </div>
            <div className="tile" style={{ ['--tc' as string]: 'var(--ok)' }}>
              <div className="label">Bateria</div>
              <Battery device={dev} />
            </div>
          </section>

          <h2>Histórico{city ? ` em ${cityName}` : ''}</h2>
          <section className="panel">
            <div className="seg" role="group" aria-label="Período">
              {PERIODS.map(p => (
                <button key={p.h} className={hours === p.h ? 'on' : ''} onClick={() => setHours(p.h)}>{p.l}</button>
              ))}
            </div>
            <div className="chart">
              {chart.length === 0 ? <p className="muted">Ainda não há leituras neste período.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" interval="preserveStartEnd" minTickGap={48} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="t" unit="°" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <YAxis yAxisId="h" orientation="right" unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)} contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }} />
                    <Legend />
                    <Line yAxisId="t" dataKey="temperature" name="Temperatura (°C)" stroke="var(--temp)" dot={false} strokeWidth={2.2} />
                    <Line yAxisId="h" dataKey="humidity" name="Umidade (%)" stroke="var(--hum)" dot={false} strokeWidth={2.2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <h2>Dispositivo</h2>
          <section className="panel">
            <dl className="info">
              <div><dt>ID</dt><dd className="mono">{dev.id}</dd></div>
              <div><dt>Endereço IP</dt><dd className="mono">{dev.ip ?? '--'}</dd></div>
              <div><dt>Firmware</dt><dd className="mono">{dev.firmware ?? '--'}</dd></div>
              <div><dt>Cidade (código OpenWeatherMap)</dt><dd>{dev.city_name ? `${dev.city_name} (${dev.city_id})` : dev.city_id ?? '--'}</dd></div>
              <div><dt>Última leitura</dt><dd>{dev.last_seen ? fmt(dev.last_seen) : '--'}</dd></div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}
