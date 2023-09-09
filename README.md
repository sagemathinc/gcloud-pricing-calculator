# Google Cloud Pricing Info and Calculator

This is a node.js library that downloads and parses the website https://cloud.google.com/compute/vm-instance-pricing, and then makes it possibly to very quickly use all of that data from Javascript.

```sh
pnpm install @cocalc/gcloud-pricing-calculator
```

```js
>>> pricing = require("@cocalc/gcloud-pricing-calculator");
>>> data = await pricing.getData();
>>> console.log(data["n1-highmem-4"]);
{ prices: { 'us-central1': 0.236606, 'us-west2': 0.2842, 'us-west3': 0.2842,
  spot: {...},
  vcpu: 4,
  memory: 26}
```

The format should hopefully be self explanatory. It's a map from machine instance types to:

```js
prices: {region to price in dollars per hour}
spot: {region to SPOT price in dollars per hour}
vcpu: number of cpus in this instance
memory: GB of ram
```

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

This package is public and MIT licensed and anybody can use it, but I only care about my personal application to https://cocalc.com.  If you need more, [send a pull request!](https://github.com/sagemathinc/gcloud-pricing-calculator)

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

