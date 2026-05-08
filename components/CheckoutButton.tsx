'use client';

import { useState } from 'react';

interface CheckoutButtonProps {
  isLoggedIn: boolean;
  isPro: boolean;
}

export default function CheckoutButton({ isLoggedIn, isPro }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  if (isPro) {
    return (
      <a
        href="/dashboard/settings"
        style={{
          display: 'block',
          width: '100%',
          padding: '12px 0',
          background: 'rgba(0,255,136,0.08)',
          border: '1px solid rgba(0,255,136,0.2)',
          borderRadius: 2,
          textAlign: 'center',
          fontFamily: 'var(--font-jetbrains-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: '#00ff88',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        YOU&apos;RE ON PRO
      </a>
    );
  }

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      window.location.href = '/auth/signup?plan=pro';
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 0',
        background: loading ? 'rgba(6,182,212,0.05)' : 'rgba(6,182,212,0.1)',
        border: '1px solid rgba(6,182,212,0.3)',
        borderRadius: 2,
        textAlign: 'center',
        fontFamily: 'var(--font-jetbrains-mono)',
        fontSize: 11,
        letterSpacing: '0.12em',
        color: loading ? '#3d4a5c' : '#06b6d4',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {loading ? 'REDIRECTING...' : (isLoggedIn ? 'UPGRADE TO PRO →' : 'GET STARTED →')}
    </button>
  );
}
