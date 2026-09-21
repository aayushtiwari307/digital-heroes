CREATE TABLE IF NOT EXISTS charity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id UUID NOT NULL REFERENCES charities(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','link')),
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charity_media_charity ON charity_media(charity_id);
