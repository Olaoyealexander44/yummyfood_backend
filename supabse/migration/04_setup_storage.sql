-- Allow public access to view receipts
CREATE POLICY "Allow public select from receipts" ON storage.objects 
FOR SELECT USING (bucket_id = 'receipts');

-- Allow anyone to upload a receipt
CREATE POLICY "Allow public uploads to receipts" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'receipts');