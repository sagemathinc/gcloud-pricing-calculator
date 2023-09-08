import { fetchPricingData, parsePricingData } from "./parse-pricing";
import { fetchGpuData, parseGpuData } from "./gpu-pricing";
import cacache from "cacache";
import { join } from "path";
import debug from "debug";

const log = debug("gcloud-info");

const cachePath = join(__dirname, "cache");

export async function getData(maxAgeDays: number = 7) {
  log("checking for cached data");
  let x;
  try {
    const z = await cacache.get(cachePath, "data");
    x = JSON.parse(z.data);
  } catch {
    x = null;
  }
  if (x == null || (Date.now() - x.time) / (1000 * 60 * 60 * 24) > maxAgeDays) {
    return await updateData();
  }
  log("using cached data");
  return x.data;
}

async function updateData() {
  log("downloading data");
  const body = await fetchPricingData();
  log("parsing data");
  const data = await parsePricingData(body);
  log("downloading gpu data");
  const gpu = await fetchGpuData(data.gpus);
  log("parsing gpu data");
  data.gpus = await parseGpuData(gpu);
  await cacache.put(
    cachePath,
    "data",
    JSON.stringify({
      time: Date.now(),
      data,
    }),
  );
  return data;
}
