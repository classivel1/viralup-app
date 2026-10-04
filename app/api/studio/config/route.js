import { providerConfig } from "../../../../lib/studio";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = providerConfig();
  return Response.json({
    appName: "ViralUp Studio",
    mode: p.gemini || p.fal || p.openai ? "live" : "demo",
    providers: { gemini: p.gemini, fal: p.fal, openai: p.openai },
    auth: p.supabase,
    billing: p.mercadopago && p.supabase,
    videoDefault: p.gemini ? "Veo 3.1" : p.fal ? "Kling 2.6" : "Demo",
    openaiVideo: false,
    openaiVideoNote: "Videos API/Sora 2 removido em 24/09/2026; OpenAI é usado apenas em recursos atuais de imagem/texto.",
  });
}
