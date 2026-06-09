import os
import re

files = [
    r"d:\app\chorei-app\src\app\api\topics\route.ts",
    r"d:\app\chorei-app\src\app\api\sessions\route.ts",
    r"d:\app\chorei-app\src\app\api\sessions\next-commentators\route.ts",
    r"d:\app\chorei-app\src\app\api\sessions\mark-viewed\route.ts",
    r"d:\app\chorei-app\src\app\api\sessions\commentators\route.ts",
    r"d:\app\chorei-app\src\app\api\sessions\comment-order\route.ts",
    r"d:\app\chorei-app\src\app\api\rotation\generate\route.ts",
    r"d:\app\chorei-app\src\app\api\phases\route.ts",
    r"d:\app\chorei-app\src\app\api\notifications\route.ts",
    r"d:\app\chorei-app\src\app\api\lunch\[id]\settlement\route.ts",
    r"d:\app\chorei-app\src\app\api\lunch\[id]\select\route.ts",
    r"d:\app\chorei-app\src\app\api\lunch\[id]\schedule\route.ts",
    r"d:\app\chorei-app\src\app\api\lunch\[id]\route.ts",
    r"d:\app\chorei-app\src\app\api\lunch\route.ts",
    r"d:\app\chorei-app\src\app\api\holidays\route.ts",
    r"d:\app\chorei-app\src\app\api\config\meeting-url\route.ts",
    r"d:\app\chorei-app\src\app\api\config\meeting-url\history\route.ts",
    r"d:\app\chorei-app\src\app\api\attendance\route.ts",
    r"d:\app\chorei-app\src\app\api\alerts\route.ts",
    r"d:\app\chorei-app\src\app\api\absence\route.ts"
]

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()

    # Change imports
    if "import { auth } from '@/lib/auth';" in content:
        content = content.replace("import { auth } from '@/lib/auth';", "import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';")

    # Replace requireAdmin patterns
    admin_patterns = [
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\?.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session \?\? session\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session\.user \|\| session\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session \|\| session\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return new NextResponse\(['\"]Forbidden['\"], \{ status: 403 \}\);\s*\}"
    ]
    for pat in admin_patterns:
        content = re.sub(pat, "const session = await requireAdmin();", content)

    # Replace requireUser patterns
    user_patterns = [
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session \|\| !session\.user\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session\?.user\)\s*\{\s*return new NextResponse\(['\"]Unauthorized['\"], \{ status: 401 \}\);\s*\}",
        r"const session = await auth\(\);\s*if \(!session\)\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);"
    ]
    for pat in user_patterns:
        content = re.sub(pat, r"const session = await requireUser();", content)

    # Change all catch blocks to use handleApiError
    catch_pattern = r"catch\s*\(([^)]+)\)\s*\{[^}]*return\s+NextResponse\.json\([^}]+\};\s*\}"
    # Wait, the block might be multiline and have console.error.
    # Let's use a simpler regex for the catch block:
    catch_pattern2 = re.compile(r"catch\s*\(([^)]+)\)\s*\{[^{}]*NextResponse\.json[^{}]*\}", re.DOTALL)
    
    def replacer(match):
        err_var = match.group(1)
        # if there are nested braces this will break, but let's hope it's flat
        return f"catch ({err_var}) {{\n    return handleApiError({err_var});\n  }}"
    
    content = catch_pattern2.sub(replacer, content)

    # Add missing imports if handleApiError is used but not imported
    if "handleApiError" in content and "import { requireUser" not in content and "import { handleApiError" not in content:
        content = "import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';\n" + content

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Processed", fpath)
