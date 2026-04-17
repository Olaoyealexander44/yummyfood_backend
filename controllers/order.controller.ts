import { Request, Response } from 'express';
import { supabase } from '../config/supabaseClient';

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, total } = req.body;
    const userId = (req as any).user.userId;

    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        items,
        total_amount: total,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORDER] New order created for user: ${userId}`);
    res.status(201).json(data);
  } catch (err: any) {
    console.error(`[ORDER ERROR] Creation failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    console.log(`[ORDER] Fetching history for user: ${userId}`);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[ORDER ERROR] Database query failed: ${error.message}`);
      throw error;
    }

    console.log(`[ORDER] Found ${data?.length || 0} orders for user: ${userId}`);
    res.json(data);
  } catch (err: any) {
    console.error(`[ORDER ERROR] History fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    console.log(`[ADMIN] Fetching all user orders...`);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`[ADMIN] Successfully fetched ${data.length} orders`);
    res.json(data);
  } catch (err: any) {
    console.error(`[ADMIN ERROR] Failed to fetch all orders: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expected: 'confirmed' | 'cancelled'

    if (!['confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "confirmed" or "cancelled".' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found.' });

    // Sync with payments table if it exists
    console.log(`[ADMIN] Syncing status with payments table for Order ID: ${id}...`);
    const { error: paymentError } = await supabase
      .from('payments')
      .update({ status })
      .eq('order_id', String(id));

    if (paymentError) {
      console.warn(`[ADMIN WARNING] Failed to sync status with payments table: ${paymentError.message}`);
      // We don't throw here to ensure the order update is still considered successful
    }

    console.log(`[ADMIN] Order #${id} has been ${status}.`);
    res.json(data);
  } catch (err: any) {
    console.error(`[ADMIN ERROR] Failed to update order status: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};