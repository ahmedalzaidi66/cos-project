// All prices in database are stored as IQD.
const IQD_RATE = 1500;
const IQD_LANGS = new Set(['ar', 'ku', 'ckb']);

export function formatPrice(iqd: number, language: string): string {
  if (IQD_LANGS.has(language)) {
    return `${Math.round(iqd).toLocaleString('en-US')} د.ع`;
  }
  const usd = iqd / IQD_RATE;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
