import { parse } from "csv-parse";
import { readFile, readdir } from "fs/promises";
import { callback } from "awaiting";
import { join } from "path";
import { getZones } from "./zones";
import type { PriceData } from "./parse-pricing";

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

// this location is the single word description NOT the
// location used for zones elsewhere, and it can refer to
// many regions at once, e.g., APAC.
let parsed: {
  [skuDescription: string]: { [location: string]: SKUData };
} | null = null;
let families: { [family: string]: SKUData[] } | null = null;
export async function parsedCsvData() {
  if (parsed != null && families != null) {
    return { parsed, families };
  }
  parsed = {};
  families = {};
  for (const sku of await csvData()) {
    // just in case, we 100% ensure these descriptions are always ascii.
    // Why -- because e.g., "São Paulo" v "Sao Paulo" can be a VERY expensive mistake!
    sku["SKU description"] = toAscii(sku["SKU description"]);

    const taxonomy = sku["Product taxonomy"].split(">");
    const family = taxonomy[taxonomy.length - 1].trim();
    if (families[family] == null) {
      families[family] = [sku];
    } else {
      families[family].push(sku);
    }
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
  return { parsed, families };
}

export async function getPrice({
  desc,
  location,
  family,
}: {
  desc: string; // beginning part of SKU description
  location: string; // location field of ZoneData
  family?: string;
}): Promise<number> {
  const v = location.split(",").map((x) => x.trim());
  if (location.includes("America")) {
    v.push("Americas");
  }
  if (location.includes("Europe")) {
    // EMEA = europe, middle east, africa
    v.push("EMEA");
  }
  const { parsed: csvdata, families } = await parsedCsvData();
  if (family) {
    for (const loc of v) {
      // CRITICAL to first loop over locations, since we need the most specific location where there
      // is pricing data!
      for (const s of families[family] as SKUData[]) {
        if (s["SKU description"].startsWith(desc)) {
          if (s["SKU description"].endsWith("running in " + loc)) {
            return parseFloat(s["List price ($)"]);
          }
        }
      }
    }
    throw Error(
      `unable to find SKU -- description '${desc}' in family '${family}, location '${location}')`,
    );
  }
  const skus = csvdata[desc];
  if (skus == null) {
    throw Error(
      `unable to find SKU with description '${desc}' ${
        family ? " and family " + family : ""
      }`,
    );
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
export async function updateAcceleratorPricing(
  desc: string,
  data: { [zone: string]: number },
  warnOnly = false,
  showWrong = false,
) {
  const zoneData = await getZones();
  for (const zone in data) {
    const { location } = zoneData[zone];
    try {
      const price = await getPrice({ desc, location });
      // uncomment this to show dozens of incidences where's Google's published
      // pricing on their website is dramatically different than the actual prices.
      if (showWrong) {
        if (Math.abs(price - data[zone]) > 0.01) {
          console.log(
            `'${desc}' in '${location}' : published=${data[zone]}, actual=${price}`,
          );
        }
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

export async function getMachineTypePrice({
  machineType,
  spot,
  location,
  vcpu,
  memory,
}) {
  const family = machineType.split("-")[0].toUpperCase();
  for (const label of [
    family + " Instance",
    `${family} Predefined Instance`,
    `${family} AMD Instance`,
    `${family} Arm Instance`,
    `${family} Memory-optimized Instance`,
    "Compute optimized",
    "Memory-optimized Instance",
    "Compute optimized Instance",
  ]) {
    try {
      const perCore = await getPrice({
        desc: `${spot ? "Spot Preemptible " : ""}${label} Core`,
        location,
        family,
      });
      const perGB = await getPrice({
        desc: `${spot ? "Spot Preemptible " : ""}${label} Ram`,
        location,
        family,
      });
      return vcpu * perCore + memory * perGB;
    } catch (_) {}
    // also try without family, e.g., bizarely the family for A2 spot cores is "Highcpu",
    // which is just a crazy weird mistake by google, I guess...
    // But often without the family does work, i.e., description is good enough then
    if (!label.includes(family)) {
      // definitely don't try something without family explicitly in the label!
      continue;
    }
    try {
      const perCore = await getPrice({
        desc: `${spot ? "Spot Preemptible " : ""}${label} Core`,
        location,
      });
      const perGB = await getPrice({
        desc: `${spot ? "Spot Preemptible " : ""}${label} Ram`,
        location,
      });
      return vcpu * perCore + memory * perGB;
    } catch (_) {}
  }
  throw Error(
    `unable to find data about ${machineType} ${
      spot ? "spot" : "on demand"
    } in ${location}`,
  );
}

// Mutate the machine type pricing data in "data"
// to match what is in the csv file, if possible.
export async function updateMachineTypePricing(
  machineType: string,
  data: PriceData,
  warnOnly = true,
  showWrong = true,
) {
  const { vcpu, memory } = data;
  const zoneData = await getZones();
  for (const spot of [false, true]) {
    for (const region in data[spot ? "spot" : "prices"]) {
      const values = data[spot ? "spot" : "prices"];
      if (values == null) {
        continue;
      }

      const zone = getZone(region, zoneData);
      let { location } = zoneData[zone] ?? {};
      // yep non-ascii could cost us a massive amount in losses and tons of stuff is actively wrong.
      location = toAscii(location);
      if (!location) {
        const msg = `Missing zone data for zone '${zone}', when updating pricing about '${machineType}' for region '${region}'.`;
        if (warnOnly) {
          console.warn(msg);
        } else {
          throw Error(msg);
        }
      }
      try {
        const price = await getMachineTypePrice({
          machineType,
          spot,
          location,
          vcpu,
          memory,
        });
        if (showWrong) {
          const diff = price - values[region];
          // only show the ones that are off by at least 10% of the price:
          if (Math.abs(diff / price) > 0.1) {
            console.log(
              `${
                spot ? "Spot " : ""
              } '${machineType}' in '${region}' : diff=${diff}, published=${
                values[region]
              }, actual=${price}`,
            );
          }
        }
        values[region] = price;
      } catch (err) {
        const msg = `**WARNING** -- no data for '${machineType}' ${
          spot ? "spot" : "standard"
        } in '${location}' -- ${err.message}`;
        if (warnOnly) {
          //console.warn(msg);
        } else {
          throw Error(msg);
        }
      }
    }
  }
}

function getZone(region: string, zoneData) {
  for (const x of ["a", "b", "c", "d", "e", "f", "g", "h", "i"]) {
    const zone = region + "-" + x;
    if (zoneData[zone] != null) {
      return zone;
    }
  }
  throw Error(`no zone in region '${region}'`);
}

function toAscii(str: string): string {
  const combining = /[\u0300-\u036F]/g;
  return str.normalize("NFKD").replace(combining, "");
}
