import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!validId(id)) return Response.json({ error: "Arquivo inválido." }, { status: 400 });

  const path = join(tmpdir(), `newviral-free-${id}.mp4`);
  let info;
  try {
    info = await stat(path);
  } catch {
    return Response.json({ error: "Vídeo temporário não encontrado. Gere novamente." }, { status: 404 });
  }

  const maxAgeMs = 24 * 60 * 60 * 1000;
  if (Date.now() - info.mtimeMs > maxAgeMs) {
    await rm(path, { force: true }).catch(() => {});
    return Response.json({ error: "Este vídeo temporário expirou. Gere novamente." }, { status: 410 });
  }

  const file = await readFile(path);
  const range = request.headers.get("range");
  const common = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "Content-Type": "video/mp4",
    "Content-Disposition": `inline; filename="newviral-${id}.mp4"`,
  };

  if (!range) {
    return new Response(file, { status: 200, headers: { ...common, "Content-Length": String(file.length) } });
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return new Response(null, { status: 416 });

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), file.length - 1) : file.length - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= file.length) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.length}` } });
  }

  const chunk = file.subarray(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      ...common,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${file.length}`,
    },
  });
}
