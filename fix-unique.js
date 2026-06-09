const fs = require('fs');

const allFiles = [
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

for (const file of allFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/eventId_memberId/g, 'eventId_userId');
  content = content.replace(/candidateId_memberId/g, 'candidateId_userId');

  fs.writeFileSync(file, content);
}
console.log("Unique indexes fixed");
