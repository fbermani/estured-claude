/** "1 día" / "7 días": concordancia simple de cantidad + sustantivo (sin "(s)" en la UI). */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
