export type Device = {
  id: string; name: string; description: string | null;
  ip: string | null; rssi: number | null; firmware: string | null;
  battery: number | null; battery_voltage: number | null; battery_active: boolean | null;
  last_temperature: number | null; last_humidity: number | null; last_seen: string | null;
  city_id: number | null; city_name: string | null;
};

export const wifiPct = (rssi: number) => Math.max(0, Math.min(100, 2 * (rssi + 100)));

export function timeAgo(iso: string | null) {
  if (!iso) return 'nunca';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
}

// O ESP envia a cada 15 min: sem leitura há mais de 40 min (2 envios perdidos + folga) considera offline
export const SEND_INTERVAL_MIN = 15;
export const isOnline = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < (SEND_INTERVAL_MIN * 2 + 10) * 60000;

export function batteryInfo(d: Pick<Device, 'battery' | 'battery_voltage' | 'battery_active'>) {
  if (d.battery_active === null && d.battery === null)
    return { kind: 'none' as const, status: 'Sem dados', pct: null, volts: null };
  if (!d.battery_active)
    return { kind: 'off' as const, status: 'Bateria inativa', pct: null, volts: null };
  const pct = d.battery ?? 0;
  return {
    kind: (pct <= 15 ? 'low' : pct <= 40 ? 'mid' : 'ok') as 'low' | 'mid' | 'ok',
    status: 'Bateria ativa', pct, volts: d.battery_voltage,
  };
}
