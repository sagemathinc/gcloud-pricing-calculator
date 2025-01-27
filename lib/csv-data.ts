import { parse } from "csv-parse";
import { readFile, readdir } from "fs/promises";
import { callback } from "awaiting";
import { join } from "path";
import { getZones } from "./zones";
import type { PriceData } from "./parse-pricing";
import type { DiskData } from "./disk-pricing";

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

    // We filter out "Cores: Per Core", since it holds no info we are using and its
    // position is inconsistent!
    // E.g., compare H100 and A100:
    //     GCP > Compute > GPUs > GPUs On Demand > H100 > Cores: Per Core
    //     GCP > Compute > GCE > VMs On Demand > Cores: Per Core > A2

    const taxonomy = sku["Product taxonomy"]
      .split(">")
      .filter((x) => !x.includes("Cores:"));
    let family = taxonomy[taxonomy.length - 1].trim();
    if (family == "H100") {
      // for some reason google calls it "H100" instead of A3, since GCP SKU's seem
      // pretty weird, so we just fix it.
      //     'Google service': 'GCP',
      //     'Service description': 'Compute Engine',
      //     'Service ID': '6F81-5844-456A',
      //     'SKU ID': '8ECF-1E73-7170',
      //     'SKU description': 'A3 Instance Core running in Milan',
      //     'Product taxonomy': 'GCP > Compute > GPUs > GPUs On Demand > H100 > Cores: Per Core',
      family = "A3";
    }
    if (families[family] == null) {
      families[family] = [sku];
    } else {
      families[family].push(sku);
    }
    let v = sku["SKU description"].split("running in");
    if (v.length < 2) {
      // we only need data about running items, e.g., CPU's and GPU's,
      // also local ssd, and google cloud storage
      if (sku["SKU description"].includes("SSD backed Local Storage")) {
        v = sku["SKU description"].split(" in ");
      } else {
        if (sku["Service description"] != "Cloud Storage") {
          continue;
        }
      }
    }
    const desc = v[0].trim();
    let z = parsed[desc];
    if (z == null) {
      z = parsed[desc] = {};
    }
    z[(v[1] ?? "").trim()] = sku;
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
  if (skus[""] != null) {
    // local ssd have '' as global location fallback
    return parseFloat(skus[""]["List price ($)"]);
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
  warn = false,
  error = false,
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
      if (warn) {
        console.warn(msg);
      }
      if (error) {
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
  warn = false,
  error = false,
  showWrong = false,
) {
  if (
    // NOTE: our non-spot scraped a2- and g2- prices include the GPU, so they are
    // always very wrong (way too big), and get fixed here.  No need to report that.
    // This is just because this is a weird edge case where google put the gpu price into
    // the VM price in the table on the website.
    machineType.startsWith("a2-") ||
    machineType.startsWith("g2-")
  ) {
    showWrong = false;
  }

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
        if (warn) {
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
        if (warn) {
          console.warn(msg);
        }
        if (error) {
          throw Error(msg);
        }
      }
    }
  }
}

export function getZone(region: string, zoneData) {
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

// mutates disk data, making it same as what is in the csv SKU data,
// and filling in spot pricing.
// TODO: we do not actually check any prices with csv sku except for local ssd.
export async function updateDiskPricing(data: DiskData) {
  const desc = "SSD backed Local Storage";
  const spotDesc = `${desc} attached to Spot Preemptible VMs`;
  const zoneData = await getZones();

  // local ssd prices
  const spot: { [region: string]: number } = {};
  data["local-ssd"].spot = spot;
  for (const region in data["local-ssd"].prices) {
    let zone;
    try {
      zone = getZone(region, zoneData);
    } catch (_) {
      // e.g., right now google's 'africa-south1' only half exists.
      continue;
    }
    const { location } = zoneData[zone];
    const spotPrice = (await getPrice({ desc: spotDesc, location })) / 730;
    spot[region] = spotPrice;
    const price = (await getPrice({ desc, location })) / 730;
    const cur = data["local-ssd"].prices[region];
    if (cur != price) {
      data["local-ssd"].prices[region] = price;
      if (Math.abs(cur - price) >= 0.01) {
        console.log(
          `changing local-ssd price for ${region} from ${cur} to ${price}`,
        );
      }
    }
  }
}

export async function getStorageAtRestPricing() {
  const { parsed } = await parsedCsvData();
  const multiRegions = {};
  const regions = {};
  const dualRegions = {};
  // todo: dual regions
  for (const location of ["US", "EU", "Asia"]) {
    const prices = {};
    multiRegions[location.toLowerCase()] = prices;
    for (const cls of ["Standard", "Nearline", "Coldline", "Archive"]) {
      let SKUdescription = `${cls} Storage ${location} Multi-region`;
      let p = parsed[SKUdescription];
      if (p == null) {
        if (location == "EU") {
          // sometimes EU is "Europe"
          SKUdescription = `${cls} Storage Europe Multi-region`;
          p = parsed[SKUdescription];
        }
        if (p == null) {
          throw Error(`missing data for "${SKUdescription}"`);
        }
      }
      const s = p[""];
      const cost = parseFloat(s["List price ($)"]);
      prices[cls] = cost;
    }
  }

  const zoneData = await getZones();
  for (const zone in zoneData) {
    let location = toAscii(zoneData[zone].location);
    const region = zone.slice(0, zone.lastIndexOf("-"));
    const prices = {};
    regions[region] = prices;
    for (const cls of ["Standard", "Nearline", "Coldline", "Archive"]) {
      // "Nearline Storage Oregon"
      const place = location.split(",")[0].trim();
      let SKUdescription = `${cls} Storage ${place}`;
      let p = parsed[SKUdescription];
      if (p == null) {
        // try second part of name
        const place = location
          .split(",")[1]
          .trim()
          .replace("Virginia", "Northern Virginia");
        SKUdescription = `${cls} Storage ${place}`;
        p = parsed[SKUdescription];
        if (p == null) {
          // try prefixing with Autoclass, since pricing is the same
          const place = location.split(",")[1].trim();
          SKUdescription = `Autoclass ${cls} Storage ${place}`;
          p = parsed[SKUdescription];
          if (p == null) {
            console.log({ zone, data: zoneData[zone] });
            throw Error(`missing data for zone="${zone}", cls="${cls}"`);
          }
        }
      }
      const s = p[""];
      const cost = parseFloat(s["List price ($)"]);
      prices[cls] = cost;
    }
  }

  for (const zone in zoneData) {
    let location = toAscii(zoneData[zone].location);
    const region = zone.slice(0, zone.lastIndexOf("-"));
    const prices = {};
    dualRegions[region] = prices;
    for (const cls of ["Standard", "Nearline", "Coldline", "Archive"]) {
      // "Nearline Storage Oregon Dual-region"
      const place = location.split(",")[0].trim();
      let SKUdescription = `${cls} Storage ${place} Dual-region`;
      let p = parsed[SKUdescription];
      if (p == null) {
        // try second part of name
        const place = location
          .split(",")[1]
          .trim()
          .replace("Virginia", "Northern Virginia");
        SKUdescription = `${cls} Storage ${place} Dual-region`;
        p = parsed[SKUdescription];
        if (p == null) {
          // try prefixing with Autoclass, since pricing is the same
          const place = location.split(",")[1].trim();
          SKUdescription = `Autoclass ${cls} Storage ${place} Dual-region`;
          p = parsed[SKUdescription];
          if (p == null) {
            // for dual regions a lot are missing.
            continue;
          }
        }
      }
      const s = p[""];
      const cost = parseFloat(s["List price ($)"]);
      prices[cls] = cost;
    }
  }

  return { multiRegions, regions, dualRegions };
}
