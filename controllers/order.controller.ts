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
      console.error(`[DATABASE ERROR] Supabase query failed: ${error.message}`);
      throw error;
    }

    const orders = data || [];
    console.log(`[ORDER] Found ${orders.length} orders for user: ${userId}`);
    res.json(orders);
  } catch (err: any) {
    console.error(`[ORDER ERROR] History fetch failed: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch user history', 
      details: err.message,
      code: err.code 
    });
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

export const trackOrder = async (req: Request, res: Response) => {
  try {
    const { id, email } = req.params;
    console.log(`[ORDER] Guest tracking attempt for Order ID: ${id}, Email: ${email}`);

    // 1. Find the payment record to verify email ownership
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('order_id')
      .eq('order_id', id)
      .eq('email', email)
      .single();

    if (paymentError || !payment) {
      console.warn(`[ORDER] Tracking failed: No payment match for ${id} and ${email}`);
      return res.status(404).json({ error: 'Order not found or email mismatch.' });
    }

    // 2. Fetch the actual order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || 'Order details not found');
    }

    console.log(`[ORDER] Tracking success for Order ID: ${id}`);
    res.json(order);
  } catch (err: any) {
    console.error(`[ORDER ERROR] Tracking failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to track order' });
  }
};