import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tviz | Tinker Training Visualization",
  description: "Training visualization dashboard for Thinking Machines Tinker API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
