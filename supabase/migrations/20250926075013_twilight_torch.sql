\n\nCREATE OR REPLACE FUNCTION increment_total_resumes_created()\nRETURNS bigint\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  new_count bigint;
\nBEGIN\n  -- Atomically increment the total resumes created count\n  UPDATE app_metrics \n  SET metric_value = metric_value + 1,\n      updated_at = now()\n  WHERE metric_name = 'total_resumes_created'\n  RETURNING metric_value INTO new_count;
\n  \n  -- If the record doesn't exist, create it\n  IF new_count IS NULL THEN\n    INSERT INTO app_metrics (metric_name, metric_value)\n    VALUES ('total_resumes_created', 50001)\n    ON CONFLICT (metric_name) DO UPDATE SET\n      metric_value = app_metrics.metric_value + 1,\n      updated_at = now()\n    RETURNING metric_value INTO new_count;
\n  END IF;
\n  \n  RETURN new_count;
\nEND;
\n$$;
\n\n-- Grant execute permission to authenticated users\nGRANT EXECUTE ON FUNCTION increment_total_resumes_created() TO authenticated;
;
