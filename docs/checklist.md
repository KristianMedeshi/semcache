# Master's Thesis Implementation Checklist

## 1. Microservices Architecture (NestJS / TypeScript)

- [ ] **API Gateway:** Single entry point and REST request routing to internal services.
- [ ] **Dialog Service:** Stores conversation history and orchestrates message processing (cache lookup -> LLM call if needed -> store result).
- [ ] **LLM Service:** Integrates with free cloud models for response generation and vector embedding computation.
- [ ] **Knowledge Base Service:** CRUD operations for support articles/documents (tourism or telecom domain) and retrieval of relevant context.
- [ ] **Semantic Cache Service:** Implemented as a dedicated microservice with its own API for cache lookup, insertion, and invalidation.
- [ ] **Database:** PostgreSQL deployed with the `pgvector` extension enabled and vector indexes configured for fast similarity search.

## 2. Research Component: Adaptive Threshold & Cache Invalidation

- [ ] **Fixed Threshold Mode:** Baseline vector search with a hardcoded similarity threshold (including `0.9` for comparison).
- [ ] **Adaptive Threshold Mode:** Dynamic threshold calculation accounting for:
  - incoming query category (intent);
  - local cluster density in the embedding space.
- [ ] **Mode Switching:** Ability to easily toggle between _no cache_, _fixed threshold_, and _adaptive threshold_ modes for reproducible experiments.
- [ ] **Source Binding:** Each cached entry stores references (IDs) to the specific knowledge base documents used to generate the answer.
- [ ] **Cache Invalidation:** Editing or deleting a document in the knowledge base automatically removes or invalidates all linked entries in the semantic cache.

## 3. Web Interface (React / Vite / TypeScript)

- [ ] **Client Chat:** Real-time interface for submitting customer support queries and receiving responses.
- [ ] **Operator Admin Panel:** Interface for managing the knowledge base (adding/updating documents to trigger invalidation) and viewing cache/dialog statistics and status.

## 4. Infrastructure, Testing & Monitoring

- [ ] **Containerization:** `Dockerfile` for each service and a `docker-compose.yml` to spin up the full stack (backend, frontend, PostgreSQL + pgvector, monitoring).
- [ ] **Monitoring (Prometheus + Grafana):** Metric collection configured across services with Grafana dashboards visualizing performance.
- [ ] **Unit & Integration Tests (Jest):** Test coverage for core business logic, specifically the adaptive threshold formula, vector search, and cache invalidation flows.
- [ ] **Load Testing (k6):** Scripts to evaluate stability and latency under gradually increasing RPS.

## 5. Dataset, Experiments & Hypothesis Validation

- [ ] **Labeled Dataset:** Sample of customer support queries labeled by category and semantic intent (including paraphrases and lexically similar but contextually distinct queries to test false hits).
- [ ] **Comparative Runs:** Identical test scenarios executed across all three configurations (_no cache_, _fixed threshold 0.9_, _adaptive threshold_).
- [ ] **All 6 Metrics Collected:**
  - Hit rate
  - False-hit rate (cache precision)
  - Token / cost savings
  - Latency (`p50` / `p95` / `p99`)
  - Throughput (`RPS`)
  - Overall system answer accuracy
- [ ] **Hypothesis Validation:** Verified whether target benchmarks are met:
  - Adaptive threshold hit rate ≥ fixed threshold `0.9`;
  - False-hit rate reduced by at least 2x;
  - LLM call costs reduced by at least 40%.
- [ ] **Invalidation Test:** Documented verification that updating facts in the knowledge base prevents the system from serving stale cached responses.

## 6. Results & Dissemination

- [ ] **Data Visualization:** Tables and charts prepared (including the "cost savings vs. false-hit rate" trade-off and latency graphs from k6/Grafana).
- [ ] **Practical Recommendations:** Actionable conclusions formulated on reducing LLM system costs based on experimental findings.
- [ ] **GitHub Repository:** Open-source release of all microservices, the dataset, and experiment scripts with a clear `README.md`.
- [ ] **Publication:** Article prepared or submitted to a specialized peer-reviewed journal.
