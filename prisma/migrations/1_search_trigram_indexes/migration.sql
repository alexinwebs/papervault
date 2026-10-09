-- Search runs case-insensitive substring matches (ILIKE) over paper titles,
-- the PDF text layer and the taxonomy names. Trigram GIN indexes let Postgres
-- answer those without a sequential scan. Managed outside schema.prisma
-- because Prisma cannot express operator-class indexes for these columns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Paper_title_trgm_idx" ON "Paper" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Paper_extractedText_trgm_idx" ON "Paper" USING GIN ("extractedText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Subject_name_trgm_idx" ON "Subject" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "College_name_trgm_idx" ON "College" USING GIN ("name" gin_trgm_ops);
