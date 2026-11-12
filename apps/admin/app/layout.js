import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { ConditionalNavbar } from "@/components/conditional-navbar";
import { StakeholderNotice } from "@/components/stakeholder-notice";
import { AuthProvider } from "@/components/auth-provider";

const inter = localFont({
  src: [
    { path: "../../../packages/management-ui/fonts/Inter_400Regular.ttf", weight: "400" },
    { path: "../../../packages/management-ui/fonts/Inter_700Bold.ttf", weight: "700" },
  ],
  variable: "--font-inter",
});

export const metadata = {
  title: "Hoysii Admin",
  description: "Manage Hoysii properties, bookings, and guests.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <ConditionalNavbar />
            <StakeholderNotice />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
