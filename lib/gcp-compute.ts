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
export async function toPriceMap(taxonomy: string, scale: number = 1) {
  const segments = taxonomy.toLowerCase().split(".");
  let data = await getComputeJson();
  for (const segment of segments) {
    data =
      data[segment.replace("cores_", "cores:_").replace("memory_", "memory:_")];
  }

  const x = Object.fromEntries(
    Object.entries(data.regions).map(([region, value]) => {
      return [region, getPrice((value as any)["price"]) * scale];
    }),
  );
  delete x.global;
  return x;
}

function getPrice(prices) {
  // I have no clue why there are multiple prices in some cases.
  // Usually all but one is equal to 0. We take the max to be safe.
  let price = prices[0]["nanos"] / 10 ** 9;
  for (let i = 1; i < prices.length; i++) {
    price = Math.max(price, prices[i]["nanos"] / 10 ** 9);
  }
  return price;
}
