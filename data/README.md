This is the subset of lines in the CSV file "Pricing for My Billing Account.csv" that you can download from Google Cloud from the console when you look at Billing \-\-&gt; Pricing, then click the radio button next to "View all SKUs".    This page is something like

```html
https://console.cloud.google.com/billing/[your billing account id]/pricing
```

Then download the whole file, which is about 10MB and has all Google Cloud pricing across everything they sell.  After you do that, grep out just the GCP compute engine prices, which are about half of this big file.

```sh
grep "^GCP,Compute Engine" "Pricing for My Billing Account.csv" > 2023-10-30.csv
```

The code will take whatever file is last in lex order, so it's good to use the date.

It would be very natural to get this data via an API, but that doesn't seem possible.  There is a beta price estimate API, but the results seem somewhat wrong and it's very limited, not providing an efficient way to just get all data. 
