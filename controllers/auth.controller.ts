import { Request, Response } from 'express';
import { signUpUser, signInUser, verifyOtpUser } from '../services/auth.service';
import { generateToken } from '../utils/jwt';

export const signUp = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    console.log(`[AUTH] Attempting signup for: ${email}`);

    const data = await signUpUser(email, password, fullName);

    console.log(`[AUTH] Signup successful for: ${email}. OTP sent.`);
    res.status(201).json({
      message: 'Check your email for confirmation code',
      data,
    });
  } catch (err: any) {
    console.error(`[AUTH ERROR] Signup failed for ${req.body.email}: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    console.log(`[AUTH] Verifying OTP for: ${email}`);

    const data = await verifyOtpUser(email, otp);

    const token = generateToken({
      userId: data.user?.id,
      email: data.user?.email,
    });

    console.log(`[AUTH] OTP verified successfully for: ${email}`);
    res.json({
      message: 'Email verified successfully',
      token,
      user: data.user,
    });
  } catch (err: any) {
    console.error(`[AUTH ERROR] OTP verification failed for ${req.body.email}: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};

export const signIn = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log(`[AUTH] Attempting signin for: ${email}`);

    const data = await signInUser(email, password);

    const token = generateToken({
      userId: data.user?.id,
      email: data.user?.email,
    });

    console.log(`[AUTH] Signin successful for: ${email}`);
    res.json({
      message: 'Login successful',
      token,
      user: data.user,
    });
  } catch (err: any) {
    console.error(`[AUTH ERROR] Signin failed for ${req.body.email}: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
};