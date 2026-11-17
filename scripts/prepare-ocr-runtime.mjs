import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
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
for (const name of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"]) {
  await copyFile(join(runtimeRoot, "dist", name), join(destination, name));
}
console.log(`Prepared same-origin OCR runtime ${runtimeVersion}.`);
