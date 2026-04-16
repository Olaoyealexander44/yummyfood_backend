import { Request, Response } from 'express';
import { supabase } from '../config/supabaseClient';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, totalAmount } = req.body;
    const userId = (req as any).user.userId;

    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        items,
        total_amount: totalAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};