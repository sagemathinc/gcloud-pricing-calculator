# Google Cloud Pricing Info and Calculator

---

This is a node.js library that downloads and parses the website [https://cloud.google.com/compute/vm\-instance\-pricing](https://cloud.google.com/compute/vm-instance-pricing) and several other public data sources form Google, and also includes a copy of some of the official SKU pricing list, parses everything, makes a range of automatic and manual changes, then makes it possibly to very quickly use all of that data from Javascript.

**It also takes into account that the spot prices at** [**https://cloud.google.com/compute/vm\-instance\-pricing**](https://cloud.google.com/compute/vm-instance-pricing) **are mostly very wrong**, and instead pulls spot prices from [https://cloud.google.com/spot\-vms/pricing](https://cloud.google.com/spot-vms/pricing).

Finally, it includes some by hand tables of pricing for A100's and some other adjustments that I tedious created _by hand_ by entering machine configurations into Google Cloud. There's a GPU table at [https://cloud.google.com/compute/gpus\-pricing](https://cloud.google.com/compute/gpus-pricing) . It then tries to use the SKU data to correct all of these prices.

_**CAVEAT: Obviously don't trust anything here.**_ I made this. I'm using it. And I made it public, though under a **non\-commercial license**. This very much comes with absolutely not guarantees! Buyer beware, literally. All that said, if you're reading this and know a better way to do something or want to improve this code, please contribute! See [https://github.com/sagemathinc/gcloud\-pricing\-calculator](https://github.com/sagemathinc/gcloud-pricing-calculator)

CAVEAT: Don't trust the official public google priing pages either. They have numerous significant mistakes where pricing is off by potentially thousands of dollars. However, the actual SKU pricing data seems to be what they actually charge. E.g., in Singapore the price per month for a `m1-ultramem-40` VM with 961GB of RAM [is listed here](https://cloud.google.com/compute/vm-instance-pricing) as \$10814.95, but in reality the price is \$5,411.74 \(roughly a factor of 2\). This is not a spot instance. Here are some examples where Google's publicly posted prices are off by at least 10% from what they actually charge.

```
 'n1-highcpu-2' in 'asia-southeast2' : diff=0.017971232000000004, published=0.0773, actual=0.095271232
 'n1-highcpu-4' in 'asia-southeast2' : diff=0.03594246400000001, published=0.1546, actual=0.190542464
 'n1-highcpu-8' in 'asia-southeast2' : diff=0.071984928, published=0.3091, actual=0.381084928
 'n1-highcpu-16' in 'asia-southeast2' : diff=0.143969856, published=0.6182, actual=0.762169856
 'n1-highcpu-32' in 'asia-southeast2' : diff=0.287839712, published=1.2365, actual=1.524339712
 'n1-highcpu-64' in 'asia-southeast2' : diff=0.575679424, published=2.473, actual=3.048679424
 'n1-highcpu-96' in 'asia-southeast2' : diff=0.864819135999999, published=3.7082, actual=4.573019135999999
 'm1-ultramem-40' in 'europe-central2' : diff=-6.61655305, published=14.352, actual=7.73544695
 'm1-ultramem-40' in 'asia-southeast1' : diff=-7.412999999999999, published=14.815, actual=7.402
 'm1-ultramem-80' in 'europe-central2' : diff=-13.2331061, published=28.704, actual=15.4708939
 'm1-ultramem-80' in 'asia-southeast1' : diff=-14.827, published=29.631, actual=14.804
 'm1-ultramem-160' in 'europe-central2' : diff=-26.4662122, published=57.408, actual=30.9417878
 'm1-ultramem-160' in 'asia-southeast1' : diff=-29.653000000000002, published=59.261, actual=29.608
 'm1-megamem-96' in 'asia-southeast1' : diff=-12.547, published=25.075, actual=12.527999999999999
 'm1-megamem-96' in 'europe-west6' : diff=-13.091975999999999, published=28.005, actual=14.913024
```

Here is how to use this library:

```sh
pnpm install @cocalc/gcloud-pricing-calculator
```

```js
>>> pricing = require("@cocalc/gcloud-pricing-calculator");
>>> data = await pricing.getData();
>>> console.log(data.machineTypes["n1-highmem-4"]);
{ prices: { 'us-central1': 0.236606, 'us-west2': 0.2842, 'us-west3': 0.2842,
  spot: {...},
  vcpu: 4,
  memory: 26}
```

The output is of type GoogleCloudData as defined in typescript below:

```ts
interface PriceData {
  prices?: { [region: string]: number };
  spot?: { [region: string]: number };
  vcpu?: number;
  memory?: number;
  count?: number; // for gpu's only
  max?: number; // for gpu's only
}

interface ZoneData {
  machineTypes: string; // ['e2','n1','n2', 't2d' ... ] -- array of machine type prefixes
  location: string; // description of where it is
  lowC02: boolean; // if true, low c02 emissions
  gpus: boolean; // if true, has gpus
}

interface GoogleCloudData {
  machineTypes: { [machineType: string]: PriceData };
  disks: {
    standard: { prices: { [zone: string]: number } };
    ssd: { prices: { [zone: string]: number } };
  };
  accelerators: { [acceleratorType: string]: PriceData };
  zones: { [zone: string]: ZoneData };
}
```

In particular, it gives price data about all machine types, standard disks and ssd disks, and GPU's ('accelerators'). It also lists all zones and has information about if they have GPU's, whether they are low CO2, and where they are.

The result is cached on disk and included with this package. To recompute it:

```js
await gcloudPricing.updateData();
```

There is no point in doing this unless you also update the csv file in the data subdirectory.

Google updates spot prices "at most once per month" and on demand prices much less frequently. They have a private mailing list that they send an excel file to about upcoming updates. It would be natural to add a way of scheduling one of those to this package, but that is not done yet.

We don't include information yet about snapshot prices.

## Warnings

See note below about spot instance pricing for GPU's, which is clearly wrong on Google's pricing page. I've manually corrected this in the output of getData, with what might be a significant overestimate.

Also, your prices can be different than the published rates, e.g., if Google has a special negotiated rate with you.

This package is AGPL + non-commercial clause licensed. If you want to use it in a product, contact us for a commercial license (help@cocalc.com).

Another warning is that this updates date once per day by default. However, Google might update their pricing in the middle of a day, and for some part of that day this will be wrong. There's no way around that really. There is a [closed google group](https://groups.google.com/g/gce-spot-pricing-announcements/) that you can request to join which posts updates to spot pricing a few days in advance; I wish there were an api endpoint that returned "next known date when spot prices will change"...

## Related Official Google Pages

- [Google Cost Estimation API](https://cloud.google.com/billing/docs/how-to/cost-estimates-using-api) \-\- this is an official new "Preview" endpoint that gives the cost for a workload. It's also accessible in the Google Cloud Console: `https://console.cloud.google.com/billing/YOUR BILLING ACOUNT ID/estimate` and it's called "Compute Engine workload estimate" there.
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator)
- [VM instance pricing](https://cloud.google.com/compute/vm-instance-pricing)
- [Spot pricing](https://cloud.google.com/spot-vms/pricing)
- [Disk and image pricing](https://cloud.google.com/compute/disks-image-pricing)
- [gcp\-compute.json](https://www.gstatic.com/cloud-site-ux/pricing/data/gcp-compute.json)
- [Cloud pricing api](https://cloud.google.com/billing/v1/how-tos/catalog-api)

## Motivation

It is difficult to know how much a particular Google Cloud virtual machine will actually cost. isn't the purpose of the pricing api to get the price for all their SKUs? [https://cloud.google.com/billing/docs/how\-to/get\-pricing\-information\-api](https://cloud.google.com/billing/docs/how-to/get-pricing-information-api) I wish! Unfortunately the pricing api does not solve the actual problem I have.

If you already have the SKU ID in hand for a specific charge, you can look up the unit price in a big table. But that table is just a massive key:value store from a random looking sku identifier to a cost. There's also some english language descriptions as well \(some have typos which is not confidence inspiring\).

In summary:

- There's a confusing api to download all possible skus \(tens of thousands of them\) and it's very hard to make heads or tales of what those mean. \(you can't appreciate how horrid it is if you don't try it...\)
- When you go to create a VM in the cloud console it displays a price. As far as I can tell, there is no api available for us for getting _that_ price. I also don't know if the price there can be trusted. I've been using GCP for over 10 years now, and always thought such an API would appear... but it seems to not have. At least I can't find it.
- When you go to [https://cloud.google.com/compute/all\-pricing\#compute\-engine\-pricing](https://cloud.google.com/compute/all-pricing#compute-engine-pricing) you find pricing, which is easy to understand and read, but it's HTML so not easy to use programatically. However, it is unfortunately dangerously **wrong** sometimes, e.g., the Nvidia K80 GPU near the bottom spot instance is listed as **\$0.0394 / hour** in Iowa, which would be an amazing deal!
  - according to the cloud console \(when creating a vm\) that exact thing is **\$0.19/per hour** for K80 in Iowa!
  - according to https://cloud.google.com/products/calculator it is \$0.18/GPU per hour.
  - according to the cloud console \(right when you make a machine\) it is \$0.05/hour in Europe, which is pretty amazing still, if true. But is it? \(I was easily able to start such a GPU spot instance running, so it's available\).
- From the docs, a customer of GCP could potentially be getting rates different than these published ones, because of negotiated deals.
- I don't think the underlying accounting GCP does records how much one specific instance costs. They record aggregates over time for various types of machines, and it only appears in data a customer can look at a day or two later \(?\). E.g., I ran a dozen misc machines for tests today in a new clean project, and there is zero data so far about the cost. Of course GCP does provide pricing a day later with a powerful BigQuery interface to it.
- Spot instances prices are updated monthly. For a single machine type, they can **vary dramatically** from one region to another. E.g., right now an n2\-standard\-2 is \$14 in us\-east4 but \$19.73 in us\-east5 \(per month\). Without code surfacing this sort of thing, I don't see how one can make a rational decision.

