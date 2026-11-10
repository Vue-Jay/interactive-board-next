import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const server = await createServer({
  configFile: "./vite.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const catalog = await server.ssrLoadModule("/src/lektrusSkinSpecimenCatalog.ts");
  const specimen = catalog.SKIN_REFERENCE_SPECIMENS.find((item) => item.id === "connective");
  assert.ok(specimen, "The human dermal connective-tissue slide must be catalogued");
  assert.equal(specimen.speciesVerified, "human");
  assert.equal(specimen.siteVerified, null, "Do not invent the biopsy site");
  assert.equal(specimen.skinType, null, "The slide is not labelled thin or thick skin");
  assert.equal(specimen.micronsPerPixel, 400 / 1200);
  assert.match(specimen.stainVerified, /альдегид-фуксин.*Orange G.*Light Green/iu);
  assert.equal(specimen.licenseName, "CC BY 4.0");

  const assetPath = path.resolve("src/assets/bio-atlas/specimens/skin-human-wellcome-connective-1200.jpg");
  const provenancePath = path.resolve("src/assets/bio-atlas/specimens/wellcome-human-skin-connective-provenance.txt");
  const [asset, provenance, assetStats] = await Promise.all([
    readFile(assetPath),
    readFile(provenancePath, "utf8"),
    stat(assetPath),
  ]);
  const sha256 = createHash("sha256").update(asset).digest("hex");
  assert.equal(sha256, specimen.fileSha256);
  assert.ok(assetStats.size < 500_000, "The local specimen image must stay below 500 KB");
  assert.match(provenance, /Creative Commons Attribution 4\.0/u);
  assert.match(provenance, new RegExp(sha256, "i"));
  console.log("Skin specimen catalog PASS: verified human sample, known stain and 400 µm source width, CC BY attribution, offline asset checksum, and no invented anatomical site.");
} finally {
  await server.close();
}
