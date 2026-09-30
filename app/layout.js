import "./globals.css";

export const metadata = {
  title: "ViralUp Studio",
  description: "Pipeline de vídeos verticais autorizados"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
