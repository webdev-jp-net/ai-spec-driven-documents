import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { readTextFileSafe, resolveProjectPath } from "./file-operations.ts";

/**
 * キャッシュされた結果
 */
export interface CachedResult {
  hash: string;
  timestamp: number;
  input: {
    order: string;
    targetRepo: string;
    context: string | undefined;
  };
  result: any;
  version: string;
}

/**
 * 冪等性管理オプション
 */
export interface IdempotencyOptions {
  cacheDirectory: string;
  cacheTtl: number; // TTL in milliseconds
  version: string;
  enableDebug: boolean;
}

/**
 * 冪等性管理システム
 */
export class IdempotencyManager {
  private options: IdempotencyOptions;
  private cacheDir: string;

  constructor(options: Partial<IdempotencyOptions> = {}) {
    this.options = {
      cacheDirectory: '.cache/idempotency',
      cacheTtl: 24 * 60 * 60 * 1000, // 24時間
      version: '1.0.0',
      enableDebug: false,
      ...options
    };
    
    this.cacheDir = resolveProjectPath(this.options.cacheDirectory);
  }

  /**
   * 入力の正規化
   */
  async normalizeInput(order: string, targetRepo: string, context?: string): Promise<{
    normalizedOrder: string;
    hash: string;
  }> {
    // 1. 基本的な正規化
    let normalizedOrder = order
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // 複数のスペースを1つに
      .replace(/[。、！？]/g, '') // 句読点を除去
      .replace(/\n/g, ' '); // 改行をスペースに

    // 2. 基本的な正規化のみ（専門的な用語処理は既存システムに委譲）

    // 3. ハッシュ生成
    const hash = await this.generateHash(normalizedOrder, targetRepo, context);

    return {
      normalizedOrder,
      hash
    };
  }

  /**
   * キャッシュの確認
   */
  async checkCache(hash: string): Promise<CachedResult | null> {
    try {
      const cacheFile = join(this.cacheDir, `${hash}.json`);
      const cacheContent = await readTextFileSafe(cacheFile);
      
      if (!cacheContent) {
        if (this.options.enableDebug) {
          console.error(`[IdempotencyManager] Cache miss: ${hash}`);
        }
        return null;
      }

      const cachedResult: CachedResult = JSON.parse(cacheContent);

      // TTLチェック
      const now = Date.now();
      if (now - cachedResult.timestamp > this.options.cacheTtl) {
        if (this.options.enableDebug) {
          console.error(`[IdempotencyManager] Cache expired: ${hash}`);
        }
        await this.deleteCache(hash);
        return null;
      }

      // バージョンチェック
      if (cachedResult.version !== this.options.version) {
        if (this.options.enableDebug) {
          console.error(`[IdempotencyManager] Version mismatch: ${hash}`);
        }
        await this.deleteCache(hash);
        return null;
      }

      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cache hit: ${hash}`);
      }

      return cachedResult;
    } catch (error) {
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cache check error: ${error}`);
      }
      return null;
    }
  }

  /**
   * キャッシュの保存
   */
  async saveCache(hash: string, input: CachedResult['input'], result: any): Promise<void> {
    try {
      // キャッシュディレクトリの作成
      await this.ensureCacheDirectory();

      const cachedResult: CachedResult = {
        hash,
        timestamp: Date.now(),
        input,
        result,
        version: this.options.version
      };

      const cacheFile = join(this.cacheDir, `${hash}.json`);
      await Deno.writeTextFile(cacheFile, JSON.stringify(cachedResult, null, 2));

      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cache saved: ${hash}`);
      }
    } catch (error) {
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cache save error: ${error}`);
      }
    }
  }

  /**
   * キャッシュの削除
   */
  async deleteCache(hash: string): Promise<void> {
    try {
      const cacheFile = join(this.cacheDir, `${hash}.json`);
      await Deno.remove(cacheFile);
      
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cache deleted: ${hash}`);
      }
    } catch (error) {
      // ファイルが存在しない場合は無視
      if (this.options.enableDebug && !(error instanceof Deno.errors.NotFound)) {
        console.error(`[IdempotencyManager] Cache delete error: ${error}`);
      }
    }
  }

  /**
   * 全キャッシュのクリア
   */
  async clearAllCache(): Promise<number> {
    try {
      let deletedCount = 0;
      
      for await (const entry of Deno.readDir(this.cacheDir)) {
        if (entry.isFile && entry.name.endsWith('.json')) {
          await Deno.remove(join(this.cacheDir, entry.name));
          deletedCount++;
        }
      }

      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cleared ${deletedCount} cache entries`);
      }

      return deletedCount;
    } catch (error) {
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Clear cache error: ${error}`);
      }
      return 0;
    }
  }

  /**
   * 期限切れキャッシュの削除
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      let deletedCount = 0;
      const now = Date.now();
      
      for await (const entry of Deno.readDir(this.cacheDir)) {
        if (entry.isFile && entry.name.endsWith('.json')) {
          const cacheFile = join(this.cacheDir, entry.name);
          const cacheContent = await readTextFileSafe(cacheFile);
          
          if (cacheContent) {
            try {
              const cachedResult: CachedResult = JSON.parse(cacheContent);
              
              if (now - cachedResult.timestamp > this.options.cacheTtl) {
                await Deno.remove(cacheFile);
                deletedCount++;
              }
            } catch (parseError) {
              // 破損したキャッシュファイルは削除
              await Deno.remove(cacheFile);
              deletedCount++;
            }
          }
        }
      }

      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cleaned up ${deletedCount} expired cache entries`);
      }

      return deletedCount;
    } catch (error) {
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Cleanup error: ${error}`);
      }
      return 0;
    }
  }

  /**
   * キャッシュ統計の取得
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      let totalEntries = 0;
      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      for await (const entry of Deno.readDir(this.cacheDir)) {
        if (entry.isFile && entry.name.endsWith('.json')) {
          totalEntries++;
          
          const cacheFile = join(this.cacheDir, entry.name);
          const stat = await Deno.stat(cacheFile);
          totalSize += stat.size;
          
          const cacheContent = await readTextFileSafe(cacheFile);
          if (cacheContent) {
            try {
              const cachedResult: CachedResult = JSON.parse(cacheContent);
              
              if (oldestEntry === null || cachedResult.timestamp < oldestEntry) {
                oldestEntry = cachedResult.timestamp;
              }
              if (newestEntry === null || cachedResult.timestamp > newestEntry) {
                newestEntry = cachedResult.timestamp;
              }
            } catch (parseError) {
              // 破損したファイルは無視
            }
          }
        }
      }

      return {
        totalEntries,
        totalSize,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      if (this.options.enableDebug) {
        console.error(`[IdempotencyManager] Stats error: ${error}`);
      }
      return {
        totalEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }


  /**
   * ハッシュ生成
   */
  private async generateHash(normalizedOrder: string, targetRepo: string, context?: string): Promise<string> {
    const content = `${normalizedOrder}:${targetRepo}:${context || ''}:${this.options.version}`;
    
    // シンプルなハッシュ生成（実際の実装では crypto を使用）
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * キャッシュディレクトリの作成
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await ensureDir(this.cacheDir);
    } catch (error) {
      console.error(`Failed to create cache directory: ${this.cacheDir}`, error);
      throw error;
    }
  }
}

// デフォルトインスタンス
export const idempotencyManager = new IdempotencyManager({
  enableDebug: false // 本番環境では false
});