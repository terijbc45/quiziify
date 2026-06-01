// Small constants for the country + grade pickers used in auth/profile/random/chapters.
export const GRADES: { value: string; label: string }[] = [
  { value: "nursery", label: "Nursery" },
  { value: "lkg", label: "LKG" },
  { value: "ukg", label: "UKG" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: `class_${i + 1}`, label: `Class ${i + 1}` })),
];

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  ["np", "Nepal", "🇳🇵"], ["in", "India", "🇮🇳"], ["us", "United States", "🇺🇸"],
  ["gb", "United Kingdom", "🇬🇧"], ["ca", "Canada", "🇨🇦"], ["au", "Australia", "🇦🇺"],
  ["bd", "Bangladesh", "🇧🇩"], ["pk", "Pakistan", "🇵🇰"], ["lk", "Sri Lanka", "🇱🇰"],
  ["cn", "China", "🇨🇳"], ["jp", "Japan", "🇯🇵"], ["kr", "South Korea", "🇰🇷"],
  ["sg", "Singapore", "🇸🇬"], ["my", "Malaysia", "🇲🇾"], ["id", "Indonesia", "🇮🇩"],
  ["ph", "Philippines", "🇵🇭"], ["th", "Thailand", "🇹🇭"], ["vn", "Vietnam", "🇻🇳"],
  ["ae", "UAE", "🇦🇪"], ["sa", "Saudi Arabia", "🇸🇦"], ["tr", "Türkiye", "🇹🇷"],
  ["de", "Germany", "🇩🇪"], ["fr", "France", "🇫🇷"], ["it", "Italy", "🇮🇹"],
  ["es", "Spain", "🇪🇸"], ["pt", "Portugal", "🇵🇹"], ["nl", "Netherlands", "🇳🇱"],
  ["se", "Sweden", "🇸🇪"], ["no", "Norway", "🇳🇴"], ["fi", "Finland", "🇫🇮"],
  ["pl", "Poland", "🇵🇱"], ["ru", "Russia", "🇷🇺"], ["ua", "Ukraine", "🇺🇦"],
  ["br", "Brazil", "🇧🇷"], ["mx", "Mexico", "🇲🇽"], ["ar", "Argentina", "🇦🇷"],
  ["cl", "Chile", "🇨🇱"], ["co", "Colombia", "🇨🇴"], ["pe", "Peru", "🇵🇪"],
  ["za", "South Africa", "🇿🇦"], ["ng", "Nigeria", "🇳🇬"], ["ke", "Kenya", "🇰🇪"],
  ["eg", "Egypt", "🇪🇬"], ["et", "Ethiopia", "🇪🇹"], ["gh", "Ghana", "🇬🇭"],
  ["ma", "Morocco", "🇲🇦"], ["ie", "Ireland", "🇮🇪"], ["nz", "New Zealand", "🇳🇿"],
].map(([code, name, flag]) => ({ code: code as string, name: name as string, flag: flag as string }));

export function gradeLabel(v?: string | null) {
  if (!v) return "";
  return GRADES.find((g) => g.value === v)?.label ?? v;
}
export function countryByCode(code?: string | null) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
