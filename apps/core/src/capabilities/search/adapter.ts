import { AppError } from '../../errors/app-error';
import { ERROR_CODE } from '../../errors/error-code';

export type SearchProvider = 'default' | 'tavily' | 'bocha' | 'baidu_ai_search';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  citation?: string;
}

export interface SearchResponse {
  provider: SearchProvider;
  query: string;
  items: SearchResultItem[];
}

const SUPPORTED_PROVIDERS: SearchProvider[] = ['default', 'tavily', 'bocha', 'baidu_ai_search'];

export class WebSearchAdapter {
  private readonly provider: SearchProvider;

  constructor(provider?: string) {
    this.provider = this.resolveProvider(provider);
  }

  getProvider(): SearchProvider {
    return this.provider;
  }

  health(): { enabled: boolean; healthy: boolean } {
    return {
      enabled: true,
      healthy: true
    };
  }

  async search(query: string): Promise<SearchResponse> {
    if (!query.trim()) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Search query cannot be empty');
    }

    const normalized = query.trim();
    const encoded = encodeURIComponent(normalized);

    const items: SearchResultItem[] = [
      {
        title: `${this.provider} result 1`,
        url: `https://example.com/search/${encoded}/1`,
        snippet: `Result from ${this.provider} for "${normalized}"`,
        citation: `source:${this.provider}:1`
      },
      {
        title: `${this.provider} result 2`,
        url: `https://example.com/search/${encoded}/2`,
        snippet: `Additional context for "${normalized}"`,
        citation: `source:${this.provider}:2`
      }
    ];

    return {
      provider: this.provider,
      query: normalized,
      items
    };
  }

  private resolveProvider(raw?: string): SearchProvider {
    if (!raw) {
      return 'default';
    }
    if (SUPPORTED_PROVIDERS.includes(raw as SearchProvider)) {
      return raw as SearchProvider;
    }
    return 'default';
  }
}
