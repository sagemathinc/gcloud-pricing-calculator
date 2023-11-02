// This (https://cloud.google.com/spot-vms/pricing) seems to be
// the actual correct spot prices, whereas the ones from
// https://cloud.google.com/compute/vm-instance-pricing are mostly massively
// wrong, saying the price is way lower than it really is.  So below we
// fix all the spot prices using this data.
// Note that we *also* again fix spot pricing in the csv-data.ts stage,
// where we use even better data :-).

import cheerio from "cheerio";
import { toPriceMap } from "./gcp-compute";

async function fetchSpotPage() {
  const gcloudUrl = "https://cloud.google.com/spot-vms/pricing";
  const response = await fetch(gcloudUrl, {
    headers: {
      "Accept-Language": "en-US",
    },
  });
  const body = await response.text();
  return body;
}

export async function spotPricing() {
  const body = await fetchSpotPage();
  const $ = cheerio.load(body);
  const layout = $("cloudx-pricing-table:first").attr("layout");
  if (!layout) {
    throw Error("page data changed");
  }
  const json = layout
    .replace(/True/g, "true")
    .replace(/False/g, "false")
    .replace(/'/g, '"');
  const x = JSON.parse(json);

  const pricing = {};
  for (const { cells } of x.rows.slice(1)) {
    const family = cells[0].toLowerCase().trim();
    if (!family) continue;
    const p = {
      vcpu: await toPriceMap(cells[2].taxonomy),
      memory: await toPriceMap(cells[3].taxonomy),
    };
    for (const fam of family.split("/")) {
      pricing[fam] = p;
    }
  }
  return pricing;
}
