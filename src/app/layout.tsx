import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Pipeline Studio - ETL Automation & Data Quality",
  description:
    "ETL automation, data quality monitoring, real-time processing, and pipeline observability for data engineering teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
