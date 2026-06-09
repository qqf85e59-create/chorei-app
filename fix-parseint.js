const fs = require('fs');

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
  "D:\\app\\chorei-app\\src\\app\\history\\page.tsx",
  "D:\\app\\chorei-app\\src\\lib\\selectionAlgorithm.ts",
];

for (const file of filesToProcess) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Fix parseInt for session user id
  content = content.replace(/parseInt\(\(session\.user\s+as\s+any\)\.id,\s*10\)/g, '(session.user as any).id as string');
  content = content.replace(/parseInt\(session\.user\.id,\s*10\)/g, '(session.user as any).id as string');
  content = content.replace(/parseInt\(String\(session\.user\.id\),\s*10\)/g, '(session.user as any).id as string');
  content = content.replace(/parseInt\(body\.userId,\s*10\)/g, 'body.userId');
  content = content.replace(/parseInt\(userId,\s*10\)/g, 'userId');
  content = content.replace(/userId\s*:\s*number/g, 'userId: string');
  content = content.replace(/excludedUserId\s*:\s*number/g, 'excludedUserId: string');
  content = content.replace(/excludedIds\s*:\s*number\[\]/g, 'excludedIds: string[]');
  content = content.replace(/previousParticipantIds\s*:\s*number\[\]/g, 'previousParticipantIds: string[]');
  content = content.replace(/useState<number\[\]>/g, 'useState<string[]>');
  content = content.replace(/Array<number>/g, 'Array<string>');
  
  // also check if any model imports have missing things.
  
  fs.writeFileSync(file, content);
}
console.log("parseInt fixed");
