const fs = require('fs');

const files = [
    "d:\\app\\chorei-app\\src\\app\\api\\topics\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\sessions\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\sessions\\next-commentators\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\sessions\\mark-viewed\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\sessions\\commentators\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\sessions\\comment-order\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\rotation\\generate\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\phases\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\notifications\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\settlement\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\select\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\schedule\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\lunch\\[id]\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\lunch\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\holidays\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\config\\meeting-url\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\config\\meeting-url\\history\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\attendance\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\alerts\\route.ts",
    "d:\\app\\chorei-app\\src\\app\\api\\absence\\route.ts"
];

for (const fpath of files) {
    if (!fs.existsSync(fpath)) continue;
    let content = fs.readFileSync(fpath, 'utf8');

    // Change imports
    content = content.replace(
        "import { auth } from '@/lib/auth';", 
        "import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';"
    );

    const admin_patterns = [
        /const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\.role !== ['"]admin['"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Forbidden['"] \}, \{ status: 403 \}\);\s*\}/g,
        /const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\?.role !== ['"]admin['"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Forbidden['"] \}, \{ status: 403 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session \?\? session\.user\.role !== ['"]admin['"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Forbidden['"] \}, \{ status: 403 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session\.user \|\| session\.user\.role !== ['"]admin['"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Forbidden['"] \}, \{ status: 403 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session \|\| session\.user\.role !== ['"]admin['"]\)\s*\{\s*return new NextResponse\(['"]Forbidden['"], \{ status: 403 \}\);\s*\}/g
    ];
    for (const pat of admin_patterns) {
        content = content.replace(pat, "const session = await requireAdmin();");
    }

    const user_patterns = [
        /const (?:session|authSession) = await auth\(\);\s*if \(!\w+\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session \|\| !session\.user\)\s*\{\s*return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session\?.user\)\s*\{\s*return new NextResponse\(['"]Unauthorized['"], \{ status: 401 \}\);\s*\}/g,
        /const session = await auth\(\);\s*if \(!session\)\s*return NextResponse\.json\(\{ error: ['"]Unauthorized['"] \}, \{ status: 401 \}\);/g
    ];
    for (const pat of user_patterns) {
        content = content.replace(pat, "const session = await requireUser();");
    }

    const catch_pattern2 = /catch\s*\(([^)]+)\)\s*\{[^{}]*NextResponse\.json[^{}]*\}/g;
    content = content.replace(catch_pattern2, (match, err_var) => {
        return `catch (${err_var}) {\n    return handleApiError(${err_var});\n  }`;
    });

    if (content.includes("handleApiError") && !content.includes("import { requireUser") && !content.includes("import { handleApiError")) {
        content = "import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';\n" + content;
    }

    fs.writeFileSync(fpath, content, 'utf8');
    console.log("Processed", fpath);
}
