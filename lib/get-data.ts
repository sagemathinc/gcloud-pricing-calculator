import { join } from "path";
import { writeFile } from "fs/promises";
import handEdit from "./hand-edit";
import debug from "debug";
import { data } from "./template";

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
  await handEdit(data);
  await writeFile(dataPath, "exports.data=" + JSON.stringify(data));
}
