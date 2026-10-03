'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, password }),
    });
    if (r.ok) { router.push('/'); router.refresh(); return; }
    setError((await r.json()).error ?? 'Não foi possível entrar.'); setBusy(false);
  }

  return (
    <div className="login">
      <div className="corner"><ThemeToggle /></div>
      <h1>Estação meteorológica</h1>
      <div className="muted">Entre para ver suas leituras.</div>
      <form onSubmit={submit}>
        <label>Usuário<input value={user} onChange={e => setUser(e.target.value)} autoComplete="username" required /></label>
        <label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
