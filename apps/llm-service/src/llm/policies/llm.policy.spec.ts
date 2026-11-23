import { LlmPolicy } from './llm.policy';

describe('LlmPolicy', () => {
  let policy: LlmPolicy;

  beforeEach(() => {
    policy = new LlmPolicy();
  });

  it('allows internal completion, streaming, and embedding operations', () => {
    expect(policy.generateCompletion(null)).toBe(true);
    expect(policy.streamCompletion(null)).toBe(true);
    expect(policy.generateEmbeddings(null)).toBe(true);
  });

  it('permits only free OpenRouter models', () => {
    expect(policy.useModel(null, undefined)).toBe(true);
    expect(policy.useModel(null, 'openrouter/free')).toBe(true);
    expect(policy.useModel(null, 'nvidia/nemotron-3-ultra-550b-a55b:free')).toBe(true);
    expect(policy.useModel(null, 'openai/gpt-4o')).toBe(false);
  });
});
