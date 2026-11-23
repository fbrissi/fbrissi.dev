import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

type MarkdownProps = {
  content: string;
};

// Headings stay plain text; the heading itself links to its section, with a decorative "#" (empty alt text, so it is not part
// of the link's accessible name) shown on hover or keyboard focus.
const headingLinks = { behavior: 'wrap', properties: { className: ['heading-anchor'] } } as const;

export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="prose prose-invert max-w-none leading-relaxed text-text-secondary [&_a]:border-b [&_a]:border-accent/20 [&_a.heading-anchor]:border-0 [&_a.heading-anchor]:text-inherit [&_a.heading-anchor:hover]:text-inherit [&_a.heading-anchor]:after:ml-2 [&_a.heading-anchor]:after:text-text-muted [&_a.heading-anchor]:after:opacity-0 [&_a.heading-anchor]:after:[content:'#'_/_''] [&_a.heading-anchor:hover]:after:opacity-100 [&_a.heading-anchor:focus-visible]:after:opacity-100 [&_a]:text-accent [&_a]:no-underline [&_a]:transition-all [&_a]:duration-200 [&_a:hover]:border-accent [&_a:hover]:text-accent-hover [&_blockquote]:rounded-sm [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-bg-card [&_blockquote]:p-4 [&_blockquote]:text-text-secondary [&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-line [&_code:not(pre_code)]:bg-bg-card [&_code:not(pre_code)]:px-2 [&_code:not(pre_code)]:py-1 [&_code:not(pre_code)]:text-[0.92em] [&_code:not(pre_code)]:text-accent [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-tight [&_h2]:text-text [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:tracking-tight [&_h3]:text-text [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_table]:mb-4 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-line [&_table]:border-collapse [&_td]:border-b [&_td]:border-line [&_td]:p-3 [&_td]:text-left [&_th]:border-b [&_th]:border-line [&_th]:bg-bg-card [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeAutolinkHeadings, headingLinks], rehypeHighlight]}
        components={{
          a(props) {
            // External links open in a new tab; internal links stay in this one.
            const attributes: Omit<typeof props, 'node'> & { node?: unknown } = { ...props };
            delete attributes.node;
            const external = /^https?:\/\//.test(String(props.href));
            return <a {...attributes} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} />;
          },
          table(props) {
            // Wide tables scroll inside their own box, so the page never scrolls sideways on a phone.
            const attributes: Omit<typeof props, 'node'> & { node?: unknown } = { ...props };
            delete attributes.node;
            return (
              <div className="mb-4 max-w-full overflow-x-auto">
                <table {...attributes} />
              </div>
            );
          },
          pre({ children, ...props }) {
            return (
              <pre className="overflow-x-auto rounded-xl border border-line bg-[rgba(2,6,23,0.9)] p-5 shadow" {...props}>
                {children as ReactNode}
              </pre>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
