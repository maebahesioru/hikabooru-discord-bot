// hikabooru ランダム動画像 & ヒカマーマルコフ連鎖 Discord bot
import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";
import path from "path";
import { MarkovGenerator } from "./markov";
import { getRandomMedia } from "./hikabooru";

const TOKEN = process.env.DISCORD_TOKEN || "";
const MODEL_PATH = process.env.MARKOV_MODEL
  || path.resolve(process.cwd(), "data", "markov_model.json");

if (!TOKEN) {
  console.error("[fatal] DISCORD_TOKEN not set");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let markov: MarkovGenerator;

// 連投防止: チャンネルID → 最終返信時刻
const lastReplyAt = new Map<string, number>();
const COOLDOWN_MS = 5000;

client.once("ready", () => {
  console.log(`[ready] Logged in as ${client.user?.tag} (${client.user?.id})`);
  console.log(`[ready] guilds: ${client.guilds.cache.size}`);
});

client.on("messageCreate", async (msg) => {
  // bot自身・他のbotは無視
  if (msg.author.bot) return;
  // メンションされた時のみ反応
  if (!msg.mentions.has(client.user!.id)) return;

  // クールダウン
  const now = Date.now();
  const last = lastReplyAt.get(msg.channelId) || 0;
  if (now - last < COOLDOWN_MS) return;
  lastReplyAt.set(msg.channelId, now);

  // 処理中インジケーター
  msg.channel.sendTyping().catch(() => {});

  try {
    const text = markov.generate(200, 1);
    const media = await getRandomMedia();
    const content = text.trim() ? text : "…";

    await msg.reply({
      content,
      files: [{ attachment: media.path, name: `hikabooru${media.ext}` }],
    });

    // 一時ファイル削除
    try { fs.unlinkSync(media.path); } catch {}
  } catch (err: any) {
    console.error(`[error] ${err?.message || err}`);
    try {
      await msg.reply(`⚠️ エラー: ${err?.message || "不明なエラー"}`);
    } catch {}
  }
});

async function main() {
  try {
    markov = new MarkovGenerator(MODEL_PATH);
  } catch (err: any) {
    console.error(`[fatal] Markov model load failed: ${err?.message}`);
    process.exit(1);
  }
  await client.login(TOKEN);
}

main();
