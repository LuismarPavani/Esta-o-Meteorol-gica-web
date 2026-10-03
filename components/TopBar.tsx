'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

export default function TopBar() {
  const router = useRouter();
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  useEffect(() => { fetch('/api/me').then(r => (r.ok ? r.json() : null)).then(setMe); }, []);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login'); router.refresh();
  }
  return (
    <header className="top">
      <div className="brand">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 .5 8.5H7z" />
        </svg>
        Estação meteorológica
      </div>
      <nav>
        <Link href="/">Painel</Link>
        <Link href="/devices">Dispositivos</Link>
        {me?.role === 'admin' && <Link href="/users">Usuários</Link>}
        <Link href="/account">Minha conta</Link>
        <button className="link" onClick={logout}>Sair{me ? ` (${me.username})` : ''}</button>
        <ThemeToggle />
      </nav>
    </header>
  );
}
