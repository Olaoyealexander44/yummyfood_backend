import { Request, Response } from 'express';
import { supabase } from '../config/supabaseClient';

export const submitPayment = async (req: Request, res: Response) => {
  try {
    const { name, email, orderId, total, orders } = req.body;
    const file = req.file;
    // Get userId if the user is signed in (optional)
    const userId = (req as any).user?.userId || null;

    if (!userId) {
      console.warn(`[PAYMENT WARNING] Guest user submitting payment for ${email}. This order will not be linked to any account.`);
    } else {
      console.log(`[PAYMENT] Registered user ${userId} submitting payment for ${email}.`);
    }

    if (!file) {
      return res.status(400).json({ error: 'Receipt file is required' });
    }

    console.log(`[PAYMENT] Processing payment for user: ${email} (User ID: ${userId || 'Guest'})`);

    // 1. Upload receipt to Supabase Storage
    // Use 'guests' folder if no userId is present
    const storagePath = userId ? userId : 'guests';
    const fileName = `${storagePath}/${Date.now()}-${file.originalname}`;
    console.log(`[PAYMENT] Uploading file to bucket 'receipts': ${fileName}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error(`[STORAGE ERROR] ${uploadError.message}`);
      throw uploadError;
    }

    // 2. Get Public URL for the receipt
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);
    
    console.log(`[PAYMENT] File uploaded successfully. Public URL: ${publicUrl}`);

    // 3. Save payment details to database
    console.log(`[PAYMENT] Saving record to table 'payments'...`);
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        order_id: String(orderId),
        full_name: name,
        email: email,
        amount: parseFloat(total),
        order_summary: typeof orders === 'string' ? JSON.parse(orders) : orders,
        receipt_url: publicUrl,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error(`[DATABASE ERROR] ${dbError.message}`);
      throw dbError;
    }

    // 4. Sync with orders table so it appears in history
    console.log(`[PAYMENT] Syncing with 'orders' table for Order ID: ${orderId}...`);
    const { error: orderError } = await supabase
      .from('orders')
      .upsert({
        id: Number(orderId), // Use the same ID as the payment reference
        user_id: userId,
        items: typeof orders === 'string' ? JSON.parse(orders) : orders,
        total_amount: parseFloat(total),
        receipt_url: publicUrl,
        status: 'awaiting_confirmation',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (orderError) {
      console.error(`[ORDER SYNC ERROR] ${orderError.message}`);
      throw new Error(`Failed to sync order: ${orderError.message}`);
    }

    console.log(`[PAYMENT SUCCESS] Payment and Order record saved for order: ${orderId}`);
    res.status(201).json({ message: 'Payment proof submitted successfully' });

  } catch (err: any) {
    console.error(`[PAYMENT ERROR] Submission failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

export const getAllPayments = async (req: Request, res: Response) => {
  try {
    console.log(`[ADMIN] Fetching all payment records...`);
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`[ADMIN] Successfully fetched ${data.length} records`);
    res.json(data);
  } catch (err: any) {
    console.error(`[ADMIN ERROR] Failed to fetch payments: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};