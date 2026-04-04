import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ltwzlfbiatcmieehixft.supabase.co';
const supabaseKey = 'sb_publishable_Blm164qv9jn2AOqlVnad3A_kPpYN8lx';

export const supabase = createClient(supabaseUrl, supabaseKey);
