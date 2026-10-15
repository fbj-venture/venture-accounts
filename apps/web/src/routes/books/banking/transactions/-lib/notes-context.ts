import { createContext } from "react"

/** Note typed per row, keyed by journalLineId - saved with the row. */
export type NotesState = {
  notes: ReadonlyMap<number, string>
  onNoteChange: (journalLineId: number, note: string) => void
}

// The notes reach their cells through context rather than through getColumns.
// flexRender mounts each cell function as a component, so a cell function
// that is re-created whenever a note changes is a new component type on
// every keystroke - React then remounts the input and it loses focus.
//
// Kept in a module of its own: the table (provider) and the Note cell
// (consumer) must share one context object. If it lived in columns.tsx, a
// hot reload of that file could give the cell a new context while the table
// still provided the old one, and the cell would fall back to this default -
// whose handler does nothing, so nothing could be typed.
export const NotesContext = createContext<NotesState>({
  notes: new Map(),
  onNoteChange: () => {},
})
