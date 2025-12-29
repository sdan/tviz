import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CellProps {
  children?: ReactNode;
  className?: string;
}

interface CodeCellProps extends CellProps {
  code: string;
  lang?: string;
  executionCount?: number;
  output?: ReactNode;
}

// Markdown cell - like Jupyter markdown cells
export function MarkdownCell({ children, className }: CellProps) {
  return (
    <div className={cn("py-3 notebook-markdown", className)}>
      {children}
    </div>
  );
}

// Code cell with syntax highlighting
export async function CodeCell({ code, lang = "python", executionCount, output, className }: CodeCellProps) {
  const html = await codeToHtml(code.trim(), {
    lang,
    theme: "github-light",
  });

  return (
    <div className={cn("my-4", className)}>
      {/* Input */}
      <div className="flex">
        <div className="w-20 flex-shrink-0 text-right pr-3 py-2 text-sm font-mono text-blue-600">
          {executionCount !== undefined ? `In [${executionCount}]:` : "In [ ]:"}
        </div>
        <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded overflow-hidden">
          <div
            className="p-3 font-mono text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="flex mt-1">
          <div className="w-20 flex-shrink-0 text-right pr-3 py-2 text-sm font-mono text-red-600">
            {executionCount !== undefined ? `Out[${executionCount}]:` : ""}
          </div>
          <div className="flex-1 bg-white border border-neutral-200 rounded p-3 font-mono text-sm overflow-x-auto">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}

// Terminal/bash cell with syntax highlighting
export async function TerminalCell({ code, className }: { code: string; className?: string }) {
  const html = await codeToHtml(code.trim(), {
    lang: "bash",
    theme: "github-dark",
  });

  return (
    <div className={cn("my-4", className)}>
      <div className="flex">
        <div className="w-20 flex-shrink-0 text-right pr-3 py-2 text-sm font-mono text-neutral-400">
          $
        </div>
        <div
          className="flex-1 bg-neutral-900 text-neutral-100 rounded-lg p-3 font-mono text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

// Notebook container
export function Notebook({ children, className }: CellProps) {
  return (
    <div className={cn("notebook", className)}>
      {children}
    </div>
  );
}

// Section header (like Jupyter headings)
export function NotebookHeader({ level = 1, children }: { level?: 1 | 2 | 3; children: ReactNode }) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const styles = {
    1: "text-2xl font-semibold text-foreground mb-4 pb-2 border-b border-neutral-200",
    2: "text-xl font-medium text-foreground mt-8 mb-3",
    3: "text-lg font-medium text-foreground mt-6 mb-2",
  };

  return <Tag className={styles[level]}>{children}</Tag>;
}

// Info/note callout
export function Callout({ children, type = "info" }: { children: ReactNode; type?: "info" | "warning" | "tip" }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    tip: "bg-green-50 border-green-200 text-green-900",
  };

  return (
    <div className={cn("my-4 p-4 rounded-lg border", styles[type])}>
      {children}
    </div>
  );
}
