import { Link, useParams } from "react-router-dom";
import { formatBlogDate, getBlogPostBySlug } from "../content/blogPosts";

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const post = getBlogPostBySlug(String(slug || "").trim());

  if (!post) {
    return (
      <div className="marketing-page">
        <section className="marketing-section blog-post-shell">
          <p className="marketing-eyebrow">BLOG</p>
          <h1>Post not found</h1>
          <p className="subtle">This article does not exist or may have been moved.</p>
          <div className="blog-post-actions">
            <Link className="marketing-btn marketing-btn-secondary" to="/blog">
              Back to Blog
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="marketing-page">
      <section className="marketing-section blog-post-shell">
        <article className="blog-post-content">
          <p className="marketing-eyebrow">BLOG ARTICLE</p>
          <h1>{post.title}</h1>
          <p className="blog-article-meta">{formatBlogDate(post.date)}</p>
          {post.image ? (
            <img
              className="blog-post-cover-image"
              src={post.image}
              alt={post.title}
              loading="lazy"
            />
          ) : null}

          {post.sections.map((section, index) => (
            <section key={`${post.slug}-section-${index}`} className="blog-article-section">
              {section.heading ? <h2>{section.heading}</h2> : null}
              {(section.paragraphs || []).map((paragraph, paragraphIndex) => (
                <p key={`${post.slug}-section-${index}-paragraph-${paragraphIndex}`}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>

        <section className="blog-post-cta">
          <h2>Explore BundleCart</h2>
          <p>See how BundleCart helps shoppers pay shipping once and keep shopping smarter.</p>
          <a
            className="marketing-btn marketing-btn-primary"
            href="https://bundlecart.app"
            target="_blank"
            rel="noreferrer"
          >
            Explore BundleCart
          </a>
        </section>
      </section>
    </div>
  );
}
