
import { defineCollection, z } from 'astro:content';

const commentaryCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        book: z.string(),
        chapter: z.string(),
        language: z.string(),
        audioPath: z.string().optional(),
        metaDescription: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        entities: z.array(z.any()).optional(),
        faq: z.array(z.any()).optional(),
        structuredData: z.array(z.any()).optional(),
        previous_chapter: z.string().nullable().optional(),
        next_chapter: z.string().nullable().optional(),
    }),
});

export const collections = {
    'commentary': commentaryCollection,
};
