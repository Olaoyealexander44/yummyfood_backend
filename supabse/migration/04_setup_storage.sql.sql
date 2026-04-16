-- Create the receipts bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view receipts
CREATE POLICY "Allow public select from receipts" ON storage.objects 
FOR SELECT USING (bucket_id = 'receipts');

-- Allow anyone to upload a receipt
CREATE POLICY "Allow public uploads to receipts" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'receipts');

-- Allow anyone to update/overwrite a receipt (required for upsert)
CREATE POLICY "Allow updates to receipts" ON storage.objects 
FOR UPDATE USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');