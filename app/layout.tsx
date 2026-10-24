import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { CLERK_LOCALIZATION } from "./components/account/clerkLocalization";
import "./globals.css";
import ClientRoot from "./components/layout/ClientRoot";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Marcos Tasks",
  description: "Tarefas, cronómetro de foco, pausas e estatísticas",
  applicationName: "Marcos Tasks",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Marcos Tasks",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7B61FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className={`${nunito.variable} antialiased`}>
        {/* nas versões actuais do Clerk, o provider fica dentro do <body> */}
        <ClerkProvider
          localization={CLERK_LOCALIZATION}
          signInUrl="/entrar"
          signUpUrl="/entrar"
          appearance={{
            cssLayerName: "clerk",
            variables: {
              colorPrimary: "#7B61FF",
              colorForeground: "#2B2840",
              colorMutedForeground: "#A3A0B8",
              colorInput: "#F7F6FC",
              borderRadius: "1rem",
              fontFamily: "var(--font-nunito), system-ui, sans-serif",
            },
          }}
        >
          <ClientRoot>{children}</ClientRoot>
        </ClerkProvider>
      </body>
    </html>
  );
}
