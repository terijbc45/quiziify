// Quiziify is a Nepal-only app. Country picker is locked to Nepal.
export const GRADES: { value: string; label: string }[] = [
  { value: "nursery", label: "Nursery" },
  { value: "lkg", label: "LKG" },
  { value: "ukg", label: "UKG" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: `class_${i + 1}`, label: `Class ${i + 1}` })),
];

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "np", name: "Nepal", flag: "🇳🇵" },
];

export const DEFAULT_COUNTRY = "np";

export function gradeLabel(v?: string | null) {
  if (!v) return "";
  return GRADES.find((g) => g.value === v)?.label ?? v;
}
export function countryByCode(code?: string | null) {
  if (!code) return COUNTRIES[0];
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}
