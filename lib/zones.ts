/*
Scrape https://cloud.google.com/compute/docs/regions-zones to get
a list of all current GCP zones, along with

 - their geographic location
 - which instance types are available there
 - whether or not GPU's are available there
 - if they have low CO2 emissions

The first three things are necessary to figure out where you can
run a given instance type exactly.  From pricing data, we know
which regions it can run in, but we know nothing about the zones
in that region, and the machines very by zone in a given region.
From the last, we can also prefer lower CO2 emissions, as defined
by https://cloud.google.com/sustainability/region-carbon

*/

import cheerio from "cheerio";

async function fetchZoneData() {
  const gcloudUrl = "https://cloud.google.com/compute/docs/regions-zones";
  const response = await fetch(gcloudUrl, {
    headers: {
      "Accept-Language": "en-US",
    },
  });
  const body = await response.text();
  return body;
}

export interface ZoneData {
  machineTypes: string; // ['e2','n1','n2', 't2d' ... ] -- array of machine type prefixes
  location: string; // description of where it is
  lowC02: boolean; // if true, low c02 emissions
  gpus: boolean; // if true, has gpus
}

async function parsePricingData() {
  const body = await fetchZoneData();
  // Use cheerio to parse the HTML
  const $ = cheerio.load(body);
  const table = $("table");
  const headings: string[] = [];
  const data: any[] = [];
  for (const elt of table.find("thead").find("tr").find("th")) {
    headings.push($(elt).text());
  }
  for (const row of table.find("tbody").find("tr")) {
    let x: any = {};
    let i = 0;
    for (const elt of $(row).find("td")) {
      x[headings[i]] = $(elt).text().trim();
      i += 1;
    }
    data.push(x);
  }
  return data;
}

let _zoneData: null | { [zone: string]: ZoneData } = null;
export async function getZones(): Promise<{ [zone: string]: ZoneData }> {
  if (_zoneData != null) {
    return _zoneData;
  }
  const data = await parsePricingData();
  const zoneData: { [zone: string]: ZoneData } = {};
  for (const x of data) {
    const machineTypes = x["Machine types"]
      .trim()
      .split(",")
      .map((x) => x.toLowerCase().trim());
    const location = x["Location"];
    const lowC02 = !!x["CO2 emissions"];
    const gpus = !!x["Resources"];
    zoneData[x.Zones] = { machineTypes, location, lowC02, gpus };
  }
  _zoneData = zoneData;
  return zoneData;
}
