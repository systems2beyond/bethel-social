import { create, insertMultiple, search, Orama, TypedDocument } from '@orama/orama';
import { stemmer } from '@orama/stemmers/english';

const schema = {
    content: 'string',
    authorName: 'string',
    authorId: 'string',
    conversationId: 'string',
    timestamp: 'number',
} as const;

export type MessageDoc = TypedDocument<Orama<typeof schema>>;

export interface SearchMessageResult {
    id: string;
    content: string;
    authorName: string;
    authorId: string;
    conversationId: string;
    timestamp: number;
    score: number;
}

class MessageSearchService {
    private index: Orama<typeof schema> | null = null;
    private initialized = false;

    private async createIndex(): Promise<Orama<typeof schema>> {
        return create({
            schema,
            components: {
                tokenizer: {
                    stemming: true,
                    stemmer: stemmer
                }
            }
        });
    }

    async init() {
        if (this.initialized) return;
        this.index = await this.createIndex();
        this.initialized = true;
    }

    async indexMessages(messages: any[]) {
        if (!this.initialized) await this.init();
        if (!this.index) return;

        const documents = messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            authorName: msg.authorName || 'User',
            authorId: msg.authorId,
            conversationId: msg.conversationId,
            timestamp: typeof msg.timestamp === 'number' ? msg.timestamp :
                (msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : Date.now()),
        }));

        await insertMultiple(this.index, documents);
    }

    async search(term: string, options: { conversationId?: string, limit?: number } = {}): Promise<SearchMessageResult[]> {
        if (!this.initialized || !this.index) return [];

        const searchParams: any = {
            term,
            properties: ['content', 'authorName'],
            limit: options.limit || 20,
            tolerance: 1,
        };

        if (options.conversationId) {
            searchParams.where = {
                conversationId: options.conversationId
            };
        }

        const results = await search(this.index, searchParams);
        return results.hits.map(h => ({
            ...(h.document as any),
            score: h.score,
            id: h.id
        }));
    }

    async clear() {
        this.index = await this.createIndex();
    }
}

export const messageIndex = new MessageSearchService();
