import { codeToHtml } from "shiki";

interface CodeHighlightProps {
  code: string;
  lang?: string;
}

export async function CodeHighlight({ code, lang = "python" }: CodeHighlightProps) {
  const html = await codeToHtml(code, {
    lang,
    theme: "github-light",
  });

  return (
    <div
      className="text-sm [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
