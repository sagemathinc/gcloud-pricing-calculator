import { getData } from "./get-data";

// Given a machine type, this returns the pricing information,
// sorted starting with cheapest, or {} if we have no info.
export async function sortedPrices(machineType: string) {
  const data = await getData();
  const machineTypeData = data[machineType];
  if (machineTypeData == null) {
    return {};
  }
  const result = {};
  for (const key of ["prices", "spot"]) {
    result[key] = doSort(machineTypeData[key]);
  }
  return result;
}

function doSort(priceMap: { [region: string]: number } | undefined) {
  if (priceMap == null) {
    return priceMap;
  }
  const v: { region: string; cost: number }[] = [];
  for (const region in priceMap) {
    v.push({ region, cost: priceMap[region] });
  }
  v.sort((a, b) => {
    if (a.cost == b.cost) return 0;
    if (a.cost == null) return 1;
    if (b.cost == null) return -1;
    return a.cost - b.cost;
  });
  return v;
}
