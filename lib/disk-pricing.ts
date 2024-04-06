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
   x.gcp.compute.persistent_disk.ssd.capacity.storagelocalssd.regions
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

NOTE: For hyperdisks, you have to specify all three of capacity, iops, and throughput,
and the cost is the sum of those values!  E.g., this is how to price a 10GB Balanced hyperdisk
with 3060 iops and 155 throughput in us-east1:

10 GB Hyperdisk Balanced	$0.90
3060 provisioned IOPS	$18.36
155 provisioned throughput	$6.98

> a = require('@cocalc/gcloud-pricing-calculator');
> z = await a.getData();0;
> (z.disks['hyperdisk-balanced-capacity'].prices['us-east1']*10 + z.disks['hyperdisk-balanced-iops'].prices['us-east1']*3060 + z.disks['hyperdisk-balanced-throughput'].prices['us-east1']*155)*730


*/
import type { PriceData } from "./parse-pricing";
import { toPriceMap } from "./gcp-compute";

export interface DiskData {
  "pd-standard": PriceData;
  "pd-ssd": PriceData;
  "pd-balanced": PriceData;
  "local-ssd": PriceData;
  "hyperdisk-balanced-capacity": PriceData;
  "hyperdisk-balanced-iops": PriceData;
  "hyperdisk-balanced-throughput": PriceData;
}

export async function getDisks(): Promise<DiskData> {
  const standard = await toPriceMap(
    "gcp.compute.persistent_disk.standard.capacity.storagepdcapacity",
    1 / 730,
  );
  const ssd = await toPriceMap(
    "gcp.compute.persistent_disk.ssd.capacity.storagepdssd",
    1 / 730,
  );
  const localSsd = await toPriceMap(
    "gcp.compute.local_ssd.on_demand.storagelocalssd",
    1 / 730,
  );
  const balanced = await toPriceMap(
    "gcp.compute.persistent_disk.ssd.capacity.lite.storagepdssdlitecapacity",
    1 / 730,
  );
  const hyperdisk_balanced_capacity = await toPriceMap(
    "gcp.compute.hyperdisk.hyperdisk_volumes.balanced.capacity.storagehyperdiskbalancedcapacity",
    1 / 730,
  );
  const hyperdisk_balanced_iops = await toPriceMap(
    "gcp.compute.hyperdisk.hyperdisk_volumes.balanced.iops.storagehyperdiskbalancediops",
    1 / 730,
  );
  const hyperdisk_balanced_throughput = await toPriceMap(
    "gcp.compute.hyperdisk.hyperdisk_volumes.balanced.throughput.storagehyperdiskbalancedthroughput",
    1 / 730,
  );

  return {
    "pd-standard": standard,
    "pd-balanced": balanced,
    "pd-ssd": ssd,
    "local-ssd": localSsd,
    "hyperdisk-balanced-capacity": hyperdisk_balanced_capacity,
    "hyperdisk-balanced-iops": hyperdisk_balanced_iops,
    "hyperdisk-balanced-throughput": hyperdisk_balanced_throughput,
  };
}
