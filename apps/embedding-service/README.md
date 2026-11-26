# `@semcache/embedding-service`

Isolated NestJS TCP microservice (`Transport.TCP`, default port `3006`) responsible for generating 384-dimensional L2-normalized multilingual embedding vectors using `@huggingface/transformers` (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`).

## TCP Message Patterns

- `app.health` — health check endpoint.
- `embeddings.generate` — generates normalized embedding vectors for a batch of texts (`GenerateEmbeddingsRequestDto` -> `GenerateEmbeddingsResponseDto`).
