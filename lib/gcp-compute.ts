let gcpComputeJson: any = null;

export async function getComputeJson() {
  if (gcpComputeJson != null) {
    return gcpComputeJson;
  }
  const res = await fetch(
    "https://www.gstatic.com/cloud-site-ux/pricing/data/gcp-compute.json",
  );
  gcpComputeJson = await res.json();
  return gcpComputeJson;
}

// e.g., input could be gcpComputeJson.gcp.compute.persistent_disk.standard.capacity.storagepdcapacity
// and output would be map from region to price
export function toPriceMap(obj) {
  return Object.fromEntries(
    Object.entries(obj.regions).map(([region, value]) => {
      return [region, getPrice((value as any)["price"])];
    }),
  );
}

function getPrice(prices) {
  // I have no clue why there are multiple prices in some cases.
  // Usually all but one is equal to 0. We take the max to be safe.
  let price = prices[0]["nanos"] / 10 ** 9 / 730;
  for (let i = 1; i < prices.length; i++) {
    price = Math.max(price, prices[i]["nanos"] / 10 ** 9 / 730);
  }
  return price;
}
