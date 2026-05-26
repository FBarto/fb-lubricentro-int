import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow Condensed', Arial, sans-serif",
      gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>FB LUBRICENTRO</div>
        <div style={{ fontSize: 13, color: '#444', letterSpacing: 4, textTransform: 'uppercase' }}>AntiGravity · Sistema de Gestión</div>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => router.push('/gomeria')}
          style={{ padding: '24px 48px', background: '#1d4ed8', border: 'none', borderRadius: 14, color: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
          🔧 GOMERÍA
        </button>
        <button onClick={() => router.push('/caja')}
          style={{ padding: '24px 48px', background: '#111', border: '2px solid #222', borderRadius: 14, color: '#ccc', fontSize: 22, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
          🖥️ CAJA
        </button>
        <button onClick={() => router.push('/dashboard')}
          style={{ padding: '24px 48px', background: '#052e16', border: '2px solid #065f46', borderRadius: 14, color: '#6ee7b7', fontSize: 22, fontWeight: 800, cursor: 'pointer', letterSpacing: 1 }}>
          📊 DASHBOARD
        </button>
      </div>
    </div>
  );
}
