import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "tviz | RL Training Visualization",
  description: "Local dashboard for visualizing RL training runs",
  openGraph: {
    title: "tviz | RL Training Visualization",
    description: "Local dashboard for visualizing RL training runs",
    images: ["/screencap.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/screencap.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
