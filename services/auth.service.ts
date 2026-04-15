import { supabase } from '../config/supabaseClient';

export const signUpUser = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${process.env.CLIENT_URL}/auth/callback`
    }
  });

  if (error) throw error;

  // If verification is successful, create a profile record
  if (data.user) {
    const fullName = data.user.user_metadata?.['full_name'] || data.user.user_metadata?.['fullName'] || 'New User';
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error(`[DATABASE ERROR] Failed to create profile for ${email}:`, profileError.message);
    } else {
      console.log(`[DATABASE] Profile successfully created/updated for: ${email}`);
    }
  }

  return data;
};

export const verifyOtpUser = async (email: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });

  if (error) throw error;
  return data;
};

export const signInUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};