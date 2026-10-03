import { Device, batteryInfo } from '@/lib/format';

export default function Battery({ device, detail = true }: { device: Device; detail?: boolean }) {
  const b = batteryInfo(device);
  const cls = b.kind === 'ok' || b.kind === 'none' ? '' : b.kind;
  return (
    <div>
      <div className={`batt ${cls}`}>
        <span className="icon">{b.pct !== null && <i style={{ width: `${Math.max(b.pct, 4)}%` }} />}</span>
        <span className="value">
          {b.pct !== null ? <>{b.pct}<small>%</small></> : '--'}
        </span>
      </div>
      <div className="sub">
        {b.status}{detail && b.volts !== null ? `, ${b.volts.toFixed(2)} V` : ''}
      </div>
      {b.kind === 'low' && <div className="warn">Bateria baixa, recarregue em breve.</div>}
    </div>
  );
}
