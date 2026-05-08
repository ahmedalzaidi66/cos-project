/*
  # Convert product prices from USD to IQD

  All product prices were previously stored as USD values (e.g. 24.99).
  The new system stores prices as IQD (base currency).
  This migration multiplies all existing prices by 1500 (the fixed USD/IQD rate)
  to convert them to IQD, so the display layer can show them correctly.

  Also converts compare_price if set.
*/

UPDATE products
SET price = ROUND(price * 1500)
WHERE price < 10000;

UPDATE products
SET compare_price = ROUND(compare_price * 1500)
WHERE compare_price IS NOT NULL AND compare_price < 10000;
