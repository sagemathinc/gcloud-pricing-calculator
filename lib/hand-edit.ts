/*
I VERY TEDIOUSLY (and hopefully not too error prone)
enter machine configuration into the GCP web console, and seeing what the
price quotes are and most importantly exactly what regions have them.
THEN we use the csv data file of pricing I downloaded manually from the
cloud console to replace *all* the prices with correct official prices.

A lot of the info about allowed machine types, etc., I just figured out
by using the cloud console.
*/

import {
  updateAcceleratorPricing,
  updateMachineTypePricing,
  updateDiskPricing,
} from "./csv-data";

export default async function handEdit(data) {
  await missingMachineTypes(data);
  await missingSpotInstancePrices(data);
  await updateGpuData(data);
  removeIncompleteMachineTypes(data);
  await updateMachineTypeData(data);
  await updateDisks(data);
  updateStorage(data);
}

function missingMachineTypes(data) {
  if (data.extra == null) {
    data.extra = {};
  }
  // google is now making a new "hyperdisk" that is faster than normal disks.
  // some machine types (e.g., n4) ONLY work with hyperdisk, and others
  // can support both.  We store this info here for now.
  data.extra["hyperdisk-balanced"] = {
    requiredMachineTypes: ["n4"],
    supportedMachineTypes: ["h3", "c3", "c3d", "m3", "n4"],
  };
  // n4's are in preview (as of 2024-04), so they
  // aren't found when scraping and we are missing the data
  for (const zone of [
    "asia-southeast1-a",
    "asia-southeast1-b",
    "asia-southeast1-c",
    "us-central1-a",
    "us-central1-c",
    "us-east1-b",
    "us-east1-c",
    "us-east1-d",
    "us-east4-a",
    "us-east4-b",
    "us-east4-c",
    "europe-west1-b",
    "europe-west1-c",
    "europe-west1-d",
    "europe-west4-a",
    "europe-west4-b",
    "europe-west4-c",
  ]) {
    if (!data.zones[zone].machineTypes.includes("n4")) {
      data.zones[zone].machineTypes.push("n4");
    }
  }
  for (const n of [2, 4, 8, 16, 32, 48, 64, 80]) {
    for (const t of ["standard", "highmem", "highcpu"]) {
      let vcpu, memory;
      if (t == "standard") {
        vcpu = n;
        memory = 4 * n;
      } else if (t == "highmem") {
        vcpu = n;
        memory = 8 * n;
      } else if (t == "highcpu") {
        vcpu = n;
        memory = 2 * n;
      }
      const instanceType = `n4-${t}-${n}`;
      if (data.machineTypes[instanceType] == null) {
        data.machineTypes[instanceType] = {
          // the actual much smaller prices will get swapped in from the CSV data.
          prices: {
            "asia-southeast1": 10000,
            "us-central1": 10000,
            "us-east1": 10000,
            "us-east4": 10000,
            "europe-west1": 10000,
            "europe-west4": 10000,
          },
          spot: {},
          vcpu,
          memory,
        };
      }
    }
  }
}

export function missingSpotInstancePrices(data) {
  // E.g., The C3D spot pricing is too new, hence not at https://cloud.google.com/spot-vms/pricing, so we don't get it. (no longer true, obviously).
  // 2024-03 note: Google says "All machine series support Spot VMs (and preemptible VMs), with
  // the exception of the M2, M3, and H3 machine series." at https://cloud.google.com/compute/docs/machine-resource
  // Their cloud console for M2 doesn't let you make them, but the API does let you make them!
  // For M3 their UI even lets you make spot instances.
  // I tried H3 and that does fail.

  for (const machineType in data.machineTypes) {
    if (machineType.startsWith("h3")) {
      continue;
    }
    if (Object.keys(data.machineTypes[machineType].spot ?? {}).length == 0) {
      data.machineTypes[machineType].spot = scalePrices(
        data.machineTypes[machineType].prices,
        0.4,
      );
    }
  }
}

async function updateGpuData(data) {
  // NOTE: All the prices that we fill in below are placeholders from some point in time.
  // They get overwritten with the data from the csv file.
  data.accelerators["nvidia-tesla-t4"] = {
    count: 1,
    memory: 16,
    prices: {
      "us-central1-a": 0.35,
      "us-central1-b": 0.35,
      "us-central1-c": 0.35,
      "us-central1-f": 0.35,
      "us-west1-a": 0.35,
      "us-west1-b": 0.35,
      "us-west2-b": 0.41,
      "us-west2-c": 0.41,
      "us-west4-a": 0.37,
      "us-west4-b": 0.37,
      "us-east1-c": 0.35,
      "us-east1-d": 0.35,
      "us-east4-a": 0.37,
      "us-east4-b": 0.37,
      "us-east4-c": 0.37,
      "northamerica-northeast1-c": 0.35,
      "southamerica-east1-a": 0.35,
      "southamerica-east1-c": 0.35,
      "europe-west1-b": 0.35,
      "europe-west1-c": 0.35,
      "europe-west1-d": 0.35,
      "europe-west2-a": 0.41,
      "europe-west2-b": 0.41,
      "europe-west3-b": 0.41,
      "europe-west4-a": 0.35,
      "europe-west4-b": 0.35,
      "europe-west4-c": 0.35,
      "europe-central2-b": 0.41,
      "europe-central2-c": 0.41,
      "asia-south1-a": 0.41,
      "asia-south1-b": 0.41,
      "asia-southeast1-a": 0.37,
      "asia-southeast1-b": 0.37,
      "asia-southeast1-c": 0.37,
      "asia-southeast2-a": 0.4033,
      "asia-southeast2-b": 0.4033,
      "australia-southeast1-a": 0.44,
      "australia-southeast1-c": 0.44,
      "asia-east1-a": 0.35,
      "asia-east1-c": 0.35,
      "asia-east2-a": 0.44,
      "asia-east2-c": 0.44,
      "asia-northeast1-a": 0.37,
      "asia-northeast1-c": 0.37,
      "asia-northeast3-b": 0.37,
      "asia-northeast3-c": 0.37,
      "me-west1-b": 0.385,
      "me-west1-c": 0.385,
    },
    spot: {
      "us-central1-a": 0.14,
      "us-central1-b": 0.14,
      "us-central1-c": 0.14,
      "us-central1-f": 0.14,
      "us-west1-a": 0.14,
      "us-west1-b": 0.14,
      "us-west2-b": 0.164,
      "us-west2-c": 0.164,
      "us-west3-b": 0.1394,
      "us-west4-a": 0.1258,
      "us-west4-b": 0.1258,
      "us-east1-c": 0.14,
      "us-east1-d": 0.14,
      "us-east4-a": 0.11,
      "us-east4-b": 0.11,
      "us-east4-c": 0.11,
      "northamerica-northeast1-c": 0.14,
      "southamerica-east1-a": 0.14,
      "southamerica-east1-c": 0.14,
      "europe-west1-b": 0.14,
      "europe-west1-c": 0.14,
      "europe-west1-d": 0.14,
      "europe-west2-a": 0.069841,
      "europe-west2-b": 0.069841,
      "europe-west3-b": 0.164,
      "europe-west4-a": 0.119,
      "europe-west4-b": 0.119,
      "europe-west4-c": 0.119,
      "europe-central2-b": 0.164,
      "europe-central2-c": 0.164,
      "asia-south1-a": 0.164,
      "asia-south1-b": 0.164,
      "asia-southeast1-a": 0.11,
      "asia-southeast1-b": 0.11,
      "asia-southeast1-c": 0.11,
      "asia-southeast2-a": 0.1199,
      "asia-southeast2-b": 0.1199,
      "australia-southeast1-a": 0.1496,
      "australia-southeast1-c": 0.1496,
      "asia-east1-a": 0.14,
      "asia-east1-c": 0.14,
      "asia-east2-a": 0.1496,
      "asia-east2-c": 0.1496,
      "asia-northeast1-a": 0.069841,
      "asia-northeast1-c": 0.069841,
      "asia-northeast3-b": 0.1258,
      "asia-northeast3-c": 0.1258,
      "me-west1-b": 0.154,
      "me-west1-c": 0.154,
    },
    max: 4,
    machineType: "n1-",
  };
  // A100 40GB
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
    machineType: {
      1: ["a2-highgpu-1g"],
      2: ["a2-highgpu-2g"],
      4: ["a2-highgpu-4g"],
      8: ["a2-highgpu-8g"],
      // note for 16 -- this is a lot cheaper than 2x a2-highgpu-8g.
      16: ["a2-megagpu-16g"],
    },
  };
  await updateAcceleratorPricing(
    "Nvidia Tesla A100 GPU",
    data.accelerators["nvidia-tesla-a100"].prices,
  );

  data.accelerators["nvidia-tesla-a100"].spot = sixtyPercentOff(
    data.accelerators["nvidia-tesla-a100"].prices,
  );
  await updateAcceleratorPricing(
    "Nvidia Tesla A100 GPU attached to Spot Preemptible VMs",
    data.accelerators["nvidia-tesla-a100"].spot,
  );

  // A100 80GB
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
    machineType: {
      1: ["a2-ultragpu-1g"],
      2: ["a2-ultragpu-2g"],
      4: ["a2-ultragpu-4g"],
      8: ["a2-ultragpu-8g"],
    },
  };
  await updateAcceleratorPricing(
    "Nvidia Tesla A100 80GB GPU",
    data.accelerators["nvidia-a100-80gb"].prices,
  );
  data.accelerators["nvidia-a100-80gb"].spot = sixtyPercentOff(
    data.accelerators["nvidia-a100-80gb"].prices,
  );
  await updateAcceleratorPricing(
    "Nvidia Tesla A100 80GB GPU attached to Spot Preemptible VMs",
    data.accelerators["nvidia-a100-80gb"].spot,
  );

  // Yes, it's just 'nvidia-l4' because NVidia stopped using the "Tesla" branding
  // with the L4 series.
  data.accelerators["nvidia-l4"] = {
    count: 1,
    max: 8,
    memory: 24,
    prices: {
      "asia-east1-a": 473.38 / 730,
      "asia-east1-c": 473.38 / 730,
      "asia-northeast1-a": 525.02 / 730,
      "asia-northeast1-c": 525.02 / 730,
      "asia-northeast3-b": 525.02 / 730,
      "asia-south1-a": 425.57 / 730,
      "asia-south1-b": 425.57 / 730,
      "asia-southeast1-a": 504.37 / 730,
      "asia-southeast1-b": 504.37 / 730,
      "asia-southeast1-c": 504.37 / 730,
      "europe-west1-b": 450.16 / 730,
      "europe-west1-c": 450.16 / 730,
      "europe-west2-a": 465.49 / 730,
      "europe-west2-b": 465.49 / 730,
      "europe-west3-b": 465.49 / 730,
      "europe-west4-a": 429.7 / 730,
      "europe-west4-b": 429.7 / 730,
      "europe-west4-c": 429.7 / 730,
      "us-central1-a": 408.83 / 730,
      "us-central1-b": 408.83 / 730,
      "us-central1-c": 408.83 / 730,
      "us-east1-b": 408.83 / 730,
      "us-east1-d": 408.83 / 730,
      "us-east4-a": 407.49 / 730,
      "us-east4-c": 407.49 / 730,
      "us-west1-a": 408.83 / 730,
      "us-west1-b": 408.83 / 730,
      "us-west1-c": 408.83 / 730,
      "us-west4-a": 460.46 / 730,
      "us-west4-c": 460.46 / 730,
    },
    machineType: {
      1: [
        "g2-standard-4",
        "g2-standard-8",
        "g2-standard-12",
        "g2-standard-16",
        "g2-standard-32",
      ],
      2: ["g2-standard-24"],
      4: ["g2-standard-48"],
      8: ["g2-standard-96"],
    },
  };
  // first attempt -- just make up prices at the worst;
  // below we replace these by the real prices.
  data.accelerators["nvidia-l4"].spot = sixtyPercentOff(
    data.accelerators["nvidia-l4"].prices,
  );
  try {
    await updateAcceleratorPricing(
      "Nvidia L4 GPU",
      data.accelerators["nvidia-l4"].prices,
    );
    await updateAcceleratorPricing(
      "Nvidia L4 GPU attached to Spot Preemptible VMs",
      data.accelerators["nvidia-l4"].spot,
    );
  } catch (_) {
    // WTF? these five zones are NOT in the csv data at all, which is VERY weird.  We looked them
    // up using the cloud console.  They are amazingly important super good deals in the best places!
    // We first delete them, so update works, then write them below.
    const MISSING_L4_ZONES = [
      "us-west1-a",
      "us-west1-b",
      "us-west1-c",
      "us-east1-b",
      "us-east1-d",
    ];
    const MISSING_PRICE = 408.83 / 730;
    const MISSING_SPOT_PRICE = 122.65 / 730;
    for (const zone of MISSING_L4_ZONES) {
      delete data.accelerators["nvidia-l4"].spot[zone];
      delete data.accelerators["nvidia-l4"].prices[zone];
    }
    await updateAcceleratorPricing(
      "Nvidia L4 GPU",
      data.accelerators["nvidia-l4"].prices,
    );
    await updateAcceleratorPricing(
      "Nvidia L4 GPU attached to Spot Preemptible VMs",
      data.accelerators["nvidia-l4"].spot,
    );
    for (const zone of MISSING_L4_ZONES) {
      data.accelerators["nvidia-l4"].prices[zone] = MISSING_PRICE;
      data.accelerators["nvidia-l4"].spot[zone] = MISSING_SPOT_PRICE;
    }
  }

  // Remove K80 data, because it is deprecated anyways (and wrong)
  delete data.accelerators["nvidia-tesla-k80"];

  for (const key in data.accelerators) {
    if (data.accelerators[key].machineType == null) {
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

  // Use the csv data to update as many of the other GPU's (not L4 or A100)
  // that we can, instead of depending on old scraped data.

  for (const type of [
    "nvidia-tesla-t4",
    "nvidia-tesla-v100",
    "nvidia-tesla-p100",
    "nvidia-tesla-p4",
  ]) {
    const label = type.split("-")[2].toUpperCase();
    const desc = `Nvidia Tesla ${label} GPU`;
    if (data.accelerators[type] == null) {
      // deprecated
      continue;
    }
    await updateAcceleratorPricing(desc, data.accelerators[type].prices);
    await updateAcceleratorPricing(
      desc + " attached to Spot Preemptible VMs",
      data.accelerators[type].spot,
    );
  }
}

function sixtyPercentOff(obj) {
  return scalePrices(obj, 0.4);
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
    if (x == null) {
      // deprecated?
      continue;
    }
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

async function updateMachineTypeData(data) {
  for (const machineType in data.machineTypes) {
    try {
      await updateMachineTypePricing(
        machineType,
        data.machineTypes[machineType],
      );
    } catch (err) {
      console.warn(`issue with ${machineType} -- ${err}`);
    }
  }
}

// (1) make sure prices are right,
// (2) add in the spot prices for local ssd.
async function updateDisks(data) {
  await updateDiskPricing(data.disks);
}

function updateStorage(data) {
  /*
// Using https://github.com/sagemathinc/gcloud-pricing-calculator to figure
// out the actual region Location names:
> a = require('./dist'); z = await a.getData()
> k = new Set(Object.values(z.zones).map((x)=>{w=x.location.split(',');return w[w.length-1].trim()}))
Set(6) {
  'North America',
  'Europe',
  'APAC',
  'South Africa',
  'Middle East'
  'South America',
}
*/
  // Manually copied from https://cloud.google.com/storage/pricing#cloud-storage-pricing
  // as of June 14, 2024.
  data.storage = {
    atRest: {
      /* TODO */
    },
    // Retrieval fee per GiB
    retrieval: {
      standard: 0,
      nearline: 0.01,
      coldline: 0.02,
      archive: 0.05,
    },
    interRegionReplication: {
      us: 0.02,
      eu: 0.02,
      asia: 0.08,
    },
    singleRegionOperations: {
      standard: {
        classA1000: 0.005,
        classB1000: 0.0004,
      },
      nearline: {
        classA1000: 0.01,
        classB1000: 0.001,
      },
      coldline: {
        classA1000: 0.02,
        classB1000: 0.01,
      },
      archive: {
        classA1000: 0.05,
        classB1000: 0.05,
      },
    },
    multiRegionOperations: {
      standard: {
        classA1000: 0.01,
        classB1000: 0.0004,
      },
      nearline: {
        classA1000: 0.02,
        classB1000: 0.001,
      },
      coldline: {
        classA1000: 0.04,
        classB1000: 0.01,
      },
      archive: {
        classA1000: 0.1,
        classB1000: 0.05,
      },
    },
    dataTransferOutsideGoogleCloud: {
      // ignoring quantity discounts.
      worldwide: 0.12, // means everywhere except china/australia.
      china: 0.23,
      australia: 0.19,
    },
    dataTransferInsideGoogleCloud: {
      "North America": {
        "North America": 0.02,
        Europe: 0.05,
        APAC: 0.08,
        "South Africa": 0.1,
        "Middle East": 0.11,
        "South America": 0.14,
      },
      Europe: {
        "North America": 0.05,
        Europe: 0.02,
        APAC: 0.08,
        "South Africa": 0.1,
        "Middle East": 0.11,
        "South America": 0.14,
      },
      APAC: {
        "North America": 0.08,
        Europe: 0.08,
        APAC: 0.08,
        "South Africa": 0.1,
        "Middle East": 0.11,
        "South America": 0.14,
      },
      "South Africa": {
        "North America": 0.1,
        Europe: 0.1,
        APAC: 0.1,
        "South Africa": 0.08,
        "Middle East": 0.11,
        "South America": 0.14,
      },
      "Middle East": {
        "North America": 0.11,
        Europe: 0.11,
        APAC: 0.11,
        "South Africa": 0.11,
        "Middle East": 0.08,
        "South America": 0.14,
      },
      "South America": {
        "North America": 0.14,
        Europe: 0.14,
        APAC: 0.14,
        "South Africa": 0.14,
        "Middle East": 0.14,
        "South America": 0.14,
      },
    },
  };
}
