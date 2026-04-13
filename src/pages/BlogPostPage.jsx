import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { formatBlogDate, getBlogPostBySlug } from "../content/blogPosts";
import { trackEvent } from "../lib/analytics";

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const post = getBlogPostBySlug(String(slug || "").trim());

  useEffect(() => {
    if (!post) {
      return;
    }
    trackEvent("page_view", {
      path: window.location.pathname,
      referrer: document.referrer || "",
      blogTitle: post.title,
      blogSlug: post.slug
    });
    trackEvent("blog_post_view", {
      blogTitle: post.title,
      blogSlug: post.slug
    });
  }, [post]);

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
            onClick={() => {
              trackEvent("outbound_click", {
                destinationUrl: "https://bundlecart.app",
                linkLabel: "Explore BundleCart",
                pagePath: window.location.pathname
              });
              trackEvent("cta_click", {
                buttonLabel: "Explore BundleCart",
                buttonLocation: "blog_post_footer",
                pagePath: window.location.pathname
              });
            }}
          >
            Explore BundleCart
          </a>
        </section>
      </section>
    </div>
  );
}
