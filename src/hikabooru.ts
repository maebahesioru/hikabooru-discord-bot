// hikabooru クライアント — 完全ランダムなメディアを取得
import fs from "fs";
import os from "os";
import path from "path";

const BASE = "https://hikabooru.hikamers.app";
const MAX_VIDEO_DURATION_SEC = 140; // Xと同じ制限（Discordにも適用）

interface HikabooruPost {
  id: number;
  safety: string;
  type: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  tags?: { names: string[] }[];
}

export interface MediaResult {
  path: string; // ダウンロード済みファイルのパス
  ext: string;  // 拡張子
  isVideo: boolean;
}

function postType(post: HikabooruPost): string {
  const t = post.type || "";
  if (t === "flash") return "flash";
  return t;
}

export async function getRandomPost(): Promise<HikabooruPost> {
  // 総数を取得してランダムオフセット
  const total = await getPostCount();
  const offset = Math.floor(Math.random() * total);
  const res = await fetch(`${BASE}/api/posts?query=sort:random&limit=1&offset=${offset}`);
  if (!res.ok) throw new Error(`hikabooru API error: ${res.status}`);
  const data = await res.json();
  const post = data.results?.[0];
  if (!post) throw new Error("hikabooru: no post returned");
  return post;
}

async function getPostCount(): Promise<number> {
  const res = await fetch(`${BASE}/api/posts?query=sort:random&limit=1`);
  if (!res.ok) throw new Error(`hikabooru API error: ${res.status}`);
  const data = await res.json();
  return data.total ?? data.totalCount ?? data.count ?? 100000;
}

function contentUrl(post: HikabooruPost): string {
  if (post.contentUrl) return `${BASE}/${post.contentUrl}`;
  // フォールバック: thumbnailUrl から復元
  const thumb = post.thumbnailUrl || "";
  if (!thumb) return "";
  const base = thumb.replace("generated-thumbnails", "posts").replace(/\.[^.]+$/, "");
  const ext = post.type === "video" ? ".mp4" : ".jpg";
  return `${BASE}/${base}${ext}`;
}

export async function getRandomMedia(): Promise<MediaResult> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const post = await getRandomPost();
    const ptype = postType(post);
    if (ptype === "flash") continue;
    const url = contentUrl(post);
    if (!url) continue;
    try {
      const tmpPath = await download(url);
      const isVideo = ptype === "video";
      // Discordの添付上限 (25MB) を超えるものはスキップ
      const size = fs.statSync(tmpPath).size;
      if (size > 24 * 1024 * 1024) {
        fs.unlinkSync(tmpPath);
        continue;
      }
      return { path: tmpPath, ext: path.extname(url), isVideo };
    } catch {
      // 404等 → 次の投稿へ
      continue;
    }
  }
  throw new Error("hikabooru: 20回試行しても取得できませんでした");
}

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || ".jpg";
  const tmpPath = path.join(os.tmpdir(), `hikabooru_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
}
