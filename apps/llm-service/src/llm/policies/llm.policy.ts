import { Policy } from '@nestjs/authorization';
import { isFreeOpenRouterModel } from '../../config/llm.env';

@Policy()
export class LlmPolicy {
  generateCompletion(_user: unknown): boolean {
    return true;
  }

  streamCompletion(_user: unknown): boolean {
    return true;
  }

  useModel(_user: unknown, model?: string): boolean {
    return model === undefined || model.trim() === '' || isFreeOpenRouterModel(model);
  }
}
