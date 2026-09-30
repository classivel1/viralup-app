import { NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const maxDuration = 120;

const execFileAsync = promisify(execFile);
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request) {
  let inputPath;
  let outputPath;

  try {
    const data = await request.formData();
    const file = data.get("video");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Vídeo não enviado." }, { status: 400 });
    }
    if (!file.type?.startsWith("video/")) {
      return NextResponse.json({ error: "O arquivo precisa ser um vídeo." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "O limite atual é 25 MB por vídeo." }, { status: 413 });
    }

    const id = randomUUID();
    inputPath = join(tmpdir(), `viralup-${id}-input`);
    outputPath = join(tmpdir(), `viralup-${id}.mp4`);
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    const font = "/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf";
    const vf = [
      "scale=1080:1920:force_original_aspect_ratio=decrease",
      "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
      "setsar=1",
      `drawtext=fontfile=${font}:text='ViralUp':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.35:boxborderw=12:x=w-tw-36:y=36`,
      `drawtext=fontfile=${font}:text='@ViralUp':fontcolor=white:fontsize=30:box=1:boxcolor=black@0.30:boxborderw=10:x=32:y=h-th-36`
    ].join(",");

    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath
    ], { timeout: 110000, maxBuffer: 4 * 1024 * 1024 });

    const output = await readFile(outputPath);
    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="viralup-9x16.mp4"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("ViralUp processing error:", error);
    return NextResponse.json({ error: "Não foi possível processar este vídeo agora." }, { status: 500 });
  } finally {
    if (inputPath) await unlink(inputPath).catch(() => {});
    if (outputPath) await unlink(outputPath).catch(() => {});
  }
}
