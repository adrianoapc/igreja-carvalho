// Re-exporta do context para manter compatibilidade com todos os consumers existentes.
// A lógica e a subscription Realtime vivem em AppConfigContext (um único canal por app).
export { useAppConfigContext as useAppConfig } from '@/contexts/AppConfigContext';
