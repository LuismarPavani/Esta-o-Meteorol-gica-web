'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { Device } from '@/lib/format';

type U = { id: string; username: string; role: 'admin' | 'user'; has_owm_key: boolean; is_root: boolean; device_ids: string[] };
type Edit = { role?: string; owm_key?: string; password?: string; device_ids?: string[] };

const send = (url: string, method: string, body?: object) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

function DeviceChecks({ devices, value, onChange }: { devices: Device[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!devices.length) return <span className="muted small">Nenhum ESP cadastrado ainda.</span>;
  return (
    <div className="checks">
      {devices.map(d => (
        <label key={d.id}>
          <input type="checkbox" checked={value.includes(d.id)}
            onChange={e => onChange(e.target.checked ? [...value, d.id] : value.filter(x => x !== d.id))} />
          {d.name || d.id}
        </label>
      ))}
    </div>
  );
}

export default function Users() {
  const router = useRouter();
  const [list, setList] = useState<U[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [form, setForm] = useState({ username: '', password: '', role: 'user', owm_key: '', device_ids: [] as string[] });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([fetch('/api/users'), fetch('/api/devices')]);
    if (r.status === 401) { router.push('/login'); return; }
    if (r.status === 403) { router.push('/'); return; }
    setList(await r.json()); setDevices(await d.json());
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const set = (id: string, patch: Edit) => setEdits(e => ({ ...e, [id]: { ...e[id], ...patch } }));

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const r = await send('/api/users', 'POST', form);
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ username: '', password: '', role: 'user', owm_key: '', device_ids: [] }); load();
  }
  async function save(u: U) {
    const r = await send(`/api/users/${u.id}`, 'PATCH', edits[u.id] ?? {});
    setError(r.ok ? '' : (await r.json()).error);
    if (r.ok) setEdits(e => { const n = { ...e }; delete n[u.id]; return n; });
    load();
  }
  async function remove(u: U) {
    if (!confirm(`Excluir o usuário "${u.username}"?`)) return;
    const r = await send(`/api/users/${u.id}`, 'DELETE');
    setError(r.ok ? '' : (await r.json()).error); load();
  }

  return (
    <main>
      <TopBar />
      <h2>Novo usuário</h2>
      <form className="add panel" onSubmit={add}>
        <label>Usuário<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" required /></label>
        <label>Senha<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required /></label>
        <label>Tipo
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="user">Normal (só os ESPs liberados)</option>
            <option value="admin">Admin (acessa tudo)</option>
          </select>
        </label>
        <label>Chave OpenWeatherMap<input value={form.owm_key} onChange={e => setForm({ ...form, owm_key: e.target.value })} autoComplete="off" placeholder="opcional" /></label>
        {form.role === 'user' && (
          <div className="checks" style={{ display: 'block' }}>
            <div className="muted small" style={{ marginBottom: 6 }}>ESPs que este usuário pode ver</div>
            <DeviceChecks devices={devices} value={form.device_ids} onChange={v => setForm({ ...form, device_ids: v })} />
          </div>
        )}
        <button className="btn">Criar</button>
      </form>
      {error && <p className="error">{error}</p>}

      <h2>Usuários</h2>
      {list.map(u => {
        const ed = edits[u.id] ?? {};
        const role = ed.role ?? u.role;
        return (
          <div className="row wide" key={u.id}>
            <div><b>{u.username}</b> {u.is_root && <span className="tag">principal (.env)</span>}</div>
            <label>Tipo
              <select value={role} disabled={u.is_root} onChange={e => set(u.id, { role: e.target.value })}>
                <option value="user">Normal</option><option value="admin">Admin</option>
              </select>
            </label>
            <label>Chave OpenWeatherMap
              <input value={ed.owm_key ?? ''} onChange={e => set(u.id, { owm_key: e.target.value })} autoComplete="off"
                placeholder={u.has_owm_key ? 'cadastrada (digite para trocar)' : 'sem chave'} />
            </label>
            <label>Nova senha
              <input type="password" value={ed.password ?? ''} disabled={u.is_root} onChange={e => set(u.id, { password: e.target.value })} autoComplete="new-password"
                placeholder={u.is_root ? 'definida em ADMIN_PASSWORD' : 'deixe vazio para manter'} />
            </label>
            <div className="actions">
              <button className="btn" onClick={() => save(u)} disabled={!Object.keys(ed).length}>Salvar</button>
              {!u.is_root && <button className="btn danger" onClick={() => remove(u)}>Excluir</button>}
            </div>
            <div className="meta" style={{ display: 'block' }}>
              {role === 'admin'
                ? <span>Admin acessa todos os ESPs.</span>
                : <>
                    <div style={{ marginBottom: 6 }}>ESPs que este usuário pode ver</div>
                    <DeviceChecks devices={devices} value={ed.device_ids ?? u.device_ids} onChange={v => set(u.id, { device_ids: v })} />
                  </>}
            </div>
          </div>
        );
      })}
    </main>
  );
}
