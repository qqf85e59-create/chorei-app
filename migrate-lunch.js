const fs = require('fs');
const path = require('path');

const filesToProcess = [
  "D:\\app\\chorei-app\\src\\app\\lunch\\new\\NewLunchForm.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\new\\page.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\DeleteEventButton.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\LunchManagementTabs.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\page.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\RecapTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\RestaurantTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\ScheduleTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\SelectionTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\SettlementTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\SurveyTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\lunch\\[id]\\tabs\\TopicTab.tsx",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\comment\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\photo\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\respond\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\select\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\settlement\\route.ts",
  "D:\\app\\chorei-app\\src\\app\\history\\page.tsx"
];

for (const file of filesToProcess) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Auth replacements
  content = content.replace(/import\s+\{\s*getServerSession\s*\}\s+from\s+['"]next-auth\/next['"];?/g, 'import { auth } from "@/lib/auth";');
  content = content.replace(/import\s+\{\s*authOptions\s*\}\s+from\s+['"]@\/lib\/auth['"];?/g, '');
  content = content.replace(/getServerSession\(authOptions\)/g, 'auth()');

  // user replacements
  content = content.replace(/\bmemberId\b/g, 'userId');
  content = content.replace(/\bmember\b/g, 'user');
  content = content.replace(/\bMember\b/g, 'User');
  content = content.replace(/\bexcludedMemberId\b/g, 'excludedUserId');
  content = content.replace(/\bexcludedMember\b/g, 'excludedUser');

  // Admin/role mapping
  content = content.replace(/role:\s*['"]staff['"]/g, "role: 'member'");
  content = content.replace(/role\s*===\s*['"]staff['"]/g, "role === 'member'");
  content = content.replace(/role:\s*['"]organizer['"]/g, "role: 'admin'");
  content = content.replace(/role\s*===\s*['"]organizer['"]/g, "role === 'admin'");
  content = content.replace(/user\.role\s*!==\s*['"]organizer['"]/g, "user.role !== 'admin'");

  fs.writeFileSync(file, content);
}

console.log("Migration script complete");
