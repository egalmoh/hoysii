import localFont from "next/font/local";
import "./globals.css";
const inter = localFont({
  src: [
    { path: "../../../packages/management-ui/fonts/Inter_400Regular.ttf", weight: "400" },
    { path: "../../../packages/management-ui/fonts/Inter_700Bold.ttf", weight: "700" },
  ],
  variable: "--font-inter",
});
export const metadata = {
  title: "Hoysii Hotel Partners",
  description: "Manage your Hoysii property and reservations.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
