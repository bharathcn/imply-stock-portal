import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMPLY Stock Portal",
  description: "Secure read-only stock and custom price portal for IMPLY sales teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
