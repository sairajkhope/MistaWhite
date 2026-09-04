import { z } from 'zod';

const observationKinds = [
	'event',
	'sensation',
	'emotion',
	'action',
	'outcome',
	'prediction',
	'interpretation',
	'reflection'
] as const;

export const interpretationSchema = z
	.object({
		observations: z
			.array(
				z.object({
					kind: z.enum(observationKinds),
					content: z.string().trim().min(1).max(4_000),
					confidence: z.number().min(0).max(1)
				})
			)
			.min(1)
			.max(12),
		ambiguity: z.number().min(0).max(1),
		novelty: z.number().min(0).max(1),
		evidenceConflict: z.number().min(0).max(1),
		safetyRisk: z.enum(['none', 'low', 'moderate', 'high'])
	})
	.strict();

export const characterRenderSchema = z
	.object({
		text: z.string().trim().min(1).max(2_000),
		spokenText: z.string().trim().min(1).max(2_000).optional(),
		question: z.string().trim().min(1).max(300).optional()
	})
	.strict();

export type CharacterRender = z.infer<typeof characterRenderSchema>;

export function parseInterpretation(input: unknown) {
	return interpretationSchema.parse(input);
}

export function parseCharacterRender(input: unknown): CharacterRender {
	return characterRenderSchema.parse(input);
}
