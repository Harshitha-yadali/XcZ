/*\n  # Add agenda field to webinars table\n\n  1. Changes\n    - Add `agenda` jsonb column to store session breakdown with time and topic\n    - Column allows null values for backward compatibility\n  \n  2. Purpose\n    - Store structured agenda data for webinars showing session timeline\n    - Each agenda item contains time and topic information\n*/\n\nALTER TABLE webinars \nADD COLUMN IF NOT EXISTS agenda jsonb DEFAULT NULL;
\n\nCOMMENT ON COLUMN webinars.agenda IS 'Session breakdown with time and topic (e.g., [{"time": "3:00-3:10 PM", "topic": "Introduction"}])';
\n;
