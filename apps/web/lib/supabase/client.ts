import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/src/types/database.types';

/**
 * SSR-aware Supabase browser client.
 *
 * Using `createBrowserClient` (from @supabase/ssr) instead of the plain
 * `createClient` ensures that the PKCE code_verifier is stored in a cookie
 * rather than localStorage.  Cookies survive the OAuth redirect round-trip,
 * so the verifier is always available when /auth/callback exchanges the code
 * for a session — eliminating the "code verifier not found" PKCE error.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
