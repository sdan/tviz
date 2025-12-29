export const dynamic = "force-dynamic";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="max-w-4xl">
        {children}
      </div>
    </div>
  );
}
