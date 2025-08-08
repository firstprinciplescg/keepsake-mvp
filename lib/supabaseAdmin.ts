import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if(!url || !serviceKey){
  console.warn('Supabase URL or Service Role Key missing. API routes will fail until set.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false }
});
