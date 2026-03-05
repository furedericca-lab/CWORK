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

interface SearchProviderConfig {
  tavilyApiKey?: string;
  bochaApiKey?: string;
  baiduApiKey?: string;
}

interface DuckDuckGoTopic {
  Text?: string;
  FirstURL?: string;
  Result?: string;
  Topics?: DuckDuckGoTopic[];
}

interface DuckDuckGoResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: DuckDuckGoTopic[];
}

const SUPPORTED_PROVIDERS: SearchProvider[] = ['default', 'tavily', 'bocha', 'baidu_ai_search'];

const parseTopicText = (topic: DuckDuckGoTopic): SearchResultItem | null => {
  const text = topic.Text?.trim();
  const url = topic.FirstURL?.trim();
  if (!text || !url) {
    return null;
  }

  const [titleRaw, snippetRaw] = text.split(' - ');
  return {
    title: titleRaw?.trim() || text,
    snippet: snippetRaw?.trim() || text,
    url,
    citation: 'duckduckgo'
  };
};

const flattenDuckDuckGoTopics = (topics: DuckDuckGoTopic[] | undefined): SearchResultItem[] => {
  if (!topics || topics.length === 0) {
    return [];
  }

  const result: SearchResultItem[] = [];
  for (const topic of topics) {
    const parsed = parseTopicText(topic);
    if (parsed) {
      result.push(parsed);
      continue;
    }
    if (topic.Topics) {
      result.push(...flattenDuckDuckGoTopics(topic.Topics));
    }
  }
  return result;
};

const toFallbackResults = (provider: SearchProvider, query: string, reason: string): SearchResultItem[] => {
  const encoded = encodeURIComponent(query);
  return [
    {
      title: `${provider} fallback result`,
      url: `https://example.com/search/${encoded}`,
      snippet: `Fallback search result for "${query}". reason=${reason}`,
      citation: `fallback:${provider}`
    }
  ];
};

export class WebSearchAdapter {
  private readonly provider: SearchProvider;
  private readonly config: SearchProviderConfig;
  private readonly fetcher: typeof fetch;

  constructor(provider?: string, config: SearchProviderConfig = {}, fetcher: typeof fetch = fetch) {
    this.provider = this.resolveProvider(provider);
    this.config = config;
    this.fetcher = fetcher;
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
    const normalized = query.trim();
    if (!normalized) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Search query cannot be empty');
    }

    try {
      const items = await this.searchByProvider(normalized);
      if (items.length === 0) {
        throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Search provider returned empty items: ${this.provider}`);
      }
      return { provider: this.provider, query: normalized, items };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        provider: this.provider,
        query: normalized,
        items: toFallbackResults(this.provider, normalized, reason)
      };
    }
  }

  private async searchByProvider(query: string): Promise<SearchResultItem[]> {
    if (this.provider === 'default') {
      return this.searchDefault(query);
    }

    if (this.provider === 'tavily') {
      return this.searchTavily(query);
    }

    if (this.provider === 'bocha') {
      return this.searchBocha(query);
    }

    return this.searchBaidu(query);
  }

  private async searchDefault(query: string): Promise<SearchResultItem[]> {
    const response = await this.fetcher(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        method: 'GET'
      }
    );
    if (!response.ok) {
      throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `DuckDuckGo request failed with status ${response.status}`);
    }

    const body = (await response.json()) as DuckDuckGoResponse;
    const items: SearchResultItem[] = [];
    if (body.AbstractText && body.AbstractURL) {
      items.push({
        title: body.Heading?.trim() || query,
        url: body.AbstractURL,
        snippet: body.AbstractText,
        citation: 'duckduckgo'
      });
    }
    items.push(...flattenDuckDuckGoTopics(body.RelatedTopics));
    return items.slice(0, 8);
  }

  private async searchTavily(query: string): Promise<SearchResultItem[]> {
    const apiKey = this.config.tavilyApiKey ?? process.env.CWORK_SEARCH_TAVILY_API_KEY;
    if (!apiKey) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Missing CWORK_SEARCH_TAVILY_API_KEY');
    }

    const response = await this.fetcher('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        max_results: 8
      })
    });
    if (!response.ok) {
      throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Tavily request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (body.results ?? [])
      .filter((item) => item.title && item.url && item.content)
      .map((item, index) => ({
        title: item.title!,
        url: item.url!,
        snippet: item.content!,
        citation: `tavily:${index + 1}`
      }));
  }

  private async searchBocha(query: string): Promise<SearchResultItem[]> {
    const apiKey = this.config.bochaApiKey ?? process.env.CWORK_SEARCH_BOCHA_API_KEY;
    if (!apiKey) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Missing CWORK_SEARCH_BOCHA_API_KEY');
    }

    const response = await this.fetcher('https://api.bochaai.com/v1/web-search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        count: 8
      })
    });
    if (!response.ok) {
      throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Bocha request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { data?: { webpages?: Array<{ title?: string; url?: string; snippet?: string }> } };
    return (body.data?.webpages ?? [])
      .filter((item) => item.title && item.url && item.snippet)
      .map((item, index) => ({
        title: item.title!,
        url: item.url!,
        snippet: item.snippet!,
        citation: `bocha:${index + 1}`
      }));
  }

  private async searchBaidu(query: string): Promise<SearchResultItem[]> {
    const apiKey = this.config.baiduApiKey ?? process.env.CWORK_SEARCH_BAIDU_API_KEY;
    if (!apiKey) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Missing CWORK_SEARCH_BAIDU_API_KEY');
    }

    const response = await this.fetcher('https://qianfan.baidubce.com/v2/ai_search/mcp/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        top_k: 8
      })
    });
    if (!response.ok) {
      throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Baidu AI Search request failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: {
        items?: Array<{ title?: string; url?: string; snippet?: string }>;
      };
    };
    return (body.data?.items ?? [])
      .filter((item) => item.title && item.url && item.snippet)
      .map((item, index) => ({
        title: item.title!,
        url: item.url!,
        snippet: item.snippet!,
        citation: `baidu:${index + 1}`
      }));
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
