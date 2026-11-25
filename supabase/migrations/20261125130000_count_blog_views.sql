-- The site calls this on every article view, but it was never created, so no
-- view was counted. Readers cannot update blog_posts themselves.
CREATE OR REPLACE FUNCTION public.increment_blog_view_count(post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.blog_posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = increment_blog_view_count.post_id AND status = 'published';
$$;

REVOKE ALL ON FUNCTION public.increment_blog_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_blog_view_count(uuid) TO anon, authenticated;
