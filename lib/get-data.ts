import { parsePricingData, machineTypeToPriceData } from "./parse-pricing";
import cacache from "cacache";
import { join } from "path";
import handEdit from "./hand-edit";
import debug from "debug";

const log = debug("gcloud-info");

const cachePath = join(__dirname, "cache");

const DEFAULT_CACHE_DAYS = 1;

export async function getData(maxAgeDays: number = DEFAULT_CACHE_DAYS) {
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
  log("parsing data");
  const raw = await parsePricingData();
  const data = machineTypeToPriceData(raw);
  handEdit(data);
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
