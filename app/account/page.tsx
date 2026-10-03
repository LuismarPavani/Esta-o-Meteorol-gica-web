'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';

export default function Account() {
  const router = useRouter();
  const [me, setMe] = useState<{ username: string; role: string; has_owm_key: boolean } | null>(null);
  const [key, setKey] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => fetch('/api/me').then(r => { if (r.status === 401) router.push('/login'); return r.json(); }).then(setMe);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(body: object, ok: string) {
    setMsg(''); setError('');
    const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { setError((await r.json()).error); return; }
    setMsg(ok); setKey(''); setPw(''); load();
  }

  return (
    <main>
      <TopBar />
      <h2>Minha conta</h2>
      {me && <p className="muted">Usuário <b>{me.username}</b>, tipo {me.role === 'admin' ? 'admin (vê todos os ESPs)' : 'normal (vê só os seus ESPs)'}.</p>}

      <h2>Chave da OpenWeatherMap</h2>
      <div className="form">
        <p className="muted small" style={{ margin: 0 }}>
          {me?.has_owm_key ? 'Há uma chave cadastrada. Cole outra para trocar.' : 'Nenhuma chave cadastrada.'} A chave fica guardada no servidor e não é mostrada de volta.
        </p>
        <label>Chave (API key)<input value={key} onChange={e => setKey(e.target.value)} autoComplete="off" /></label>
        <div className="actions">
          <button className="btn" disabled={!key.trim()} onClick={() => patch({ owm_key: key }, 'Chave salva.')}>Salvar chave</button>
          {me?.has_owm_key && <button className="btn danger" onClick={() => patch({ owm_key: '' }, 'Chave removida.')}>Remover</button>}
        </div>
      </div>

      <h2>Trocar senha</h2>
      <div className="form">
        <label>Nova senha<input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></label>
        <div><button className="btn" disabled={pw.length < 6} onClick={() => patch({ password: pw }, 'Senha alterada.')}>Alterar senha</button></div>
      </div>
      {msg && <p className="msg">{msg}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  );
}
