const fs = require('fs');

let page = fs.readFileSync('D:\\app\\chorei-app\\src\\app\\members\\page.tsx', 'utf8');

// Update FormData
page = page.replace(
  /interface FormData \{\n  name: string; grade: string; email: string; role: string; password: string;\n\}/,
  "interface FormData {\n  name: string; grade: string; email: string; role: string; password: string; lunchStatus: string;\n}"
);

// Update setForm defaults
page = page.replace(
  /setForm\(\{ name:'', grade:'E3a', email:'', role:'member', password:'' \}\);/g,
  "setForm({ name:'', grade:'E3a', email:'', role:'member', password:'', lunchStatus:'active' });"
);
page = page.replace(
  /setForm\(\{ name:'', grade:GRADE_ORDER\[0\], email:'', role:'member', password:'chorei2026' \}\);/g,
  "setForm({ name:'', grade:GRADE_ORDER[0], email:'', role:'member', password:'chorei2026', lunchStatus:'active' });"
);
page = page.replace(
  /setForm\(\{ name:user\.name, grade:user\.grade, email:user\.email\|\|'', role:user\.role, password:'' \}\);/g,
  "setForm({ name:user.name, grade:user.grade, email:user.email||'', role:user.role, password:'', lunchStatus:user.lunchStatus||'active' });"
);

// Add table header
page = page.replace(
  /\['名前','等級','メールアドレス','権限','操作'\]/,
  "['名前','等級','メールアドレス','権限','ランチ参加','操作']"
);

// Add table cell for lunchStatus
page = page.replace(
  /(<td className="px-5 py-3">\s*<Badge className=\{user\.role==='admin'\s*\?\s*'bg-\[\#00135D\]\/10 text-\[\#00135D\] border-\[\#00135D\]\/20 text-xs'\s*:\s*'bg-\[\#F5F7FA\] text-muted-foreground border-\[\#E0E4EF\] text-xs'\}>\s*\{user\.role==='admin'\?'運営':'参加者'\}\s*<\/Badge>\s*<\/td>)/,
  `$1\n                    <td className="px-5 py-3">\n                      <Badge className={user.lunchStatus==='active'?'bg-green-100 text-green-700 border-green-200 text-xs':'bg-gray-100 text-gray-500 border-gray-200 text-xs'}>\n                        {user.lunchStatus==='active'?'参加':'不参加'}\n                      </Badge>\n                    </td>`
);

// Add form field for lunchStatus
page = page.replace(
  /(<div>\s*<Label className="text-xs font-semibold text-\[\#3D4252\] mb-1\.5 block">権限<\/Label>\s*<Select value=\{form\.role\} onValueChange=\{v => setForm\(\{ \.\.\.form, role: v \|\| '' \}\)\}>\s*<SelectTrigger className="border-\[\#E0E4EF\] h-9 text-sm"><SelectValue \/><\/SelectTrigger>\s*<SelectContent>\s*<SelectItem value="member">参加者<\/SelectItem>\s*<SelectItem value="admin">運営<\/SelectItem>\s*<\/SelectContent>\s*<\/Select>\s*<\/div>)/,
  `$1\n              <div>\n                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">ランチ参加</Label>\n                <Select value={form.lunchStatus} onValueChange={v => setForm({ ...form, lunchStatus: v || 'active' })}>\n                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>\n                  <SelectContent>\n                    <SelectItem value="active">参加</SelectItem>\n                    <SelectItem value="inactive">不参加</SelectItem>\n                  </SelectContent>\n                </Select>\n              </div>`
);

fs.writeFileSync('D:\\app\\chorei-app\\src\\app\\members\\page.tsx', page);

// Update api/users/route.ts
let api = fs.readFileSync('D:\\app\\chorei-app\\src\\app\\api\\users\\route.ts', 'utf8');

api = api.replace(
  /const \{ name, grade, email, role, password \} = body;/,
  "const { name, grade, email, role, password, lunchStatus } = body;"
);

api = api.replace(
  /role: role \|\| 'member',\n      password: hashedPassword,/,
  "role: role || 'member',\n      lunchStatus: lunchStatus || 'active',\n      password: hashedPassword,"
);

api = api.replace(
  /email: true,\n      role: true,\n      createdAt: true,\n    \},\n  \}\);/g,
  "email: true,\n      role: true,\n      lunchStatus: true,\n      createdAt: true,\n    },\n  });"
);

fs.writeFileSync('D:\\app\\chorei-app\\src\\app\\api\\users\\route.ts', api);

console.log('done');
