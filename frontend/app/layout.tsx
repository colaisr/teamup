import "./globals.css";
import { ReactNode } from "react";
import LayoutWrapper from "@/components/LayoutWrapper";
import Providers from "@/components/Providers";

export const metadata = {
  title: "TeamUp",
  description: "Engineering Process Optimization Platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}

