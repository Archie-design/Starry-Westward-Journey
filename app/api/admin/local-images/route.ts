import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ALLOWED_FOLDERS = ['achievements', 'artifacts', 'avatars', 'chests', 'map-sprites', 'monsters', 'quest-icons'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

export async function GET(request: NextRequest) {
    const folder = request.nextUrl.searchParams.get('folder');

    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    }

    try {
        const dirPath = path.join(process.cwd(), 'public', 'images', folder);

        if (!fs.existsSync(dirPath)) {
            return NextResponse.json({ files: [] });
        }

        const entries = fs.readdirSync(dirPath);
        const files = entries
            .filter(name => IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase()))
            .sort()
            .map(name => ({
                name,
                path: `/images/${folder}/${name}`,
            }));

        return NextResponse.json({ files });
    } catch {
        return NextResponse.json({ files: [] });
    }
}
