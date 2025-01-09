For implementing a performant search system in your Slack clone, I'll outline a recommended approach combining database optimizations and a dedicated search service. Here's a comprehensive strategy:

1. **Database Modifications**

First, let's add some indexes to improve search performance:

```prisma:prisma/schema.prisma
model Message {
    id          String    @id @default(cuid())
    content     String    @db.Text
    // ... existing fields ...

    @@index([content]) // Basic index for simple searches
    @@index([channelId, createdAt]) // Compound index for filtering by channel and date
}

model WorkspaceMember {
    id          String    @id @default(cuid())
    userId      String    
    // ... existing fields ...
    displayName String?   // Add this field for user search
    
    @@index([workspaceId, displayName]) // Index for user search within workspace
}
```

2. **Search Implementation Options**

For a production-grade system, I recommend one of these approaches in order of complexity/performance:

A. **PostgreSQL Full-Text Search** (Good for MVP)
- Use PostgreSQL's built-in full-text search capabilities
- Add a generated column for search vectors:

```sql
ALTER TABLE "Message" ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX message_search_idx ON "Message" USING GIN (search_vector);
```

B. **Dedicated Search Service** (Better for production)
- Use Elasticsearch, Meilisearch, or Typesense
- Maintain search indexes in real-time using webhooks or event system

Here's a basic implementation approach using PostgreSQL Full-Text Search:

```typescript:src/server/api/routers/search.ts
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const searchRouter = createTRPCRouter({
  search: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      query: z.string(),
      type: z.enum(['messages', 'people', 'all']),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { workspaceId, query, type, limit, offset } = input;

      // First, get all channels the user has access to
      const userChannels = await ctx.db.channelMember.findMany({
        where: {
          userId: ctx.auth.userId,
          channel: {
            workspaceId,
          },
        },
        select: {
          channelId: true,
        },
      });

      const channelIds = userChannels.map(c => c.channelId);

      // Search messages
      const messages = type !== 'people' ? await ctx.db.$queryRaw`
        SELECT m.*, 
               ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', ${query})) as rank
        FROM "Message" m
        WHERE m."channelId" = ANY(${channelIds})
        AND to_tsvector('english', m.content) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ` : [];

      // Search people
      const people = type !== 'messages' ? await ctx.db.workspaceMember.findMany({
        where: {
          workspaceId,
          displayName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        take: limit,
        skip: offset,
      }) : [];

      return {
        messages,
        people,
      };
    }),
});
```

3. **Scaling Considerations**

For larger implementations, consider:

- Implementing cursor-based pagination instead of offset
- Adding caching layer (Redis) for frequent searches
- Using a dedicated search service like Elasticsearch for:
  - Better relevancy scoring
  - Fuzzy matching
  - Faceted search
  - Real-time indexing
  - Handling high concurrent search loads

4. **Search Service Implementation** (Production Example)

If you decide to use Elasticsearch, here's how the implementation might look:

```typescript:src/server/search/elasticsearch.ts
import { Client } from '@elastic/elasticsearch';
import { env } from "~/env";

const client = new Client({
  node: env.ELASTICSEARCH_URL,
  auth: {
    apiKey: env.ELASTICSEARCH_API_KEY
  }
});

export async function indexMessage(message: Message) {
  await client.index({
    index: 'messages',
    id: message.id,
    document: {
      content: message.content,
      channelId: message.channelId,
      userId: message.userId,
      createdAt: message.createdAt,
    },
  });
}

export async function searchMessages(query: string, channelIds: string[]) {
  const result = await client.search({
    index: 'messages',
    query: {
      bool: {
        must: [
          {
            match: {
              content: query
            }
          }
        ],
        filter: [
          {
            terms: {
              channelId: channelIds
            }
          }
        ]
      }
    },
    highlight: {
      fields: {
        content: {}
      }
    }
  });

  return result.hits.hits;
}
```

For MVP, start with PostgreSQL full-text search. As your user base grows and search requirements become more complex, consider migrating to a dedicated search service. The modular approach in the code examples above makes it easier to swap implementations later.

Remember to:
1. Implement rate limiting for search queries
2. Cache common search results
3. Implement proper security filters to ensure users can only search content they have access to
4. Consider implementing search analytics to optimize the search experience

Would you like me to elaborate on any of these aspects or provide more specific implementation details for any part?
