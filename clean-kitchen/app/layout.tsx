import "@/styles/globals.css";

export const metadata = { title: "Clean-Kitchen" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lv">
      <body>{children}</body>
    </html>
  );
}
