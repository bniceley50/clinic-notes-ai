import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinic Notes AI",
  description: "AI-powered clinical documentation — CareLogic companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Arial system font matches Qualifacts CareLogic exactly */}
      <body style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
