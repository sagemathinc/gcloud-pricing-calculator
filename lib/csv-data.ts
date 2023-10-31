import { parse } from "csv-parse";
import { readFile, readdir } from "fs/promises";
import { callback } from "awaiting";
import { join } from "path";
import { getZones } from "./zones";

interface SKUData {
  "SKU ID": string;
  "SKU description": string;
  "Product taxonomy": string;
  "Unit description":
    | "hour"
    | "month"
    | "count"
    | "gibibyte month"
    | "gibibyte"
    | "gibibyte hour";
  "Per unit quantity": "1" | "gibibyte hour";
  "List price ($)": string;
}

let csvdata: any = null;
export async function csvData() {
  if (csvdata != null) {
    return csvdata;
  }
  const dirPath = join(__dirname, "../../data/");
  const files = await readdir(dirPath);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));
  csvFiles.sort();
  const largestFile = csvFiles[csvFiles.length - 1]; // last file after sorting in alphabetic ascending order
  const data = await readFile(join(dirPath, largestFile));

  const f = (cb) => {
    parse(data, { columns: true }, cb);
  };
  csvdata = await callback(f);
  return csvdata;
}

let parsed: any = null;

export async function parsedCsvData(): Promise<{
  // this location is the single word description NOT the
  // location used for zones elsewhere, and it can refer to
  // many regions at once, e.g., APAC.
  [skuDescription: string]: { [location: string]: SKUData };
}> {
  if (parsed != null) {
    return parsed;
  }
  parsed = {};
  for (const sku of await csvData()) {
    const v = sku["SKU description"].split("running in");
    if (v.length < 2) {
      // we only need data about running items, e.g., CPU's and GPU's
      continue;
    }
    const desc = v[0].trim();
    let z = parsed[desc];
    if (z == null) {
      z = parsed[desc] = {};
    }
    z[v[1].trim()] = sku;
  }
  return parsed;
}

export async function getPrice({
  desc,
  location,
}: {
  desc: string; // beginning part of SKU description
  location: string; // location field of ZoneData
}): Promise<number> {
  const csvdata = await parsedCsvData();
  const skus = csvdata[desc];
  if (skus == null) {
    throw Error(`unable to find SKU with description '${desc}'`);
  }
  const v = location.split(",").map((x) => x.trim());
  if (location.includes("America")) {
    v.push("Americas");
  }
  if (location.includes("Europe")) {
    // EMEA = europe, middle east, africa
    v.push("EMEA");
  }
  for (const loc of v) {
    if (skus[loc] != null) {
      return parseFloat(skus[loc]["List price ($)"]);
    }
  }
  throw Error(
    `unable to find SKU with location '${location}' (did find description)`,
  );
}

// Mutate the prices and spot maps, based on the csv data,
// using the given rules to search into the csv data.
// If any price is NOT in the csv data, a big warning is displayed.
export async function updatePricing(
  desc: string,
  data: { [zone: string]: number },
  warnOnly = false,
) {
  const zoneData = await getZones();
  for (const zone in data) {
    const { location } = zoneData[zone];
    try {
      const price = await getPrice({ desc, location });
      if (Math.abs(price - data[zone]) > 0.01) {
        console.log(
          `'${desc}' in '${location}' : published=${data[zone]}, actual=${price}`,
        );
      }
      data[zone] = price;
    } catch (err) {
      const msg = `**WARNING** -- no data for '${desc}' in '${location}' -- ${err.message}`;
      if (warnOnly) {
        console.warn(msg);
      } else {
        throw Error(msg);
      }
    }
  }
}
