import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeVersion = "1.24.3";
const runtimeRoot = resolve(dirname(fileURLToPath(import.meta.resolve("onnxruntime-web-ocr"))), "..");
const runtimePackage = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
if (runtimePackage.version !== runtimeVersion) throw new Error("Unexpected OCR runtime version.");

// The SDK ships its own ORT inside this worker, independent of the top-level dependency.
const sdkAssets = join(dirname(fileURLToPath(import.meta.resolve("@paddleocr/paddleocr-js"))), "assets");
const workerName = (await readdir(sdkAssets)).find(name => /^worker-entry-.*\.js$/.test(name));
if (!workerName) throw new Error("PaddleOCR worker was not found.");
const worker = await readFile(join(sdkAssets, workerName), "utf8");
if (!worker.includes(`ONNX Runtime Web v${runtimeVersion}`)) {
  throw new Error("PaddleOCR worker changed: update the matching OCR runtime before building.");
}

const destination = join(root, "public", "ocr", "onnxruntime", runtimeVersion);
await mkdir(destination, { recursive: true });
for (const name of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  await copyFile(join(runtimeRoot, "dist", name), join(destination, name));
}
for (const [name, expectedHash] of [
  ["PP-OCRv6_tiny_det.tar", "ff6ab415b0a6e0c488550f2fb5d5046f1719848df220b2dc21b56402a65bc05d"],
  ["PP-OCRv6_tiny_rec.tar", "1e13b22717b1edd89d4cde4fda272b6c17d5b505c97c2baea99da1a3a2d54b29"]
]) {
  const bytes = await readFile(join(root, "public", "ocr", "models", name));
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error(`Invalid OCR model: ${name}`);
}
console.log(`Prepared same-origin OCR runtime ${runtimeVersion}.`);
