/*\n  # Add Banner URL Column to Webinars Table\n\n  1. Changes\n    - Add `banner_url` column to store banner image URLs for webinar pages\n    - Add `banner_alt_text` column for accessibility\n    - Both columns are optional (nullable)\n\n  2. Purpose\n    - Allow admins to set custom banner images for each webinar landing page\n    - Improve visual presentation of webinar pages\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'webinars' AND column_name = 'banner_url'\n  ) THEN\n    ALTER TABLE webinars ADD COLUMN banner_url text;
\n  END IF;
\nEND $$;
\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'webinars' AND column_name = 'banner_alt_text'\n  ) THEN\n    ALTER TABLE webinars ADD COLUMN banner_alt_text text;
\n  END IF;
\nEND $$;
;
