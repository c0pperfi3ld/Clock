// Stub for Electron's window.clockAPI so renderer.js can run in a plain browser.
const today = (() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
})();
function mkTask(i, n) {
  const hue = (i * 47) % 360;
  const subs = [];
  for (let j=0;j<(i%3);j++) subs.push({ id:'s'+i+'-'+j, text:'sub '+i+'.'+j, done:false, weight:0, color:`hsl(${hue},85%,60%)`, elapsedColor:`hsl(${hue},60%,40%)`, collapsed:false, subtasks:[] });
  return {
    id: 'seed-' + i, text: 'Task number ' + i, done: false, createdAt: Date.now(),
    weight: i % 3, color: `hsl(${hue},85%,60%)`, elapsedColor: `hsl(${hue},60%,40%)`, subtasks: subs
  };
}
function buildTasks(n){ return Array.from({length:n},(_,i)=>mkTask(i,n)); }
window.__seed = {
  todosByDate: { [today]: { lists: [ { id:'list-1', name:'List 1', todos: buildTasks(8) } ], active: 0 } },
  selectedTodoDate: today
};
// Simulate the real main process: when renderer asks to fit, grow the viewport height.
const fitHandler = (need) => {
  const add = (need.bottom || 0) + (need.top || 0) + 4;
  const cur = window.innerHeight;
  // emulate win.setBounds growing height (main caps to work area; ignore cap here)
  window.__growViewport(add);
};
window.clockAPI = new Proxy({ loadSettings: () => window.__seed, fitWindow: fitHandler }, { get: (t, p) => (p in t ? t[p] : (() => {})) });
