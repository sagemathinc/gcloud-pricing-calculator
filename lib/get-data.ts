import { parsePricingData, machineTypeToPriceData } from "./parse-pricing";
import { join } from "path";
import { writeFile } from "fs/promises";
import handEdit from "./hand-edit";
import debug from "debug";

const log = debug("gcloud-info");

const dataPath = join(__dirname, "data.js");

export async function getData() {
  try {
    return require("./data").data;
  } catch (_) {
    await updateData();
  }
  return require("./data").data;
}

export async function updateData() {
  log("parsing data");
  const raw = await parsePricingData();
  const data = machineTypeToPriceData(raw);
  await handEdit(data);
  await writeFile(dataPath, "exports.data=" + JSON.stringify(data));
}
