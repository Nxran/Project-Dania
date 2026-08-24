import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yemzvtsuefaqwbazflqc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbXp2dHN1ZWZhcXdiYXpmbHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTY0NDMsImV4cCI6MjA5Njk5MjQ0M30.uTzz39jVnZNIXnSPCPvCPKCIlYX-EFQuWQBrl0TR47Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    }
  }
});
