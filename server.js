import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("combined"));
app.use(express.json({ limit: "2mb" }));

// Pasta onde os vídeos serão salvos
const videosDir = path.join(process.cwd(), "videos");
fs.mkdirSync(videosDir, { recursive: true });
app.use("/videos", express.static(videosDir));

function pickSize(orientation) {
  if (orientation === "horizontal") {
    return { w: 1280, h: 720 };
  }
  return { w: 720, h: 1280 }; // vertical
}

app.post("/render", async (req, res) => {
  try {
    const { orientation, title, watermark, questions } = req.body || {};

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "Dados inválidos para gerar vídeo" });
    }

    const { w, h } = pickSize(orientation);
    const id = uuidv4();
    const output = path.join(videosDir, `${id}.mp4`);

    // Cria um vídeo simples (fundo sólido) – FFmpeg
    const args = [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=black:s=${w}x${h}:d=5`,
      "-pix_fmt", "yuv420p",
      "-c:v", "libx264",
      output
    ];

    await execFileAsync("ffmpeg", args);

    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    const videoUrl = `${baseUrl}/videos/${id}.mp4`;

    return res.json({ ok: true, videoUrl });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Render API rodando na porta ${PORT}`);
});
