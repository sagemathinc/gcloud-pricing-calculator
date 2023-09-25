/*
Mostly this file involves VERY TEDIOUSLY (and hopefully not error prone)
enter machine configuration into the GCP web console, and seeing what the
price quotes are.  There doesn't seem to be reliable pricing data anywhere
that I can find for 40GB A100's, 80GB A100's, and tensor core L4's, since
maybe they are all just very new.

Very likely the prices for spot are (or will soon be) all exactly 60% off,
i.e., the minimum, due to strong demand, so I'm just assuming that here.
*/

export default function handEdit(data) {
  includeGpuData(data);
  removeIncompleteMachineTypes(data);
}

function includeGpuData(data) {
  data.accelerators["nvidia-tesla-a100"] = {
    count: 1,
    max: 16,
    memory: 40,
    prices: {
      "us-central1-a": 2141.75 / 730,
      "us-central1-b": 2141.75 / 730,
      "us-central1-c": 2141.75 / 730,
      "us-central1-f": 2141.75 / 730,
      "us-east1-b": 2141.75 / 730,
      "us-west1-b": 2141.75 / 730,
      "us-west3-b": 2141.75 / 730,
      "us-west4-b": 2141.75 / 730,
      "europe-west4-a": 2141.75 / 730,
      "europe-west4-b": 2141.75 / 730,
      "me-west1-b": 2355.93 / 730,
      "me-west1-c": 2355.93 / 730,
      "asia-northeast1-a": 2264.14 / 730,
      "asia-northeast1-c": 2264.14 / 730,
      "asia-northeast3-a": 2264.14 / 730,
      "asia-northeast3-b": 2264.14 / 730,
      "asia-southeast1-b": 2264.14 / 730,
      "asia-southeast1-c": 2264.14 / 730,
    },
    // @ts-ignore
    machineType: "a2-highgpu-1g",
  };
  data.accelerators["nvidia-tesla-a100"].spot = sixtyPercentOff(
    data.accelerators["nvidia-tesla-a100"].prices,
  );

  data.accelerators["nvidia-a100-80gb"] = {
    count: 1,
    max: 8,
    memory: 80,
    prices: {
      "us-east4-c": 3229.66 / 730,
      "us-east5-b": 3229.66 / 730,
      "us-central1-a": 2867.5 / 730,
      "us-central1-c": 2867.5 / 730,
      "europe-west4-a": 3157.4 / 730,
      "asia-southeast1-c": 3537.63 / 730,
    },
    // @ts-ignore
    machineType: "a2-ultragpu-1g",
  };
  data.accelerators["nvidia-a100-80gb"].spot = sixtyPercentOff(
    data.accelerators["nvidia-a100-80gb"].prices,
  );

  // Yes, it's just 'nvidia-l4' because NVidia stopped using the "Tesla" branding
  // with the L4 series.
  data.accelerators["nvidia-l4"] = {
    count: 1,
    max: 1,
    memory: 24,
    prices: {
      "asia-east1-a": 473.38 / 730,
      "asia-east1-c": 473.38 / 730,
      "asia-northeast1-a": 525.02 / 730,
      "asia-northeast1-c": 525.02 / 730,
      "asia-south1-a": 425.57 / 730,
      "asia-southeast1-b": 504.37 / 730,
      "asia-southeast1-c": 504.37 / 730,
      "europe-west1-c": 450.16 / 730,
      "europe-west2-a": 465.49 / 730,
      "europe-west2-b": 465.49 / 730,
      "europe-west4-a": 429.7 / 730,
      "europe-west4-b": 429.7 / 730,
      "europe-west4-c": 429.7 / 730,
      "us-central1-a": 408.83 / 730,
      "us-central1-b": 408.83 / 730,
      "us-east1-b": 408.83 / 730,
      "us-east1-d": 408.83 / 730,
      "us-east4-a": 407.49 / 730,
      "us-east4-c": 407.49 / 730,
      "us-west1-a": 408.83 / 730,
      "us-west1-b": 408.83 / 730,
      "us-west1-c": 408.83 / 730,
    },
    machineType: "g2",
  };

  data.accelerators["nvidia-l4"].spot = sixtyPercentOff(
    data.accelerators["nvidia-l4"].prices,
  );

  // So I'm using a made up name for count=2, 4, 8, and you'll have
  // to fix this in your API calls.
  data.accelerators["nvidia-l4-x2"] = {
    count: 2,
    max: 2,
    memory: 24,
    machineType: "g2-standard-24",
  };

  data.accelerators["nvidia-l4-x2"].prices = scalePrices(
    data.accelerators["nvidia-l4"].prices,
    2,
  );
  data.accelerators["nvidia-l4-x2"].spot = sixtyPercentOff(
    data.accelerators["nvidia-l4-x2"].prices,
  );

  data.accelerators["nvidia-l4-x4"] = {
    count: 4,
    max: 4,
    memory: 24,
    prices: {},
    machineType: "g2-standard-48",
  };
  data.accelerators["nvidia-l4-x4"].prices = scalePrices(
    data.accelerators["nvidia-l4"].prices,
    4,
  );

  data.accelerators["nvidia-l4-x4"].spot = sixtyPercentOff(
    data.accelerators["nvidia-l4-x4"].prices,
  );

  data.accelerators["nvidia-l4-x8"] = {
    count: 8,
    max: 8,
    memory: 24,
    prices: {},
    machineType: "g2-standard-96",
  };
  data.accelerators["nvidia-l4-x8"].prices = scalePrices(
    data.accelerators["nvidia-l4"].prices,
    8,
  );
  data.accelerators["nvidia-l4-x8"].spot = sixtyPercentOff(
    data.accelerators["nvidia-l4-x8"].prices,
  );

  // Remove this, because it is deprecated anyways.
  delete data.accelerators["nvidia-tesla-k80"];

  for (const key in data.accelerators) {
    // @ts-ignore
    if (data.accelerators[key].machineType == null) {
      // @ts-ignore
      data.accelerators[key].machineType = "n1-";
    }
  }

  for (const machineType of ["nvidia-tesla-a100", "nvidia-a100-80gb"]) {
    for (const zone in data.accelerators[machineType].prices) {
      if (!data.zones[zone].machineTypes.includes("a2")) {
        data.zones[zone].machineTypes.push("a2");
      }
    }
  }

  changeGPURegionPricesToZonePrices(data);
}

// GPU's are in high demand, so as of Sept 25, 2023, Google
// just went to the worst possible spot instance discounts for them.
// Since we have a little trouble to get reliable data for spot A100's directly from
// google api's, we just use this (which is safe) for a100's.
// Of course a100 spot instances aren't often available!
function sixtyPercentOff(obj) {
  return scalePrices(obj, 0.6);
}

function scalePrices(obj, scale) {
  const obj2: any = {};
  for (const key in obj) {
    obj2[key] = scale * obj[key];
  }
  return obj2;
}

// Some wweird machine types like "n2-node-80-640"
// don't have data about vcpu and memory.  For now we
// just don't support them.  Maybe they are a special
// notation for something for later...
function removeIncompleteMachineTypes(data) {
  for (const machineType in data.machineTypes) {
    const x = data.machineTypes[machineType];
    if (!x.prices || !x.vcpu || !x.memory) {
      delete data.machineTypes[machineType];
    }
  }
}

function changeGPURegionPricesToZonePrices(data) {
  // I just manually copy/pasted this from https://cloud.google.com/compute/docs/gpus/gpu-regions-zones
  // Someday as google expands this list will grow, perhaps, though maybe not, since these are all
  // old GPU's and they add new ones.
  const ACCELERATOR_TO_ZONES = {
    "nvidia-tesla-t4":
      "asia-east1-a asia-east1-c asia-east2-a asia-east2-c asia-northeast1-a asia-northeast1-c asia-northeast3-b asia-northeast3-c asia-south1-a asia-south1-b asia-southeast1-a asia-southeast1-b asia-southeast1-c asia-southeast2-a asia-southeast2-b australia-southeast1-a australia-southeast1-c europe-central2-b europe-central2-c europe-west1-b europe-west1-c europe-west1-d europe-west2-a europe-west2-b europe-west3-b europe-west4-a europe-west4-b europe-west4-c me-west1-b me-west1-c northamerica-northeast1-c southamerica-east1-a southamerica-east1-c us-central1-a us-central1-b us-central1-c us-central1-f us-east1-c us-east1-d us-east4-a us-east4-b us-east4-c us-west1-a us-west1-b us-west2-b us-west2-c us-west3-b us-west4-a us-west4-b",
    "nvidia-tesla-v100":
      "asia-east1-c europe-west4-a europe-west4-b europe-west4-c us-central1-a us-central1-b us-central1-c us-central1-f us-east1-c us-west1-a us-west1-b",
    "nvidia-tesla-p100":
      "asia-east1-a asia-east1-c australia-southeast1-c europe-west1-b europe-west1-d europe-west4-a us-central1-c us-central1-f us-east1-b us-east1-c us-west1-a us-west1-b",
    "nvidia-tesla-p4":
      "asia-southeast1-b asia-southeast1-c australia-southeast1-a australia-southeast1-b europe-west4-b europe-west4-c northamerica-northeast1-a northamerica-northeast1-b northamerica-northeast1-c us-central1-a us-central1-c us-east4-a us-east4-b us-east4-c us-west2-b us-west2-c",
  };
  for (const type in ACCELERATOR_TO_ZONES) {
    const x = data.accelerators[type];
    const zones = ACCELERATOR_TO_ZONES[type].split(" ");
    x.prices = regionToZones(x.prices, zones);
    x.spot = regionToZones(x.spot, zones);
  }
}

function regionToZones(obj, zones) {
  const obj2: any = {};
  for (const region in obj) {
    for (const zone of zones) {
      if (zone.startsWith(region)) {
        obj2[zone] = obj[region];
      }
    }
  }
  return obj2;
}
