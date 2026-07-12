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

// Returns the parsed class number (8-12) from the grade value, or null.
export function gradeNumber(v?: string | null): number | null {
  if (!v) return null;
  const m = /class_(\d+)/.exec(v);
  return m ? Number(m[1]) : null;
}

// Whether this class picks 2 optional subjects (per CDC/NEB curriculum: class 9-12).
export function classPicksOptionals(v?: string | null): boolean {
  const n = gradeNumber(v);
  return n !== null && n >= 9 && n <= 12;
}

// Curated optional-subject options based on Nepal CDC (9-10) and NEB (11-12) syllabi.
// Users pick exactly TWO.
export function optionalSubjectOptions(v?: string | null): string[] {
  const n = gradeNumber(v);
  if (n === 9 || n === 10) {
    return [
      "Optional Mathematics",
      "Computer Science",
      "Accountancy",
      "Economics",
      "Optional Science",
      "OBTE (Occupation, Business & Technology Education)",
      "Sanskrit",
      "Moral Education",
      "Population Studies",
      "Local / Mother-tongue Language",
    ];
  }
  if (n === 11 || n === 12) {
    return [
      // Science stream
      "Physics", "Chemistry", "Biology", "Mathematics",
      // Management stream
      "Accountancy", "Business Studies", "Economics", "Hotel Management",
      // Humanities stream
      "Sociology", "Psychology", "Political Science", "Geography", "History",
      // Education / IT
      "Education", "Computer Science",
    ];
  }
  return [];
}
