import { fetchPricingData, parsePricingData } from "./parse-pricing";
import { fetchGpuData, parseGpuData } from "./gpu-pricing";

export async function pricingData() {
  const body = await fetchPricingData();
  const data = await parsePricingData(body);
  const gpu = await fetchGpuData(data.gpus);
  data.gpus = await parseGpuData(gpu);
  return data;
}
