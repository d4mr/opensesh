export const selectedMatchingFilter = <T extends { readonly id: string }>(
  filteredRows: ReadonlyArray<T>,
  selectedIds: ReadonlySet<string>,
) => filteredRows.filter((row) => selectedIds.has(row.id));

export const toggleFilteredSelection = <T extends { readonly id: string }>(
  selectedIds: ReadonlySet<string>,
  filteredRows: ReadonlyArray<T>,
  selected: boolean,
) => {
  const next = new Set(selectedIds);
  for (const row of filteredRows) {
    if (selected) next.add(row.id);
    else next.delete(row.id);
  }
  return next;
};
