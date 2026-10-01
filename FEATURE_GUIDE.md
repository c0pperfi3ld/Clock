# New Todo Features Guide

## 1. URL Links with Smart Shortening

### Adding a link
Just paste any URL into a task:
```
Check out https://www.youtube.com/watch?v=dQw4w9WgXcQ
Read https://github.com/torvalds/linux/blob/master/Documentation/process/coding-style.rst
```

### What you see
- YouTube links: **▶ https://youtube.com/.../dQw4w9WgXcQ** (red play logo + video ID)
- Regular links: **https://github.com/.../coding-style.rst** (domain + filename)
- All shortened to ~35-40 characters with dots in the middle
- Hover shows full URL in tooltip
- Click opens in your default browser

### Editing
- Click the **text** (not the link) to edit
- The full raw URL appears so you can edit it properly
- After saving, it renders shortened again

---

## 2. Drag & Drop — Any Task Anywhere

### Making a task a subtask (demote)
1. **Grab** any parent task (cursor changes to grab hand)
2. **Drag** it over another task
3. Drop in the **middle third** of the target → becomes a subtask

### Promoting a subtask to top-level
1. **Grab** any subtask
2. **Drag** to the **top or bottom** of a parent task
3. Drop → inserts before/after that parent (promoted)

### Reordering
- Drop on **top third** of a card = insert **before** it
- Drop on **bottom third** = insert **after** it
- Works for both parents and subtasks

### Visual feedback
- While dragging: semi-transparent ghost
- Drop zones show colored indicator:
  - Purple line above = insert before
  - Purple line below = insert after
  - Dashed purple outline = becomes a subtask

### Rules
- Can't drop a task inside its own subtree (guards against data loss)
- Whole nested trees move together (subtasks stay attached)
- Empty space at bottom = appends to top-level

---

## 3. State Restoration

### What persists
- **Last viewed date** (from the calendar)
- **Active category tab** (List 1, List 2, etc.)

### How it works
- Close the app anytime
- Reopen → you're back on the same date and category you were viewing
- Midnight auto-rollover still works (today's date updates at 00:00)

### Testing it
1. Open calendar (📅 button)
2. Click a different date (yesterday, last week)
3. Switch to a different category tab
4. Close the app
5. Reopen → same date + tab active

---

## Keyboard Shortcuts (existing, still work)

- **Enter** in add-box → create task
- **Escape** while editing → cancel
- Click **×** on a task → delete
- Click **▲▼** → adjust weight (stacking order)
- Click **+** next to a task → add subtask

---

## Technical Notes

### For developers
- `e2e-todo.cjs` — full integration test (19 assertions, real Electron app)
- `test-move-engine.cjs` — unit tests for drag logic (11 cases)
- Run: `node e2e-todo.cjs` (uses isolated profile, won't touch your data)

### Files changed
- `renderer.js` — link parsing, drag engine, state restore
- `index.css` — link styles, YouTube logo, drag cursors/indicators
- `main.js` + `preload.js` — `shell.openExternal` for opening links
- All changes are backward-compatible with existing saved data

### Browser compatibility
- Links open via `shell.openExternal()` — uses your OS default browser
- Never opens in Electron (no security risk, no accidental windows)

---

## Known Behavior

- **Link detection**: Only `http://` and `https://` URLs are detected (no bare `example.com`)
- **Shortening**: Keeps domain + meaningful last part (video ID, filename, page)
- **Drag zones**: 3-way split (top 28%, middle 44%, bottom 28%) — middle is the "nest inside" zone
- **State**: Each calendar date has isolated todo lists (switching dates = switching workspaces)

---

## Troubleshooting

### Links don't shorten
- Make sure the URL starts with `http://` or `https://`
- After editing, press Enter or click away to save

### Drag doesn't work
- Click directly on the task card (not inside an input/button)
- Make sure you're not in edit mode (no blinking cursor)
- Cards become draggable after renderer loads (tab bar appears)

### State doesn't restore
- `selectedTodoDate` is saved on every todo change
- Check `%APPDATA%\clock-widget\clock-settings.json`
- Should see `"selectedTodoDate": "2026-09-16"` etc.

### YouTube logo missing
- URL must contain `youtube.com` or `youtu.be`
- Logo is an inline SVG (red rectangle + white play triangle)
- Renders inside the `<a>` tag for full click area

---

Enjoy your enhanced todo workflow! 🎉
