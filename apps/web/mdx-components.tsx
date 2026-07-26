import type { MDXComponents } from "mdx/types"

/**
 * Global MDX component map, required by @next/mdx. Kept near-empty on
 * purpose: blog posts render inside a `typeset` container (see
 * app/blog/[slug]), which styles bare HTML elements. The two overrides are
 * behavioral, not visual: body images lazy-load (they sit below the fold),
 * and tables get the typeset-scroll wrapper so wide GFM tables scroll
 * horizontally instead of overflowing on narrow viewports.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Post images are repo-authored SVGs next/image can't optimize; the
    // override exists to force lazy loading on below-the-fold body images.
    // eslint-disable-next-line @next/next/no-img-element
    img: (props) => <img loading="lazy" decoding="async" {...props} />,
    table: (props) => (
      <div className="typeset-scroll">
        <table {...props} />
      </div>
    ),
    ...components,
  }
}
