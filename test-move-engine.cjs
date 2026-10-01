// Standalone test for the todo drag-move engine + URL shortening.
// Mirrors the implementations in renderer.js (extracted identically).
const assert = require('assert');

// ── extracted engine (must match renderer.js) ──
let todos = [];
let saveCount = 0;
function getNodeByPath(pathArr) {
  if (!pathArr || !pathArr.length) return null;
  let curr = todos.find(x => x.id === pathArr[0]);
  if (!curr) return null;
  for (let i = 1; i < pathArr.length; i++) {
    if (!curr.subtasks) return null;
    curr = curr.subtasks.find(x => x.id === pathArr[i]);
    if (!curr) return null;
  }
  return curr;
}
function getParentByPath(pathArr) { return getNodeByPath(pathArr.slice(0, -1)); }
function ensureSubtasks(t) { if (!Array.isArray(t.subtasks)) t.subtasks = []; return t.subtasks; }
function containsId(node, id) {
  if (!node || !Array.isArray(node.subtasks)) return false;
  return node.subtasks.some(s => s.id === id || containsId(s, id));
}
function detachNode(id) {
  const ti = todos.findIndex(t => t.id === id);
  if (ti >= 0) { todos.splice(ti, 1); return true; }
  for (const t of todos) {
    const stack = [t];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.subtasks && cur.subtasks.length) {
        const si = cur.subtasks.findIndex(x => x.id === id);
        if (si >= 0) { cur.subtasks.splice(si, 1); return true; }
        cur.subtasks.forEach(x => stack.push(x));
      }
    }
  }
  return false;
}
function isInsideSubtree(dstPath, srcPath) {
  if (!dstPath || dstPath.length < srcPath.length) return false;
  for (let i = 0; i < srcPath.length; i++) if (dstPath[i] !== srcPath[i]) return false;
  return true;
}
function moveNode(srcPath, dstPath, pos) {
  if (!srcPath || !srcPath.length) return;
  const srcId = srcPath[srcPath.length - 1];
  if (isInsideSubtree(dstPath, srcPath)) return;
  const src = getNodeByPath(srcPath);
  if (!src) return;
  if (!detachNode(srcId)) return;
  const dst = (dstPath && dstPath.length) ? getNodeByPath(dstPath) : null;
  if (!dstPath || !dstPath.length) {
    todos.push(src);
  } else if (!dst) {
    todos.push(src);
  } else if (pos === 'inside-end') {
    ensureSubtasks(dst).push(src);
    dst.collapsed = false;
  } else if (dstPath.length === 1) {
    let idx = todos.findIndex(t => t.id === dst.id);
    if (idx < 0) idx = todos.length;
    if (pos === 'after') idx += 1;
    todos.splice(idx, 0, src);
  } else {
    const parent = getParentByPath(dstPath);
    if (!parent) { todos.push(src); }
    else {
      ensureSubtasks(parent);
      let idx = parent.subtasks.findIndex(x => x.id === dst.id);
      if (idx < 0) idx = parent.subtasks.length;
      if (pos === 'after') idx += 1;
      parent.subtasks.splice(idx, 0, src);
      parent.collapsed = false;
    }
  }
}

function fresh() {
  todos = [
    { id: 'A', text: 'a' },
    { id: 'B', text: 'b', subtasks: [{ id: 'b1', text: 'b1' }, { id: 'b2', text: 'b2', subtasks: [{ id: 'b2x' }] }] },
    { id: 'C', text: 'c' },
  ];
}
const topIds = () => todos.map(t => t.id).join(',');
const subIds = (id) => (todos.find(t => t.id === id).subtasks || []).map(s => s.id).join(',');

// 1. parent reorder before
fresh(); moveNode(['A'], ['C'], 'before');
assert.equal(topIds(), 'B,A,C');
// 2. parent reorder after
fresh(); moveNode(['C'], ['A'], 'after');
assert.equal(topIds(), 'A,C,B');
// 3. demote parent into another parent (middle-drop)
fresh(); moveNode(['A'], ['B'], 'inside-end');
assert.equal(topIds(), 'B,C');
assert.equal(subIds('B'), 'b1,b2,A');
// 4. subtask reorder before sibling
fresh(); moveNode(['B', 'b2'], ['B', 'b1'], 'before');
assert.equal(subIds('B'), 'b2,b1');
// 5. subtask -> inside another parent (demote deeper)
fresh(); moveNode(['B', 'b1'], ['C'], 'inside-end');
assert.equal(subIds('B'), 'b2');
assert.equal(subIds('C'), 'b1');
// 6. promote: subtask dropped into empty dst = top-level end
fresh(); moveNode(['B', 'b1'], [], 'top-end');
assert.equal(subIds('B'), 'b2');
assert.equal(topIds(), 'A,B,C,b1');
// 7. promote: subtask inserted before a top-level
fresh(); moveNode(['B', 'b2'], ['C'], 'before');
assert.equal(subIds('B'), 'b1');
assert.equal(topIds(), 'A,B,b2,C');
// 8. deep subtask moves with its own subtree intact
fresh(); moveNode(['B', 'b2'], ['A'], 'inside-end');
assert.equal(subIds('B'), 'b1');
assert.equal(subIds('A'), 'b2');
assert.equal(todos.find(t => t.id === 'A').subtasks[0].subtasks[0].id, 'b2x');
// 9. guard: dropping parent into its own subtree is a no-op (task NOT lost)
fresh(); moveNode(['B'], ['B', 'b1'], 'inside-end');
assert.equal(topIds(), 'A,B,C');
assert.equal(subIds('B'), 'b1,b2');
// 10. guard: dropping onto itself no-op
fresh(); moveNode(['A'], ['A'], 'before');
assert.equal(topIds(), 'A,B,C');
// 11. conservation: deep node moves and total node count never changes
fresh();
moveNode(['B', 'b2', 'b2x'], ['A'], 'inside-end');
assert.equal(getNodeByPath(['A', 'b2x']).id, 'b2x');
assert.equal(getNodeByPath(['B', 'b2']).subtasks.length, 0);
assert.equal(todos.reduce((a, t) => a + (function c(n) { return 1 + (n.subtasks || []).reduce((x, s) => x + c(s), 0); })(t), 0), 6);
console.log('moveNode: 11/11 pass');

// ── shortenUrl mirror ──
function shortenUrl(url) {
  try {
    const maxLen = 35;
    if (url.length <= maxLen) return url;
    const parsed = new URL(url);
    const prefix = parsed.protocol + '//' + parsed.hostname.replace(/^www\./, '');
    const vid = parsed.searchParams.get('v') || (parsed.hostname.includes('youtu.be') ? parsed.pathname.slice(1) : '');
    if (vid && (prefix.length + vid.length + 4) < maxLen) {
      return prefix + '/.../' + vid;
    }
    const pathParts = parsed.pathname.split('/').filter(p => p);
    const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
    if (lastPart && (prefix.length + lastPart.length + 4) < maxLen) {
      return prefix + '/.../' + lastPart;
    }
    const keepStart = Math.floor(maxLen * 0.6);
    const keepEnd = maxLen - keepStart - 3;
    return url.slice(0, keepStart) + '...' + url.slice(-keepEnd);
  } catch {
    if (url.length <= 35) return url;
    return url.slice(0, 32) + '...';
  }
}
assert.equal(shortenUrl('https://example.com'), 'https://example.com');
let r = shortenUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.ok(r.length <= 35, r);
assert.ok(r.includes('youtube.com'), r);
r = shortenUrl('https://github.com/torvalds/linux/blob/master/README.md');
assert.ok(r.length <= 35, r);
assert.ok(r.includes('github.com'), r);
r = shortenUrl('not a url at all but really quite long text here');
assert.ok(r.length <= 35, r);
console.log('shortenUrl: pass ->', shortenUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), '|', shortenUrl('https://github.com/torvalds/linux/blob/master/README.md'));
