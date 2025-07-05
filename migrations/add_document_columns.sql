-- Add document-related columns to demandes table
ALTER TABLE demandes
ADD COLUMN document_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN document_data BYTEA,
ADD COLUMN document_generated_at TIMESTAMP;

-- Add index for faster document queries
CREATE INDEX idx_demandes_document_generated ON demandes(document_generated);

-- Add comment to explain the new columns
COMMENT ON COLUMN demandes.document_generated IS 'Indicates if a leave document has been generated';
COMMENT ON COLUMN demandes.document_data IS 'Stores the generated PDF document data';
COMMENT ON COLUMN demandes.document_generated_at IS 'Timestamp when the document was generated'; 