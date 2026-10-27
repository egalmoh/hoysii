
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ubijspqriyejmxtjxhft.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViaWpzcHFyaXllam14dGp4aGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDczMzAsImV4cCI6MjA4NDg4MzMzMH0.XJ6judVsb4ltlMDQbjYAjs2PL9WtmK6YCYGdCPEtW7M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseClient = (clerkToken) => {
  if (clerkToken) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${clerkToken}` } },
    });
  }
  return supabase;
};

export const syncUser = async ({ clerk_id, email, full_name, phone_number }, token) => {
  if (!clerk_id || !email) {
    console.error('Missing required fields for syncUser:', { clerk_id, email });
    return null;
  }

  // Log input data for debugging
  console.log('syncUser called with:', JSON.stringify({
    clerk_id,
    email,
    full_name,
    phone_number,
    hasToken: !!token
  }, null, 2));

  try {
    const activeSupabase = token 
      ? createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
      : supabase;

    const userData = { 
      id: clerk_id,
      clerk_id, 
      email, 
      full_name, 
      phone_number,
    };

    console.log('Attempting upsert with data:', JSON.stringify(userData, null, 2));

    const { data, error } = await activeSupabase
      .from('users')
      .upsert(userData, { onConflict: 'clerk_id' })
      .select();

    if (error) {
      // Serialize error for better logging
      console.error('Supabase Upsert Error Details:', JSON.stringify({
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }, null, 2));
      console.error('Full error object:', error);
      throw error;
    }
    
    console.log('User sync successful:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error in syncUser catch block:', JSON.stringify({
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      name: error?.name
    }, null, 2));
    console.error('Full error:', error);
    return null;
  }
};
