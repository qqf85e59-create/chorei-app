const fs = require('fs');
const path = require('path');

const apiFiles = [
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\comment\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\photo\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\respond\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\select\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\settlement\\route.ts",
];

const pageFiles = [
  "D:\\app\\chorei-app\\src\\app\\history\\page.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\new\\page.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\page.tsx",
];

for (const file of apiFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Remove requireOrganizer imports
  content = content.replace(/import\s*\{\s*[^}]*requireOrganizer[^}]*\}\s*from\s*['"]@\/lib\/auth['"];?/g, '');
  content = content.replace(/import\s*\{\s*[^}]*requireParticipantOrOrganizer[^}]*\}\s*from\s*['"]@\/lib\/auth['"];?/g, '');
  
  // Replace auth imports
  content = content.replace(/import\s+\{\s*getServerSession\s*\}\s+from\s+['"]next-auth['"];?/g, 'import { auth } from "@/lib/auth";');
  content = content.replace(/import\s+\{\s*authOptions\s*\}\s+from\s+['"]@\/lib\/auth['"];?/g, '');

  // Replace requireOrganizer() usage
  const authBlockAdmin = `const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }`;

  content = content.replace(/const\s+\{\s*session,\s*error:\s*authError\s*\}\s*=\s*await\s+requireOrganizer\(\);[\s\S]*?if\s*\(authError\)\s*return\s*authError;/g, authBlockAdmin);
  
  const authBlockAny = `const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }`;
  content = content.replace(/const\s+\{\s*session,\s*error:\s*authError\s*\}\s*=\s*await\s+requireParticipantOrOrganizer\([^)]*\);[\s\S]*?if\s*\(authError\)\s*return\s*authError;/g, authBlockAny);

  fs.writeFileSync(file, content);
}

for (const file of pageFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/import\s+Header\s+from\s+['"]@\/components\/Header['"];?/g, 'import { Header } from "@/components/header";');
  content = content.replace(/<Header\s*\/>/g, '<Header />');

  fs.writeFileSync(file, content);
}

// Fix selectionAlgorithm.ts
const selectionFile = "D:\\app\\chorei-app\\src\\lib\\selectionAlgorithm.ts";
if (fs.existsSync(selectionFile)) {
  let content = fs.readFileSync(selectionFile, 'utf8');
  content = content.replace(/\bmemberId\b/g, 'userId');
  content = content.replace(/\bmember\b/g, 'user');
  content = content.replace(/\bMember\b/g, 'User');
  content = content.replace(/role:\s*['"]staff['"]/g, "role: 'member'");
  fs.writeFileSync(selectionFile, content);
}

console.log("Fix script complete");
