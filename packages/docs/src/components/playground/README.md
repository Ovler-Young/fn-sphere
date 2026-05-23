# Playground components

Interactive playground for defining table columns, building filter rules with Filter Sphere, and previewing filtered data.

## Parts

- Column builder: add/edit columns (text, number, boolean, select, multi-select, date) and manage per-row values.
- Filter builder: uses `FilterSphereProvider` + `FilterBuilder` to author filters against the dynamic schema.
- Table: renders current rows with applied filters.

## Usage

The playground is used by the docs page at `src/content/docs/reference/playground.mdx`. It is not published as a package export. Components are kept in this folder for clarity.

## Key ideas

- Schema is derived from user-defined columns; filters use `findFilterableFields` via `useFilterSphere`.
- Filter arguments can target fixed values, another compatible field, or a one-level expression such as `age > otherAge`, `age > 10 * factor`, or `birthday before startDate + 1 year 2 months 10 days`.
- Data lives in a local React state; changing columns resets row values for invalid fields.
- Minimal seeded rows (5–7) keep the UI fast; users can add/remove rows.

## Development

- Components are client-rendered in Astro with `client:load`.
- Keep styling minimal and utility-first (Tailwind classes available in docs).
