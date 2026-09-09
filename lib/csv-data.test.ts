import { deepStrictEqual, ok } from "node:assert";
import { test } from "node:test";
import { parse } from "csv-parse";
import { csvData } from "./csv-data";

test("csv-parse callback API remains compatible", async () => {
  const records = await new Promise((resolve, reject) => {
    parse("name,value\nprototype,ok\n", { columns: true }, (err, rows) => {
      if (err != null) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

  deepStrictEqual(records, [{ name: "prototype", value: "ok" }]);
});

test("bundled Google Cloud pricing snapshot parses", async () => {
  const records = await csvData();

  ok(Array.isArray(records));
  ok(records.length > 1_000);
  ok(records[0]["SKU ID"]);
  ok(records[0]["SKU description"]);
});
