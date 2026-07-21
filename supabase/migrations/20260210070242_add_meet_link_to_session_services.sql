/*\n  # Add Meet Link to Session Services\n\n  1. Modified Tables\n    - `session_services`\n      - Added `meet_link` (text, nullable) - Google Meet or other video call link set by admin\n\n  2. Notes\n    - Admin sets one meet link per service\n    - All users who book this service receive the same link\n    - Link is shown on booking confirmation and sent via email\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'session_services' AND column_name = 'meet_link'\n  ) THEN\n    ALTER TABLE session_services ADD COLUMN meet_link text DEFAULT '';
\n  END IF;
\nEND $$;
\n;
