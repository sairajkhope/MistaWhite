import { describe, expect, it } from 'vitest';
import { planCharacterResponse } from './response-plan';
import { createInitialCharacterState, evolveCharacter } from './state';

describe('MistaWhite character state', () => {
	it('allows irritation without turning it into punishment', () => {
		const signal = {
			type: 'irritation' as const,
			trigger: 'global-verdict' as const,
			intensity: 0.5
		};
		const state = evolveCharacter(createInitialCharacterState(), [signal]);
		const plan = planCharacterResponse(state, [signal]);

		expect(state.stance).toBe('irritated');
		expect(plan.mode).toBe('challenge');
		expect(plan.constraints).toContain(
			'Never punish, guilt or withdraw warmth to force compliance.'
		);
		expect(plan.maximumQuestions).toBe(1);
	});

	it('drops irritation when safety is implicated', () => {
		const irritated = evolveCharacter(createInitialCharacterState(), [
			{ type: 'irritation', trigger: 'evidence-avoidance', intensity: 0.8 }
		]);
		const concerned = evolveCharacter(irritated, [{ type: 'safety-concern' }]);

		expect(concerned.mode).toBe('safety');
		expect(concerned.stance).toBe('concerned');
		expect(Math.max(...Object.values(concerned.irritation))).toBe(0);
	});
});
