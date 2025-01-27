This is the subset of lines in the CSV file "Pricing for My Billing Account.csv" that you can download from Google Cloud from the console when you look at Billing \-\-&gt; Pricing, then click the radio button next to "View all SKUs". This page is something like

```html
https://console.cloud.google.com/billing/[your billing account id]/pricing
```

Then download the whole file, which is about 15MB and has all of **your** Google Cloud pricing across everything they sell. After you do that, grep out just the GCP compute engine prices, which are about half of this big file.

```sh
head -n 1 "Pricing for My Billing Account.csv" > pricing.csv
grep "^GCP,Compute Engine" "Pricing for My Billing Account.csv" >> pricing.csv
grep "^GCP,Cloud Storage" "Pricing for My Billing Account.csv" >> pricing.csv
```

The code will take whatever file is last in lex order, so it's good to use the date.

It would be very natural to get this data via an API, but that doesn't seem possible. There is a beta price estimate API, but the results seem somewhat wrong and it's very limited, not providing an efficient way to just get all data.

NOTES about this data:

- As far as I can tell, these prices are correct.

- There are prices for things listed here that just don't exist for sale. E.g., there's a new machine type called "c3" and this file lists all kinds of amazing spot instance prics in various middle east regions, and yet these machines aren't available there. That's why this data is just a complement to scraping the pricing pages, which _do_ have the available locations.

