/*
DISK
We also need data from

   https://cloud.google.com/compute/disks-image-pricing

but using fetch won't work for this because it dynamically fills pricing into a template.
The actual data about disk pricing (and really everything) is in this json file:

https://www.gstatic.com/cloud-site-ux/pricing/data/gcp-compute.json

I found this by just watching the network activity when downloading pricing html pages.
This is basically exactly the official google pricing api, except (1) no api key required,
and (2) in JSON format. Cool!

If x is the gcp-compute.json object, then:

   x.gcp.compute.persistent_disk.standard.capacity.storagepdcapacity.regions
   x.gcp.compute.persistent_disk.ssd.capacity.storagepdssd.regions

is a map from region name (with the dash included) to

  {
    price: [ { val: 0, currency: 'USD', nanos: 48000000 } ],
    ...
  }

Take the nanos field and divide by 10^9 to get the price per GB per *month*,
and divide that by 730 to get price per hour.

We can thus easily get some additional keys for our raw pricing object:

'standard': {
   'us-west1': price per hour, ...
}

'ssd': {...}

We could easily add more, but this is all I need for my application.
*/

export async function getDisks(): Promise<{
  standard: { [region: string]: number };
  ssd: { [region: string]: number };
}> {
  const res = await fetch(
    "https://www.gstatic.com/cloud-site-ux/pricing/data/gcp-compute.json",
  );
  const data = await res.json();
  const disk_standard = Object.fromEntries(
    Object.entries(
      data.gcp.compute.persistent_disk.standard.capacity.storagepdcapacity
        .regions,
    ).map(([region, value]) => {
      return [region, getPrice((value as any)["price"])];
    }),
  );

  const disk_ssd = Object.fromEntries(
    Object.entries(
      data.gcp.compute.persistent_disk.ssd.capacity.storagepdssd.regions,
    ).map(([region, value]) => {
      return [region, getPrice((value as any)["price"])];
    }),
  );

  return { standard: disk_standard, ssd: disk_ssd };
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
