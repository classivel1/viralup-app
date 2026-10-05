import { providerConfig } from "../../../../lib/studio";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = providerConfig();
  return Response.json({
    appName: "ViralUp Studio",
    mode: p.pollinations || p.ffmpeg || p.gemini || p.runway || p.fal || p.openai ? "live" : "demo",
    providers: { pollinations: p.pollinations, ffmpeg: p.ffmpeg, gemini: p.gemini, runway: p.runway, fal: p.fal, openai: p.openai },
    auth: p.supabase,
    billing: p.mercadopago && p.supabase,
    videoDefault: p.pollinations ? "Pollinations" : p.ffmpeg ? "FFmpeg Local" : p.runway ? "Runway Gen-4.5" : p.gemini ? "Veo 3.1" : p.fal ? "Kling 2.6" : "Demo",
    openaiVideo: false,
    openaiVideoNote: "Videos API/Sora 2 removido em 24/09/2026; OpenAI é usado apenas em recursos atuais de imagem/texto.",
  });
}
