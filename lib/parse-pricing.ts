/*
First we download the pricing html page using the fetch api from as text:

   https://cloud.google.com/compute/all-pricing,

and much more.
*/

import cheerio from "cheerio";
import { fetchGpuData, parseGpuData } from "./gpu-pricing";
import { getDisks } from "./disk-pricing";
import { getZones, ZoneData } from "./zones";

async function fetchPricingData() {
  const gcloudUrl = "https://cloud.google.com/compute/all-pricing";
  const response = await fetch(gcloudUrl, {
    headers: {
      "Accept-Language": "en-US",
    },
  });
  const body = await response.text();
  return body;
}

export async function parsePricingData() {
  const body = await fetchPricingData();
  // Use cheerio to load the HTML
  const $ = cheerio.load(body);
  const tables: any[] = [];

  for (const x of $("cloudx-pricing-table")) {
    const data = $(x);
    const tableLayout = data.attr("layout");
    if (!tableLayout) {
      continue;
    }
    const json = tableLayout
      .replace(/True/g, "true")
      .replace(/False/g, "false")
      .replace(/'/g, '"');
    const layout = JSON.parse(json);
    if (layout?.rows) {
      const type = data.prev().attr("id") ?? "";
      if (
        type.includes("image") ||
        type.includes("disk") ||
        type.includes("localssd")
      ) {
        // These are templated in some mysterious way so the data isn't available
        // to parse out of the raw html, so we just delete them.
        continue;
      }
      if (tables[type] != null) {
        console.log("warning -- overwriting", type);
      }
      tables.push(layout.rows);
    }
  }

  // The gpu data is stored in a separate iframe in a different format.
  // This gets fixed later.
  const gpuUrl = $("iframe").attr("src");
  let gpus;
  if (!gpuUrl) {
    console.warn("GPU data is missing");
    gpus = {};
  } else {
    gpus = await parseGpuData(await fetchGpuData(gpuUrl));
  }

  const disks = await getDisks();
  const zones = await getZones();

  return {
    tables,
    gpus,
    disks,
    zones,
  };
}

const PREFIX = [
  "us",
  "europe",
  "asia",
  "northamerica",
  "southamerica",
  "australia",
  "me",
  "africa",
];

function toRegion(key: string): string {
  if (key.includes("-")) return key;
  for (const prefix of PREFIX) {
    if (key.startsWith(prefix)) {
      return `${prefix}-${key.slice(prefix.length)}`;
    }
  }
  throw Error(`unknown region: "${key}"`);
}

function formatCostMap(costMap?: { [region: string]: string }):
  | {
      [region: string]: number;
    }
  | undefined {
  if (costMap == null) {
    return costMap;
  }
  const result = {};
  for (const key in costMap) {
    result[toRegion(key)] = parseFloat(costMap[key]);
  }
  return result;
}

export interface PriceData {
  prices?: { [region: string]: number };
  spot?: { [region: string]: number };
  vcpu?: number;
  memory?: number;
  count?: number; // for gpu's only
  max?: number; // for gpu's only
}

function toInteger(s?: string): number | undefined {
  if (s == null) return s;
  return parseInt(s.split(" ")[0]);
}

export function machineTypeToPriceData({ tables, gpus, disks, zones }): {
  machineTypes: { [machineType: string]: PriceData };
  disks: {
    "pd-standard": { prices: { [zone: string]: number } };
    "pd-ssd": { prices: { [zone: string]: number } };
    "pd-balanced": { prices: { [zone: string]: number } };
  };
  accelerators: { [acceleratorType: string]: PriceData };
  zones: { [zone: string]: ZoneData };
} {
  const machineTypes: { [name: string]: PriceData } = {};

  for (const rows of tables) {
    let foundOnDemand = false;
    const headings = rows[0].cells.map((heading) => {
      if (!foundOnDemand && heading.toLowerCase().includes("price")) {
        // For some reason there are a dozen choices for the column headings for non-spot instances.
        // It's always the first one that contains "price", I think.
        foundOnDemand = true;
        return "on-demand";
      }
      return heading.split(" ")[0].toLowerCase().split("(")[0];
    });
    if (headings[0] != "machine") {
      // this is part of table given how to make a custom machine type
      continue;
    }
    for (let i = 1; i < rows.length; i++) {
      const { cells } = rows[i];
      if (cells[0].includes("custom-machine-type")) {
        continue;
      }
      const row: any = {};
      for (let j = 0; j < headings.length; j++) {
        row[headings[j]] = cells[j];
      }
      const machineType = row.machine.split(" ")[0];
      let vcpu = toInteger(row.virtual ?? row.vcpu ?? row.vcpus ?? row.cores);

      // There's a special case with pricing for the shared cpu cases, which are
      // e2-micro, e2-small, e2-medium, where the vcpu that is the input for
      // computing the spot price is 0.25, 0.5, 1, respectively.
      if (machineType == "e2-micro") {
        vcpu = 0.25;
      } else if (machineType == "e2-small") {
        vcpu = 0.5;
      } else if (machineType == "e2-medium") {
        vcpu = 1;
      }

      // VERY important to get the actual amount of memory, and not just round to an integer
      // since we will use this later when recomputing all the prices based on the SKU data!
      const memory = parseFloat(row["memory"]);
      const prices = formatCostMap(
        (row.price ?? row["on-demand"])?.priceByRegion,
      );
      machineTypes[machineType] = {
        prices,
        spot: {}, // gets filled in based on data/pricing.csv; assume initially no discount
        vcpu,
        memory,
      };
    }
  }
  const accelerators: { [acceleratorType: string]: PriceData } = {};
  for (const name in gpus) {
    const d = gpus[name];
    accelerators[toApiAcceleratorType(name)] = {
      ...d,
      prices: formatCostMap(d.prices),
      spot: formatCostMap(d.spot),
    };
  }

  for (const name in disks) {
    // makes the format consistent with the PriceData interface,
    // and also makes it easy to add more data about each disk
    // later if we need to (e.g., about speed?)
    disks[name] = { prices: disks[name] };
  }

  return { machineTypes, accelerators, disks, zones };
}

// In scraping data we use the names in the data sources.
// However, we want to instead use exactly the same names
// as in the GCP API. The possibilities for name here are
//   'NVIDIA T4', 'NVIDIA P4', 'NVIDIA V100', 'NVIDIA P100', 'NVIDIA K80',
function toApiAcceleratorType(name: string): string {
  const family = name.split(" ")[1].toLowerCase();
  return `nvidia-tesla-${family}`;
}
