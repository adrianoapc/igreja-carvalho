/**
 * CORE do domínio financeiro (ADR-029).
 *
 * Regras de dependência:
 * - Módulos de `src/features/financeiro/*` dependem deste core;
 * - o core NÃO importa de nenhum módulo;
 * - páginas legadas (`src/pages/financas`, `src/components/financas`)
 *   migram gradualmente para cá (roadmap F0-F7 em
 *   docs/arquitetura-financeiro.md).
 */
export * from "./model/types";
export * from "./lib/status";
export * from "./lib/agrupamento";
export * from "./lib/periodo";
export * from "./api/finRpc";
export * from "./api/lancamentos.api";
export * from "./api/transferencias.api";
export * from "./api/contas.api";
export * from "./api/ofertas.api";
export * from "./api/reembolsos.api";
