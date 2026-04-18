import { supabase } from '../config/supabaseClient';

export const signUpUser = async (email: string, password: string, fullName: string, role: string = 'customer', adminSecret?: string) => {
  // Simple validation for admin secret
  if (role === 'admin' && adminSecret !== process.env.ADMIN_SECRET) {
    throw new Error('Invalid Admin Secret Key');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
      emailRedirectTo: `${process.env.CLIENT_URL}/auth/callback`
    }
  });

  if (error) throw error;

  // We do NOT confirm the user here anymore to allow Supabase to send the OTP.
  // The profile will be created/updated below once the user object is returned from signUp.

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
        role: role,
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

export const resendOtpUser = async (email: string) => {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  if (error) throw error;
  return data;
};

export const forgotPasswordUser = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
};

export const resetPasswordUser = async (email: string, otp: string, password: string) => {
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: 'recovery',
  });
  if (verifyError) throw verifyError;

  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password,
  });
  if (updateError) throw updateError;

  return { verifyData, updateData };
};

export const signInUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};