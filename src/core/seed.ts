// Sections every new shop starts with. Owners can rename them or add more later.
export const DEFAULT_DEPARTMENTS = [
  { id: "dept-barbering", name: "Barbering", kind: "service", sort: 1 },
  { id: "dept-manicure", name: "Manicure", kind: "service", sort: 2 },
  { id: "dept-pedicure", name: "Pedicure", kind: "service", sort: 3 },
  { id: "dept-other", name: "Other services", kind: "service", sort: 4 },
  { id: "dept-drinks", name: "Drinks & beverages", kind: "product", sort: 5 },
] as const;

/** Name suggestions shown when adding items to a section. */
export const SUGGESTIONS: Record<string, string[]> = {
  "dept-barbering": ["Haircut", "Clean shave (head)", "Beard trim", "Beard shave", "Kids haircut", "Haircut + beard", "Line-up / shape-up", "Hair dye", "Hair wash"],
  "dept-manicure": ["Classic manicure", "Gel manicure", "Men's manicure", "Gel polish removal", "Nail art (per nail)", "Nail repair"],
  "dept-pedicure": ["Classic pedicure", "Spa pedicure", "Gel pedicure", "Men's pedicure", "Callus removal"],
  "dept-other": ["Facial", "Steam", "Head massage", "Scalp treatment", "Eyebrow shaping"],
  "dept-drinks": ["Water 500ml", "Soda", "Energy drink", "Juice", "Coffee", "Tea"],
};
