ALTER TABLE "Event" ADD COLUMN "shareImageUrl" TEXT;

UPDATE "Event"
SET
  "shareImageUrl" = '/share/hallowparty-2026.jpg',
  "seoDescription" = COALESCE(
    "seoDescription",
    'Hallowparty 2026: 6 de novembro, às 22h, em Ipatinga/MG. Uma noite de música, cenografia e experiência imersiva.'
  )
WHERE "slug" = 'hallowparty-vi6WC3';
