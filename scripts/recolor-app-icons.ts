/**
 * One-time recolor of the "AC" app icons from the retired cobalt #2749e0 to the
 * deep-royal brand anchor #0842a0 (see the "blue system" note in globals.css).
 *
 *   npx tsx scripts/recolor-app-icons.ts --verify <outDir>   # preview only
 *   npx tsx scripts/recolor-app-icons.ts --apply             # overwrite public/
 *
 * The icons are a bold white "AC" on a solid brand field, so we recolor rather
 * than redesign: a per-channel linear map f(x)=a*x+b that fixes white at white
 * and maps cobalt -> royal. This preserves the white glyph and every
 * anti-aliased edge exactly (no font, no vector source needed). Alpha rides
 * through with an identity coefficient so the rounded-corner mask is untouched.
 *
 * favicon.ico isn't sharp-readable, so it's rebuilt from the 512 source as a
 * 16+32 PNG-in-ICO container (no extra dependency). When there's finally a real
 * vector logo, replace this recolor step with a proper generate-from-SVG script.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const outIdx = process.argv.indexOf("--verify");
const OUT = outIdx !== -1 ? process.argv[outIdx + 1] : null;
if (!APPLY && !OUT) {
  throw new Error("pass --apply or --verify <outDir>");
}

const COBALT = [39, 73, 224]; // #2749e0
const ROYAL = [8, 66, 160]; //  #0842a0
const a = COBALT.map((c, i) => (255 - ROYAL[i]) / (255 - c));
const b = a.map((ai) => 255 - 255 * ai);
const A = [...a, 1]; // RGBA — alpha identity
const B = [...b, 0];

const PNGS = [
  "public/icons/icon-192x192.png",
  "public/icons/icon-512x512.png",
  "public/icons/apple-touch-icon.png",
  "public/apple-touch-icon.png",
];

function remap(inputPath: string) {
  return sharp(inputPath).linear(A, B);
}

async function sample(buf: Buffer, points: Array<[number, number]>) {
  const { data, info } = await sharp(buf)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return points.map(([x, y]) => {
    const i = (y * info.width + x) * info.channels;
    return `(${x},${y})=rgba(${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]})`;
  });
}

// Minimal PNG-in-ICO container builder.
function buildIco(entries: Array<{ size: number; png: Buffer }>) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o);
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
    dir.writeUInt16LE(1, o + 4); // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

async function main() {
  if (OUT) await mkdir(OUT, { recursive: true });
  console.log("linear A(RGBA):", A.map((n) => n.toFixed(4)).join(", "));
  console.log("linear B(RGBA):", B.map((n) => n.toFixed(2)).join(", "));

  // Idempotency guard: the map assumes a COBALT source. Running it against
  // already-royal icons would double-apply it (red+blue clamp to 0 → green), so
  // refuse if the 512's background isn't cobalt.
  const g = await sharp(path.join(ROOT, "public/icons/icon-512x512.png"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gi = (256 * g.info.width + 20) * g.info.channels; // left-edge background
  const [gr, gg, gb] = [g.data[gi], g.data[gi + 1], g.data[gi + 2]];
  if (Math.hypot(gr - 39, gg - 73, gb - 224) > 30) {
    throw new Error(
      `icon-512 background is rgb(${gr},${gg},${gb}), not cobalt #2749e0 — ` +
        `icons look already recolored. Refusing to double-remap.`,
    );
  }

  let icon512Png: Buffer | null = null; // reused for the favicon (never re-read)
  for (const rel of PNGS) {
    const buf = await remap(path.join(ROOT, rel)).png().toBuffer();
    const meta = await sharp(buf).metadata();
    if (rel.endsWith("icon-512x512.png")) {
      icon512Png = buf;
      const pts = await sample(buf, [
        [20, 256], // left edge — background (expect royal)
        [256, 40], // top edge — background (expect royal)
      ]);
      console.log("   512 samples:", pts.join("  "));
    }
    const dest = APPLY
      ? path.join(ROOT, rel)
      : path.join(OUT!, rel.replace(/\//g, "__"));
    await writeFile(dest, buf);
    console.log(
      `   ${APPLY ? "wrote" : "preview"} ${rel} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`,
    );
  }

  // Build the favicon from the already-remapped 512 BUFFER — never re-read the
  // file. In --apply the file has just been overwritten with royal, so
  // remapping it again would double-apply the map and turn the icon green.
  const faviconSrc = sharp(icon512Png!);
  const png32 = await faviconSrc.clone().resize(32, 32).png().toBuffer();
  const png16 = await faviconSrc.clone().resize(16, 16).png().toBuffer();
  const ico = buildIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
  ]);
  const icoDest = APPLY
    ? path.join(ROOT, "public/favicon.ico")
    : path.join(OUT!, "public__favicon.ico");
  await writeFile(icoDest, ico);
  console.log(
    `   ${APPLY ? "wrote" : "preview"} public/favicon.ico (${ico.length} bytes)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
