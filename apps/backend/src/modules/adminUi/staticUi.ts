import path from "node:path";
import fs from "node:fs";
import express from "express";

/**
 * Serves the built embedded admin UI (apps/admin/dist) from the backend.
 *
 * Trade-off: keeps deployment simple (single web service). In development, run the Vite
 * dev server separately if you want HMR.
 */
export function registerAdminUiStatic(app: express.Express) {
  const adminDist = path.join(__dirname, "..", "..", "..", "..", "admin", "dist");
  const indexHtml = path.join(adminDist, "index.html");

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(adminDist));
    app.get("/", (_req, res) => res.sendFile(indexHtml));
    return;
  }

  // Fail safe in environments where the UI build hasn't been produced yet.
  app.get("/", (_req, res) =>
    res
      .status(200)
      .send("BundleCart admin UI not built. Build apps/admin and redeploy.")
  );
}

