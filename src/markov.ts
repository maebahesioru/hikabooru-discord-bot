// マルコフ連鎖ジェネレーター (v11モデル JSON版)
import fs from "fs";
import path from "path";

const BOS = "__BOS__";
const EOS = "__EOS__";

interface Transition {
  n: number;
  transitions: Map<string, [string, number][]>;
}

export class MarkovGenerator {
  private n: number;
  private transitions: Map<string, [string, number][]>;
  private vocab: Set<string> = new Set();

  constructor(modelPath: string) {
    const raw = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
    this.n = raw.n_gram;
    this.transitions = new Map();
    for (const [key, val] of Object.entries(raw.transitions)) {
      this.transitions.set(key, val as [string, number][]);
      // 語彙収集（キーのトークン + 値のトークン）
      const keyTokens = JSON.parse(key) as string[];
      for (const t of keyTokens) this.vocab.add(t);
      for (const [tok] of val as [string, number][]) this.vocab.add(tok);
    }
    console.log(`[markov] loaded n_gram=${this.n}, contexts=${this.transitions.size}, vocab=${this.vocab.size}`);
  }

  /**
   * ランダムに1文を生成する
   * @param maxTokens 最大トークン数
   * @param minLen 最小トークン数
   */
  generate(maxTokens = 200, minLen = 1): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      const ctx: string[] = Array(this.n - 1).fill(BOS);
      const tokens: string[] = [];

      for (let i = 0; i < maxTokens; i++) {
        const key = JSON.stringify(ctx);
        const candidates = this.transitions.get(key);
        if (!candidates || candidates.length === 0) break;

        // 重み付きランダム選択
        let t = this.pickWeighted(candidates);
        // URL/メンションっぽいトークンを避ける
        for (let guard = 0; guard < 50 && (t.startsWith("@") || t.startsWith("http")); guard++) {
          t = this.pickWeighted(candidates);
        }
        if (t.startsWith("@") || t.startsWith("http")) break;

        if (t === EOS) {
          if (tokens.length < minLen) {
            // 短すぎるので最初からやり直し
            break;
          }
          return tokens.join("").replace(/\\n/g, "\n");
        }
        tokens.push(t);
        ctx.shift();
        ctx.push(t);
      }

      if (tokens.length >= minLen) {
        return tokens.join("").replace(/\\n/g, "\n");
      }
    }
    return "";
  }

  /**
   * ユーザーの文章に「沿って」マルコフ連鎖で続きを生成する。
   * 文章の末尾からモデルの語彙と一致するトークンを探し、
   * そのトークンをコンテキストに含むチェーンから続きを生成する。
   * @param userText メンションに含まれていた文章
   */
  generateFromSeed(userText: string, maxTokens = 80, minLen = 1): string {
    const seed = this.findSeedToken(userText);
    if (!seed) {
      // 語彙と一致なし → 通常生成
      return this.generate(maxTokens, minLen);
    }

    // シードトークンを含むコンテキストを探す
    // 優先順位: 1) ctx末尾=seed (続き)  2) ctx先頭=seed  3) seed+BOS
    const ctxKeys = Array.from(this.transitions.keys());
    const keysWithSeedEnd = ctxKeys.filter((k) => {
      const toks = JSON.parse(k) as string[];
      return toks[toks.length - 1] === seed;
    });
    const keysWithSeedStart = ctxKeys.filter((k) => {
      const toks = JSON.parse(k) as string[];
      return toks[0] === seed;
    });

    let startCtx: string[] | null = null;
    if (keysWithSeedEnd.length > 0) {
      // ctx末尾がseed → そのまま続きを生成
      startCtx = JSON.parse(keysWithSeedEnd[Math.floor(Math.random() * keysWithSeedEnd.length)]) as string[];
    } else if (keysWithSeedStart.length > 0) {
      // ctx先頭がseed → seedを先頭に置いて続きを生成
      startCtx = JSON.parse(keysWithSeedStart[Math.floor(Math.random() * keysWithSeedStart.length)]) as string[];
    } else {
      // seed単独 + BOS
      startCtx = [seed, ...Array(this.n - 2).fill(BOS)];
    }

    // startCtx から生成
    const tokens: string[] = [];
    let ctx = startCtx;
    for (let i = 0; i < maxTokens; i++) {
      const key = JSON.stringify(ctx);
      const candidates = this.transitions.get(key);
      if (!candidates || candidates.length === 0) break;

      let t = this.pickWeighted(candidates);
      for (let guard = 0; guard < 50 && (t.startsWith("@") || t.startsWith("http")); guard++) {
        t = this.pickWeighted(candidates);
      }
      if (t.startsWith("@") || t.startsWith("http")) break;

      if (t === EOS) {
        if (tokens.length >= minLen) break;
        continue;
      }
      tokens.push(t);
      ctx = [...ctx.slice(1), t];
    }

    if (tokens.length >= minLen) {
      return tokens.join("").replace(/\\n/g, "\n");
    }
    return this.generate(maxTokens, minLen);
  }

  /**
   * ユーザー文章の末尾からモデル語彙と一致するトークンを探す（最長一致）
   */
  private findSeedToken(userText: string): string | null {
    const clean = userText.replace(/[\s\n\r]+/g, "").slice(-20);
    if (!clean) return null;

    // 末尾から1文字ずつ開始位置をずらして、最長一致を探す
    for (let start = clean.length - 1; start >= 0; start--) {
      for (let len = Math.min(6, clean.length - start); len >= 1; len--) {
        const candidate = clean.slice(start, start + len);
        if (this.vocab.has(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  private pickWeighted(candidates: [string, number][]): string {
    const total = candidates.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [tok, w] of candidates) {
      r -= w;
      if (r <= 0) return tok;
    }
    return candidates[candidates.length - 1][0];
  }
}
