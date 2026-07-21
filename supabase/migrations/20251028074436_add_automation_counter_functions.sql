/*\n  # Add Automation Counter Functions\n\n  ## Overview\n  Creates database functions to safely increment pause and resume counters\n  in the auto_apply_logs table.\n\n  ## Functions\n  - increment_pause_count: Increments pause_count for a log entry\n  - increment_resume_count: Increments resume_count for a log entry\n*/\n\n-- Function to increment pause_count in auto_apply_logs\nCREATE OR REPLACE FUNCTION increment_pause_count(log_id uuid)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  UPDATE auto_apply_logs\n  SET pause_count = COALESCE(pause_count, 0) + 1\n  WHERE id = log_id;
\nEND;
\n$$;
\n\n-- Function to increment resume_count in auto_apply_logs\nCREATE OR REPLACE FUNCTION increment_resume_count(log_id uuid)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  UPDATE auto_apply_logs\n  SET resume_count = COALESCE(resume_count, 0) + 1\n  WHERE id = log_id;
\nEND;
\n$$;
\n\nCOMMENT ON FUNCTION increment_pause_count(uuid) IS 'Safely increments the pause_count for an auto-apply log entry';
\nCOMMENT ON FUNCTION increment_resume_count(uuid) IS 'Safely increments the resume_count for an auto-apply log entry';
\n;
