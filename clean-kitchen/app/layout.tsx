import "@/styles/globals.css";
import Navbar from "@/components/navbar";

export const metadata = {
  title: {
    default: "Clean-Kitchen",
    template: "%s • Clean-Kitchen",
  },
  description: "Smart kitchen assistant (pantry, recipes, expiry).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lv">
      <body className="bg-gray-50 text-gray-900">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
