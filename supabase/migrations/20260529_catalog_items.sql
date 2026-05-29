-- Mémoire de l'assistant : catalogue de prestations/produits par entreprise
CREATE TABLE IF NOT EXISTS catalog_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit        TEXT        NOT NULL DEFAULT 'unité',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_items_company_access" ON catalog_items
  FOR ALL
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
