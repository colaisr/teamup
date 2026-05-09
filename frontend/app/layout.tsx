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
    <html lang="ru" data-theme="dark">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("teamup_theme");if(t!=="light"&&t!=="dark"){t="dark";}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(_){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}})();`,
          }}
        />
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}

