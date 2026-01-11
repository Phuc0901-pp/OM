-- Migration: Create concepts table
-- Description: Table to store user-defined data concepts/schemas

CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    columns JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_concepts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_concepts_updated_at_trigger
    BEFORE UPDATE ON concepts
    FOR EACH ROW
    EXECUTE FUNCTION update_concepts_updated_at();
