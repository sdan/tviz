import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Custom styling for MDX elements to match Tinker aesthetic
    h1: ({ children }) => (
      <h1 className="text-2xl font-semibold text-foreground mb-6">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-medium text-foreground mt-8 mb-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium text-foreground mt-6 mb-3">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-foreground/80 leading-relaxed mb-4">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-foreground/80 mb-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-foreground/80 mb-4 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 overflow-x-auto mb-4 text-sm">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-neutral-300 pl-4 italic text-foreground/70 mb-4">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full divide-y divide-neutral-200">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-sm font-medium text-foreground bg-neutral-50">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-foreground/80 border-t border-neutral-100">
        {children}
      </td>
    ),
    hr: () => <hr className="border-neutral-200 my-8" />,
    ...components,
  };
}
