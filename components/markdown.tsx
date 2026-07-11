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

export function Markdown({ content }: MarkdownProps) {
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none leading-relaxed text-text-secondary [&_a]:border-b [&_a]:border-accent/20 [&_a]:text-accent [&_a]:no-underline [&_a]:transition-all [&_a]:duration-200 [&_a:hover]:border-accent [&_a:hover]:text-accent-hover [&_blockquote]:rounded [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-bg-card [&_blockquote]:p-4 [&_blockquote]:text-text-secondary [&_code:not(pre_code)]:rounded-md [&_code:not(pre_code)]:border [&_code:not(pre_code)]:border-line [&_code:not(pre_code)]:bg-bg-card [&_code:not(pre_code)]:px-2 [&_code:not(pre_code)]:py-1 [&_code:not(pre_code)]:text-[0.92em] [&_code:not(pre_code)]:text-accent [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-tight [&_h2]:text-text [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:tracking-tight [&_h3]:text-text [&_ol]:mb-4 [&_p]:mb-4 [&_table]:mb-4 [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-line [&_table]:border-collapse [&_td]:border-b [&_td]:border-line [&_td]:p-3 [&_td]:text-left [&_th]:border-b [&_th]:border-line [&_th]:bg-bg-card [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_ul]:mb-4"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }], rehypeHighlight]}
      components={{
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
  );
}
