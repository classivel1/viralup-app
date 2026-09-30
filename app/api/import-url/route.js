import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:");
  }
  return true;
}

async function validateUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("Link inválido."); }
  if (!["http:","https:"].includes(url.protocol)) throw new Error("Use um link http ou https.");
  if (url.username || url.password) throw new Error("Link com credenciais não é permitido.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) throw new Error("Host local não permitido.");
  const records = await lookup(host, { all: true, verbatim: true });
  if (!records.length || records.some((r)=>isPrivateIp(r.address))) throw new Error("Endereço de rede não permitido.");
  return url;
}

async function safeFetch(startUrl) {
  let current = await validateUrl(startUrl);
  for (let i=0; i<=MAX_REDIRECTS; i++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "ViralUp/1.0 authorized-media-importer",
        "Accept": "video/*,application/octet-stream;q=0.8"
      },
      cache: "no-store"
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento inválido.");
      current = await validateUrl(new URL(location, current).toString());
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Muitos redirecionamentos.");
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "Cole o link direto do vídeo." }, { status: 400 });

    const { response, finalUrl } = await safeFetch(url);
    if (!response.ok) return NextResponse.json({ error: `O servidor do vídeo respondeu ${response.status}.` }, { status: 400 });

    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const allowedByType = type.startsWith("video/");
    const allowedByExt = /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(finalUrl.pathname + finalUrl.search);
    if (!allowedByType && !allowedByExt) {
      return NextResponse.json({ error: "Esse endereço não é um link direto de vídeo. Use a URL do arquivo de mídia autorizado." }, { status: 415 });
    }

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return NextResponse.json({ error: "O vídeo ultrapassa o limite atual de 25 MB." }, { status: 413 });

    const reader = response.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Não foi possível ler o vídeo." }, { status: 400 });

    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "O vídeo ultrapassa o limite atual de 25 MB." }, { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }

    const buffer = Buffer.concat(chunks);
    const pathName = finalUrl.pathname.split("/").pop() || "video.mp4";
    const cleanName = decodeURIComponent(pathName).replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "video.mp4";
    const contentType = allowedByType ? type : "video/mp4";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${cleanName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("URL import error:", error);
    return NextResponse.json({ error: error.message || "Não foi possível importar esse vídeo." }, { status: 400 });
  }
}
