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
    else:
        # if auth imported with other stuff, not typical, but check
        pass

    # Replace requireAdmin patterns
    admin_pattern = re.compile(
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = admin_pattern.sub("const session = await requireAdmin();", content)

    admin_pattern2 = re.compile(
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+ \|\| \w+\.user\?.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = admin_pattern2.sub("const session = await requireAdmin();", content)

    admin_pattern3 = re.compile(
        r"const session = await auth\(\);\s*if \(!session \?\? session\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = admin_pattern3.sub("const session = await requireAdmin();", content)
    
    admin_pattern4 = re.compile(
        r"const session = await auth\(\);\s*if \(!session\.user \|\| session\.user\.role !== ['\"]admin['\"]\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Forbidden['\"] \}, \{ status: 403 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = admin_pattern4.sub("const session = await requireAdmin();", content)

    # Replace requireUser patterns
    user_pattern = re.compile(
        r"const (?:session|authSession) = await auth\(\);\s*if \(!\w+\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = user_pattern.sub(lambda m: "const " + ("session" if "session" in m.group(0) else "authSession") + " = await requireUser();", content)

    user_pattern2 = re.compile(
        r"const session = await auth\(\);\s*if \(!session \|\| !session\.user\)\s*\{\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = user_pattern2.sub("const session = await requireUser();", content)

    user_pattern3 = re.compile(
        r"const session = await auth\(\);\s*if \(!session\?.user\)\s*\{\s*return new NextResponse\(['\"]Unauthorized['\"], \{ status: 401 \}\);\s*\}",
        re.MULTILINE | re.DOTALL
    )
    content = user_pattern3.sub("const session = await requireUser();", content)
    
    user_pattern4 = re.compile(
        r"const session = await auth\(\);\s*if \(!session\)\s*return NextResponse\.json\(\{ error: ['\"]Unauthorized['\"] \}, \{ status: 401 \}\);",
        re.MULTILINE | re.DOTALL
    )
    content = user_pattern4.sub("const session = await requireUser();", content)

    with open(fpath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Processed", fpath)
