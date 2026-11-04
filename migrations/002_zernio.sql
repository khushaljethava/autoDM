-- Id of the mirrored automation in Zernio (NULL until first synced).
ALTER TABLE automations ADD COLUMN zernio_id TEXT;
