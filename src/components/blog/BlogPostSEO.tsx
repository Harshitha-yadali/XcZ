import { Seo } from '../../seo/Seo';
import { articleSchema, breadcrumbListSchema, faqPageSchema, type FaqItem } from '../../seo/schema';
import { DEFAULT_OG_IMAGE } from '../../seo/constants';
import { BlogPostWithRelations } from '../../types/blog';

interface BlogPostSEOProps {
  post: BlogPostWithRelations;
  /** Optional FAQ items surfaced from the post body (see extractFaqsFromHtml in TableOfContents.tsx). */
  faqs?: FaqItem[];
}

export const BlogPostSEO: React.FC<BlogPostSEOProps> = ({ post, faqs }) => {
  const metaTitle = post.meta_title || post.title;
  const metaDescription = post.meta_description || post.excerpt || post.body_content.replace(/<[^>]+>/g, '').slice(0, 160);
  const path = `/blog/${post.slug}`;
  const imageUrl = post.featured_image_url || DEFAULT_OG_IMAGE;

  const jsonLd = [
    articleSchema({
      path,
      headline: post.title,
      description: metaDescription,
      image: imageUrl,
      datePublished: post.published_at || post.created_at,
      dateModified: post.updated_at,
      authorName: post.author_name || undefined,
      section: post.categories?.map((c) => c.name).join(', '),
      keywords: post.tags?.map((t) => t.name).join(', '),
    }),
    breadcrumbListSchema([
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
    ...(faqs && faqs.length ? [faqPageSchema(faqs)] : []),
  ];

  return (
    <Seo
      title={`${metaTitle} | PrimoBoost AI Blog`}
      description={metaDescription}
      canonicalPath={path}
      ogType="article"
      ogImage={imageUrl}
      keywords={post.tags?.map((t) => t.name).join(', ')}
      jsonLd={jsonLd}
      appendSiteName={false}
    />
  );
};
