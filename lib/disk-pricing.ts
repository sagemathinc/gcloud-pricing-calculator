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
   x.gcp.compute.persistent_disk.ssd.capacity.lite.storagepdssdlitecapacity.regions

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

import { toPriceMap } from "./gcp-compute";

export async function getDisks(): Promise<{
  "pd-standard": { [region: string]: number };
  "pd-ssd": { [region: string]: number };
  "pd-balanced": { [region: string]: number };
}> {
  const standard = await toPriceMap(
    "gcp.compute.persistent_disk.standard.capacity.storagepdcapacity",
    1 / 730,
  );
  const ssd = await toPriceMap(
    "gcp.compute.persistent_disk.ssd.capacity.storagepdssd",
    1 / 730,
  );
  const balanced = await toPriceMap(
    "gcp.compute.persistent_disk.ssd.capacity.lite.storagepdssdlitecapacity",
    1 / 730,
  );

  return {
    "pd-standard": standard,
    "pd-balanced": balanced,
    "pd-ssd": ssd,
  };
}
