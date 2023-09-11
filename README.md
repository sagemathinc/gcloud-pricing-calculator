# Google Cloud Pricing Info and Calculator

This is a node.js library that downloads and parses the website https://cloud.google.com/compute/vm-instance-pricing and several other public data sources form Google, then makes it possibly to very quickly use all of that data from Javascript.

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

The result is cached on disk for 1 day by default, but you can change the cache time by giving the number of days to cache as an argument to getData, e.g., give 0 to not use the cache:

```js
// not cached
await gcloudPricing.getData(0);
```

Google updates spot prices "at most once per month" and on demand prices much less frequently.

Use Infinity if you want to always use the pricing data included with this package \(e.g., you're using node version &lt; 18 without fetch\):

```js
// always uses disk cache:
await gcloudPricing.getData(Infinity);
```

In addition to instance types, the data object also has keys disk-standard and disk-ssd. These map to an object:

```js
{
prices: {region to price in dollars per hour}
}
```

We don't include any other information about disk or snapshot prices. If you need that, see the code in lib/disk-pricing.

## Warning

See note below about spot instance pricing for GPU's, which is clearly wrong on Google's pricing page. I've manually corrected this in the output of getData, with what might be a significant overestimate.

Also, your prices can be different than the published rates, e.g., if Google has a special negotiated rate with you.

This package is public and MIT licensed and anybody can use it, but I only care about my personal application to https://cocalc.com. If you need more, [send a pull request!](https://github.com/sagemathinc/gcloud-pricing-calculator)

## Related Official Google Pages

- [Google Cost Estimation API](https://cloud.google.com/billing/docs/how-to/cost-estimates-using-api) \-\- this is an official new "Preview" endpoint that gives the cost for a workload. It's also accessible in the Google Cloud Console: `https://console.cloud.google.com/billing/YOUR BILLING ACOUNT ID/estimate` and it's called "Compute Engine workload estimate" there.
- [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator)
- [VM instance pricing](https://cloud.google.com/compute/vm-instance-pricing)
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
