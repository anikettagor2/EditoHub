const fs = require('fs');
const p = 'c:/project/editohub/functions/src/index.ts';
let c = fs.readFileSync(p, 'utf8');
const idx = c.indexOf('export * from');
if (idx !== -1) {
  c = c.substring(0, idx) + 'export * from "./mov-to-mp4";\n';
  fs.writeFileSync(p, c);
}
