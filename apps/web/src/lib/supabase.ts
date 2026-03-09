import { createClient } from '@/lib/supabase/client';

// Re-exported singleton so every existing `import { supabase } from '@/src/lib/supabase'`
// automatically gets the SSR-aware browser client (PKCE verifier stored in cookies).
export const supabase = createClient();
