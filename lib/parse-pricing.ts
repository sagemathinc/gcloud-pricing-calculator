/*
First we download the pricing html page using the fetch api from as text:

   https://cloud.google.com/compute/all-pricing,

Next we parse out the pricing data as a single usable Javascript object.
The format of the all-pricing page is as follows:

---
...

<h2 id="general_purpose" class="cloud-jump-section cloud-headline2" data-text="General-purpose machine types">General-purpose machine types</h2>

<h3 id="c3_machine-types" data-text="C3 machine types">C3 machine types</h3>

  <cloudx-pricing-table
    layout="{'rows': [{'header': True, 'cells': ['Item', 'On-demand price (USD)', 'Spot price* (USD)', '1-year resource-based commitment price (USD)', '3-year resource-based commitment price (USD)']}, {'cells': ['Predefined vCPUs', {'priceByRegion': {'uscentral1': '0.03398', 'europewest4': '0.035711454550', 'useast4': '0.03386725664', 'useast1': '0.033982', 'europewest1': '0.037381', 'asiasoutheast1': '0.041924'}, 'decimalPlaces': 6, 'format': '%{price}% / vCPU %{rate}%'}, {'priceByRegion': {'uscentral1': '0.003086', 'europewest4': '0.004337', 'useast4': '0.010118', 'useast1': '0.003086', 'europewest1': '0.009046', 'asiasoutheast1': '0.009638'}, 'decimalPlaces': 6, 'format': '%{price}% / vCPU %{rate}%'}, {'priceByRegion': {'uscentral1': '0.021409', 'europewest4': '0.022501929550', 'useast4': '0.02133890265', 'useast1': '0.021409', 'europewest1': '0.023573', 'asiasoutheast1': '0.026412'}, 'decimalPlaces': 6, 'format': '%{price}% / vCPU %{rate}%'}, {'priceByRegion': {'uscentral1': '0.015291', 'europewest4': '0.016071605450', 'useast4': '0.0152409292', 'useast1': '0.015291', 'europewest1': '0.016837', 'asiasoutheast1': '0.018865'}, 'decimalPlaces': 6, 'format': '%{price}% / vCPU %{rate}%'}]}, {'cells': ['Predefined Memory', {'priceByRegion': {'uscentral1': '0.00456', 'europewest4': '0.004786090909', 'useast4': '0.004538938053', 'useast1': '0.004555', 'europewest1': '0.005011', 'asiasoutheast1': '0.005618'}, 'decimalPlaces': 6, 'format': '%{price}% / GB %{rate}%'}, {'priceByRegion': {'uscentral1': '0.000413', 'europewest4': '0.000584', 'useast4': '0.001356', 'useast1': '0.000413', 'europewest1': '0.001212', 'asiasoutheast1': '0.001297'}, 'decimalPlaces': 6, 'format': '%{price}% / GB %{rate}%'}, {'priceByRegion': {'uscentral1': '0.002869', 'europewest4': '0.003015462545', 'useast4': '0.002859606195', 'useast1': '0.002869', 'europewest1': '0.003159', 'asiasoutheast1': '0.003539'}, 'decimalPlaces': 6, 'format': '%{price}% / GB %{rate}%'}, {'priceByRegion': {'uscentral1': '0.002049', 'europewest4': '0.002153601545', 'useast4': '0.00204229115', 'useast1': '0.002049', 'europewest1': '0.002256', 'asiasoutheast1': '0.002528'}, 'decimalPlaces': 6, 'format': '%{price}% / GB %{rate}%'}]}]}"
    suppressRegions="useast5,ussouth1,mewest1,mecentral1,europewest12,mecentral2"
    surfaceRegions="ussouth1, useast5, mewest1">
  </cloudx-pricing-table>

...

<h4 id="c3_standard_machine_types" data-text="C3 standard machine types">C3 standard machine types</h4>


  <cloudx-pricing-table
    layout="{'rows': [{'header': True, 'cells': ['Machine type', 'Virtual CPUs', 'Memory', 'Price (USD)', 'Spot price* (USD)']}, {'cells': ['c3-standard-4', '4', '16', {'priceByRegion': {'uscentral1': '0.20888', 'europewest4': '0.219423', 'useast4': '0.208092', 'useast1': '0.208808', 'europewest1': '0.2297', 'asiasoutheast1': '0.257584'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.018952', 'europewest4': '0.026692', 'useast4': '0.062168', 'useast1': '0.018952', 'europewest1': '0.055576', 'asiasoutheast1': '0.059304'}, 'decimalPlaces': 6}]}, {'cells': ['c3-standard-8', '8', '32', {'priceByRegion': {'uscentral1': '0.41776', 'europewest4': '0.438847', 'useast4': '0.416184', 'useast1': '0.417616', 'europewest1': '0.4594', 'asiasoutheast1': '0.515168'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.037904', 'europewest4': '0.053384', 'useast4': '0.124336', 'useast1': '0.037904', 'europewest1': '0.111152', 'asiasoutheast1': '0.118608'}, 'decimalPlaces': 6}]}, {'cells': ['c3-standard-22', '22', '88', {'priceByRegion': {'uscentral1': '1.14884', 'europewest4': '1.206828', 'useast4': '1.144506', 'useast1': '1.148444', 'europewest1': '1.26335', 'asiasoutheast1': '1.416712'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.104236', 'europewest4': '0.146806', 'useast4': '0.341924', 'useast1': '0.104236', 'europewest1': '0.305668', 'asiasoutheast1': '0.326172'}, 'decimalPlaces': 6}]}, {'cells': ['c3-standard-44', '44', '176', {'priceByRegion': {'uscentral1': '2.29768', 'europewest4': '2.413656', 'useast4': '2.289012', 'useast1': '2.296888', 'europewest1': '2.5267', 'asiasoutheast1': '2.833424'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.208472', 'europewest4': '0.293612', 'useast4': '0.683848', 'useast1': '0.208472', 'europewest1': '0.611336', 'asiasoutheast1': '0.652344'}, 'decimalPlaces': 6}]}, {'cells': ['c3-standard-88', '88', '352', {'priceByRegion': {'uscentral1': '4.59536', 'europewest4': '4.827312', 'useast4': '4.578025', 'useast1': '4.593776', 'europewest1': '5.0534', 'asiasoutheast1': '5.666848'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.416944', 'europewest4': '0.587224', 'useast4': '1.367696', 'useast1': '0.416944', 'europewest1': '1.222672', 'asiasoutheast1': '1.304688'}, 'decimalPlaces': 6}]}, {'cells': ['c3-standard-176', '176', '704', {'priceByRegion': {'uscentral1': '9.19072', 'europewest4': '9.654624', 'useast4': '9.15605', 'useast1': '9.187552', 'europewest1': '10.1068', 'asiasoutheast1': '11.333696'}, 'decimalPlaces': 6}, {'priceByRegion': {'uscentral1': '0.833888', 'europewest4': '1.174448', 'useast4': '2.735392', 'useast1': '0.833888', 'europewest1': '2.445344', 'asiasoutheast1': '2.609376'}, 'decimalPlaces': 6}]}]}"
    suppressRegions="useast5,ussouth1,mewest1,mecentral1,europewest12,mecentral2"
    surfaceRegions="ussouth1, useast5, mewest1">
  </cloudx-pricing-table>


<h4 id="c3_highmem_machine_types" data-text="C3 high-memory machine types">C3 high-memory machine types</h4>


  <cloudx-pricing-table
    layout="{'rows': [{'header': True, ...
  </cloudx-pricing-table>

...

<h2 id="compute-optimized_machine_types" class="cloud-jump-section cloud-headline2" data-text="Compute-optimized machine types">Compute-optimized machine types</h2>

<h3 id="c2_vcpus_and_memory" data-text="C2 vCPUs and memory">C2 vCPUs and memory</h3>


  <cloudx-pricing-table
    layout="{'rows': [{'header': Tru

...

---

We parse this into an object of the form:
 {
  general_purpose: {
    "c3_machine-types": {
      layout: {
        rows: [
          // ... everything exactly as in the html file
        ],
      },
      suppressRegions:
        "useast5,ussouth1,mewest1,mecentral1,europewest12,mecentral2",
      surfaceRegions: "ussouth1, useast5, mewest1",
    },
    c3_highmem_machine_types: {
    },
  },
  "compute-optimized_machine_types": {
    c2_vcpus_and_memory: {
    },
  },
};
*/

import cheerio from "cheerio";

export async function fetchPricingData() {
  const gcloudUrl = "https://cloud.google.com/compute/all-pricing";
  const response = await fetch(gcloudUrl, {
    headers: {
      "Accept-Language": "en-US",
    },
  });
  const body = await response.text();
  return body;
}

export async function parsePricingData(body: string) {
  // Use cheerio to load the HTML
  const $ = cheerio.load(body);
  const structure = {};

  // Here we target h2 elements as the main keys in our structure. We could change the selector to match the correct hierarchy.
  $("h2[data-text]").each((_, element) => {
    const type = $(element).attr("id");
    if (type == null) return;
    structure[type] = {};

    // Find the subsequent h4 elements, until the next h2
    $(element)
      .nextUntil("h2", "h4[data-text]")
      .each((_, subElement) => {
        const subType = $(subElement).attr("id");

        $(subElement)
          .nextUntil("h4", "cloudx-pricing-table")
          .each((_, tableElement) => {
            const tableLayout = $(tableElement).attr("layout") ?? "";
            const json = tableLayout
              .replace(/True/g, "true")
              .replace(/False/g, "false")
              .replace(/'/g, '"');
            const layout = JSON.parse(json);
            structure[type][subType] = layout;
          });
      });
  });

  return structure;
}
