\n\n-- Create function to increment resumes_created_count\nCREATE OR REPLACE FUNCTION increment_resumes_created_count(user_id_param UUID)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  UPDATE user_profiles \n  SET resumes_created_count = COALESCE(resumes_created_count, 0) + 1,\n      profile_updated_at = now()\n  WHERE id = user_id_param;
\nEND;
\n$$;
\n\n-- Grant execute permission to authenticated users\nGRANT EXECUTE ON FUNCTION increment_resumes_created_count(UUID) TO authenticated;
;
