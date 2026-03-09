'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Exchange the PKCE authorization code (in the URL query string) for a
      // valid Supabase session. This stores the session in localStorage so that
      // every subsequent page can read it instantly via getSession().
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );

      if (error || !data.session) {
        console.error('OAuth callback error:', error?.message);
        setFailed(true);
        return;
      }

      const user = data.session.user;

      // Auto-create the profiles row for first-time Google OAuth users.
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email ?? '',
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              null,
            role: 'citizen',
          },
          { onConflict: 'id' },
        );
      }

      router.replace('/citizen');
    };

    void handleCallback();
  }, [router]);

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-600 font-medium">
          Authentication failed. Please try signing in again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500 animate-pulse">Signing you in…</p>
    </div>
  );
}
