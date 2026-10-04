CREATE POLICY "Store logos are readable by signed-in users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'store-logos');

CREATE POLICY "Owners can upload store logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update store logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete store logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);