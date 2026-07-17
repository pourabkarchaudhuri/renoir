import type { AzureStatus, ByokConfig } from '@/types/global';

export function llmOk(byok: Pick<ByokConfig, 'hasKey' | 'baseUrl'> | null): boolean {
  return Boolean(byok?.hasKey && byok?.baseUrl);
}

export function imageOk(azure: Pick<AzureStatus, 'configured' | 'imageConfigured'> | null): boolean {
  return Boolean(azure?.imageConfigured ?? azure?.configured);
}

export function audioOk(azure: Pick<AzureStatus, 'audioDeployment' | 'textDeployment'> | null): boolean {
  return Boolean(azure?.audioDeployment || azure?.textDeployment);
}

export function videoOk(azure: Pick<AzureStatus, 'videoDeployment'> | null): boolean {
  return Boolean(azure?.videoDeployment);
}
