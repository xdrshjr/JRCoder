/**
 * LLM Manager
 * Manages multiple LLM client instances for different roles (planner, executor, reflector)
 */

import type { ILLMClient, ILogger, LLMClientRole, UsageStats } from './types';
import type { GlobalConfig } from '../types';
import { LLMClientFactory } from './factory';

/**
 * LLM Manager class
 * Manages LLM clients for different agent roles
 */
export class LLMManager {
  private clients: Map<LLMClientRole, ILLMClient> = new Map();
  private config: GlobalConfig;
  private logger: ILogger;
  private usageStats: Map<LLMClientRole, UsageStats> = new Map();

  constructor(config: GlobalConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.initializeClients();
    this.initializeUsageStats();
  }

  /**
   * Initialize LLM clients for each role
   */
  private initializeClients(): void {
    const roles: LLMClientRole[] = ['planner', 'executor', 'reflector'];

    for (const role of roles) {
      try {
        const client = LLMClientFactory.create(this.config.llm[role], this.logger);
        this.clients.set(role, client);
        this.logger.info(`LLM client initialized for role: ${role}`, {
          provider: this.config.llm[role].provider,
          model: this.config.llm[role].model,
        });
      } catch (error) {
        this.logger.error(`Failed to initialize LLM client for role: ${role}`, error as Error);
        throw error;
      }
    }
  }

  /**
   * Initialize usage statistics for each role
   */
  private initializeUsageStats(): void {
    const roles: LLMClientRole[] = ['planner', 'executor', 'reflector'];

    for (const role of roles) {
      this.usageStats.set(role, {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        requestCount: 0,
      });
    }
  }

  /**
   * Get LLM client for a specific role
   */
  getClient(role: LLMClientRole): ILLMClient {
    const client = this.clients.get(role);
    if (!client) {
      throw new Error(`LLM client for role '${role}' not found`);
    }
    return client;
  }

  /**
   * Update usage statistics for a role
   */
  updateUsage(
    role: LLMClientRole,
    promptTokens: number,
    completionTokens: number,
    cost: number
  ): void {
    const stats = this.usageStats.get(role);
    if (!stats) {
      this.logger.warn(`Usage stats not found for role: ${role}`);
      return;
    }

    stats.promptTokens += promptTokens;
    stats.completionTokens += completionTokens;
    stats.totalTokens += promptTokens + completionTokens;
    stats.totalCost += cost;
    stats.requestCount += 1;

    this.usageStats.set(role, stats);
  }

  /**
   * Get usage statistics for a specific role
   */
  getUsageStats(role: LLMClientRole): UsageStats {
    const stats = this.usageStats.get(role);
    if (!stats) {
      return {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        requestCount: 0,
      };
    }
    return { ...stats };
  }

  /**
   * Get total usage statistics across all roles
   */
  getTotalUsage(): UsageStats {
    const total: UsageStats = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      requestCount: 0,
    };

    for (const stats of this.usageStats.values()) {
      total.totalTokens += stats.totalTokens;
      total.promptTokens += stats.promptTokens;
      total.completionTokens += stats.completionTokens;
      total.totalCost += stats.totalCost;
      total.requestCount += stats.requestCount;
    }

    return total;
  }

  /**
   * Get usage statistics for all roles
   */
  getAllUsageStats(): Record<LLMClientRole, UsageStats> {
    return {
      planner: this.getUsageStats('planner'),
      executor: this.getUsageStats('executor'),
      reflector: this.getUsageStats('reflector'),
    };
  }

  /**
   * Reset usage statistics for a specific role
   */
  resetUsageStats(role: LLMClientRole): void {
    this.usageStats.set(role, {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      requestCount: 0,
    });
  }

  /**
   * Reset usage statistics for all roles
   */
  resetAllUsageStats(): void {
    const roles: LLMClientRole[] = ['planner', 'executor', 'reflector'];
    for (const role of roles) {
      this.resetUsageStats(role);
    }
  }

  /**
   * Get configuration for a specific role
   */
  getConfig(role: LLMClientRole) {
    return this.config.llm[role];
  }

  /**
   * Check if all clients are initialized
   */
  isReady(): boolean {
    return (
      this.clients.has('planner') &&
      this.clients.has('executor') &&
      this.clients.has('reflector')
    );
  }

  /**
   * Get summary of all clients
   */
  getSummary(): {
    planner: { provider: string; model: string };
    executor: { provider: string; model: string };
    reflector: { provider: string; model: string };
  } {
    return {
      planner: {
        provider: this.config.llm.planner.provider,
        model: this.config.llm.planner.model,
      },
      executor: {
        provider: this.config.llm.executor.provider,
        model: this.config.llm.executor.model,
      },
      reflector: {
        provider: this.config.llm.reflector.provider,
        model: this.config.llm.reflector.model,
      },
    };
  }
}
