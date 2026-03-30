import { Link } from "react-router-dom";
import { blogPosts } from "../content/blogPosts";

export default function BlogPage() {
  return (
    <main className="blog-page" aria-labelledby="blog-page-title">
      <section className="blog-hero">
        <p className="blog-eyebrow">BUNDLECART BLOG</p>
        <h1 id="blog-page-title">Shop smarter, spend better</h1>
        <p>
          Ideas, behavior insights, and simple shopping strategies for customers who want to get
          more value from every order.
        </p>
      </section>

      <section className="blog-list" aria-label="Blog posts">
        {blogPosts.map((post) => (
          <article key={post.slug} className="blog-card">
            {post.image ? (
              <img
                className="blog-card-image"
                src={post.image}
                alt={post.title}
                loading="lazy"
              />
            ) : null}
            <div className="blog-card-body">
              <p className="blog-card-date">{post.dateLabel}</p>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <Link className="marketing-btn marketing-btn-primary blog-card-link" to={`/blog/${post.slug}`}>
                Read article
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
