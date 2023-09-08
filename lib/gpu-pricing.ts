/*
The GPU pricing appears to be at
   https://cloud.google.com/compute/all-pricing
but it is actually in an iframe in some ancient format loaded from

https://cloud-dot-devsite-v2-prod.appspot.com/compute/all-pricing_8a84daa1871ac0d0cc7f47ea6646d780396a329d600906f7a3166bb5f2f70565.frame

so we parse this completely separately than the other pricing data.
Obviously, at some random moment, this is just going to break.
*/

import cheerio from "cheerio";

// This URL is in the gpus field of what we get from parse-pricing.ts.

export async function fetchGpuData(url: string) {
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US",
    },
  });
  const body = await response.text();
  return body;
}

export async function parseGpuData(body: string) {
  // Use cheerio to load the HTML
  const $ = cheerio.load(body);

  // First we make the zone map
  const zoneMap: { [code: string]: string } = {};
  for (const elt of $("md-option")) {
    const option = $(elt);
    const value = option.attr("value");
    if (!value) {
      continue;
    }
    const text = option.text();
    const region = text.substring(text.indexOf("(") + 1, text.indexOf(")"));
    zoneMap[value] = region;
  }

  const data = {};
  let gpu = "";
  for (const elt of $("table").find("tr")) {
    const row = $(elt);
    const cols = row.find("td");
    if (cols.length == 7) {
      gpu = $(row.find("td")[0]).text();
      data[gpu] = {
        count: parseInt($(cols[1]).text().split(" ")[0]),
        memory: parseInt($(cols[2]).text().split(" ")[0]),
        prices: getPriceMap($(cols[3]), zoneMap),
        spot: getPriceMap($(cols[6]), zoneMap),
        max: gpu.includes("K80") ? 8 : 4, //  just hardcode this -- the hardware isn't changing.
      };
      continue;
    }
    if (Object.keys(data).length >= 5) {
      break;
    }
  }

  // The pricing on the website is just totally wrong and massively better than reality (?).
  // At least I can reset it to something that agrees with the cloud console as of Sept 2024.
  data["NVIDIA K80"] = {
    "us-central1": "0.19",
    "us-west1": "0.19",
    "us-east1": "0.19",
    "europe-west1": "0.20", // this is "0.05" in console but I'm scared.
    "asia-east1": "0.2056",
  };

  return data;
}

function getPriceMap(elt, zoneMap) {
  const priceMap: { [zone: string]: string } = {};
  for (const code in zoneMap) {
    const price = elt.attr(`${code}-hourly`);
    if (price?.startsWith("$")) {
      const n = price.split(" ")[0].split("$")[1];
      if (n) {
        priceMap[zoneMap[code]] = n;
      }
    }
  }
  return priceMap;
}
