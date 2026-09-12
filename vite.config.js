import { defineConfig } from "vite";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  define: {
    __REFERENCE_STUDY_AVAILABLE__: JSON.stringify([
      './artifacts/reference/portrait-study.png',
      './artifacts/reference/motion-study.mp4',
    ].every(path => existsSync(fileURLToPath(new URL(path, import.meta.url))))),
  },
  build: { target: "es2022" },
  plugins: [
    {
      name: "local-reference-study",
      configureServer(server) {
        const files = new Map([
          [
            "/__reference-study/portrait.png",
            ["./artifacts/reference/portrait-study.png", "image/png"],
          ],
          [
            "/__reference-study/motion.mp4",
            ["./artifacts/reference/motion-study.mp4", "video/mp4"],
          ],
        ]);
        server.middlewares.use(async (request, response, next) => {
          const entry = files.get(
            new URL(request.url, "http://localhost").pathname,
          );
          if (!entry) return next();
          if (
            !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
              request.socket.remoteAddress,
            )
          ) {
            response.statusCode = 403;
            response.end();
            return;
          }
          try {
            const file = fileURLToPath(new URL(entry[0], import.meta.url));
            const info = await stat(file);
            let start = 0;
            let end = info.size - 1;
            response.setHeader("Accept-Ranges", "bytes");
            if (request.headers.range) {
              const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
              const valid = range && (range[1] || range[2]);
              if (valid) {
                if (range[1]) {
                  start = Number(range[1]);
                  end = range[2] ? Math.min(Number(range[2]), end) : end;
                } else start = Math.max(0, info.size - Number(range[2]));
              }
              if (!valid || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
                response.statusCode = 416;
                response.setHeader("Content-Range", `bytes */${info.size}`);
                response.end();
                return;
              }
              response.statusCode = 206;
              response.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
            }
            response.setHeader("Content-Type", entry[1]);
            response.setHeader("Content-Length", end - start + 1);
            response.setHeader("Cache-Control", "no-store");
            if (request.method === "HEAD") {
              response.end();
              return;
            }
            createReadStream(file, { start, end })
              .on("error", () => response.destroy())
              .pipe(response);
          } catch {
            response.statusCode = 404;
            response.end("Local reference study asset unavailable");
          }
        });
      },
    },
  ],
});
