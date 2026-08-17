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

  constructor(modelPath: string) {
    const raw = JSON.parse(fs.readFileSync(modelPath, "utf-8"));
    this.n = raw.n_gram;
    this.transitions = new Map();
    for (const [key, val] of Object.entries(raw.transitions)) {
      this.transitions.set(key, val as [string, number][]);
    }
    console.log(`[markov] loaded n_gram=${this.n}, contexts=${this.transitions.size}`);
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
