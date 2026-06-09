const fs = require('fs');

const files = [
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\comment\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\photo\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\respond\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\select\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\settlement\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\page.tsx",
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace { params }: { params: { id: string } } with { params }: { params: Promise<{ id: string }> }
  content = content.replace(/\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{\s*id\s*:\s*string\s*\}?\s*\}/g, '{ params }: { params: Promise<{ id: string }> }');
  
  // Replace page prop type
  content = content.replace(/params\s*:\s*\{\s*id\s*:\s*string\s*\}/g, 'params: Promise<{ id: string }>');
  
  content = content.replace(/params\.id/g, '(await params).id');

  fs.writeFileSync(file, content);
}
console.log("params fix done");
