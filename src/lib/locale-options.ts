// Quiziify is a Nepal-only app. Country picker is locked to Nepal.
// Grades are restricted to Class 8 → Class 12 (the CDC/NEB span we support).
export const GRADES: { value: string; label: string }[] = Array.from(
  { length: 5 },
  (_, i) => ({ value: `class_${i + 8}`, label: `Class ${i + 8}` }),
);

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
