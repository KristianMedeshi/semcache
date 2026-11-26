import { Policy } from '@nestjs/authorization';

@Policy()
export class EmbeddingPolicy {
  generateEmbeddings(_user: unknown): boolean {
    return true;
  }
}
