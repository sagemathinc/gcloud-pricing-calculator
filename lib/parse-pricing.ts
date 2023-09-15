/*
First we download the pricing html page using the fetch api from as text:

   https://cloud.google.com/compute/all-pricing,

and much more.
*/

import cheerio from "cheerio";
import { fetchGpuData, parseGpuData } from "./gpu-pricing";
import { getDisks } from "./disk-pricing";
import { getZones, ZoneData } from "./zones";
import { spotPricing } from "./spot-pricing";

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
  const spotData = await spotPricing();

  return {
    tables,
    gpus,
    disks,
    zones,
    spotData,
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

export function machineTypeToPriceData({
  tables,
  gpus,
  disks,
  zones,
  spotData,
}): {
  machineTypes: { [machineType: string]: PriceData };
  disks: {
    standard: { prices: { [zone: string]: number } };
    ssd: { prices: { [zone: string]: number } };
  };
  accelerators: { [acceleratorType: string]: PriceData };
  zones: { [zone: string]: ZoneData };
  spotData;
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
      const vcpu = toInteger(row.virtual ?? row.vcpu ?? row.vcpus);
      const memory = toInteger(row["memory"]);
      const prices = formatCostMap(
        (row.price ?? row["on-demand"])?.priceByRegion,
      );
      machineTypes[machineType] = {
        prices,
        spot: spotPrice({
          spotData,
          machineType,
          vcpu,
          memory,
          regions: Object.keys(prices ?? {}),
        }),
        vcpu,
        memory,
      };
    }
  }
  const accelerators: { [acceleratorType: string]: PriceData } = {};
  for (const name in gpus) {
    const d = gpus[name];
    accelerators[name.toLowerCase().replace(" ", "-")] = {
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

  return { machineTypes, accelerators, disks, zones, spotData };
}

function spotPrice({ spotData, machineType, vcpu, memory, regions }) {
  // z['c2d'].vcpus['us-east4']*d.machineTypes['c2d-highcpu-8'].vcpu + z['c2d'].memory['us-east4']*d.machineTypes['c2d-highcpu-8'].memory

  const family = machineType.split("-")[0];
  const data = spotData[family];
  const x = {};
  if (data == null) {
    // no spot pricing available, e.g., for an m2.
    return x;
  }
  for (const region of regions) {
    x[region] = data.vcpu[region] * vcpu + data.memory[region] * memory;
  }
  return x;
}
