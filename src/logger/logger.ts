/**
 * Logger implementation using Winston
 */

import winston from 'winston';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import type { ILogger } from './interfaces';
import type { GlobalConfig, LLMRequest, LLMResponse, ToolResult } from '../types';

export class Logger implements ILogger {
  private winstonLogger: winston.Logger;
  private context: Record<string, any> = {};

  constructor(config: GlobalConfig['logging']) {
    // Ensure log directory exists
    fs.ensureDirSync(config.outputDir);

    this.winstonLogger = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: this.createTransports(config),
    });
  }

  /**
   * Create Winston transports based on configuration
   */
  private createTransports(config: GlobalConfig['logging']): winston.transport[] {
    const transports: winston.transport[] = [];

    // Console transport
    if (config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf((info) => this.consoleFormat(info))
          ),
        })
      );
    }

    // File transports
    if (config.enableFile) {
      // Combined log
      transports.push(
        new winston.transports.File({
          filename: path.join(config.outputDir, 'combined.log'),
          maxsize: config.maxFileSize,
          maxFiles: config.maxFiles,
        })
      );

      // Error log
      transports.push(
        new winston.transports.File({
          filename: path.join(config.outputDir, 'error.log'),
          level: 'error',
          maxsize: config.maxFileSize,
          maxFiles: config.maxFiles,
        })
      );
    }

    return transports;
  }

  /**
   * Format log entry for console output
   */
  private consoleFormat(info: any): string {
    const { timestamp, level, message, ...meta } = info;
    const time = new Date(timestamp).toLocaleTimeString();

    let output = `${chalk.gray(time)} ${level}: ${message}`;

    // Add context if present
    if (this.context && Object.keys(this.context).length > 0) {
      const contextStr = Object.entries(this.context)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      output += chalk.gray(` [${contextStr}]`);
    }

    // Add metadata for debug level
    const metaKeys = Object.keys(meta).filter((k) => k !== 'level' && k !== 'timestamp');
    if (metaKeys.length > 0 && info.level === 'debug') {
      output += `\n${chalk.gray(JSON.stringify(meta, null, 2))}`;
    }

    return output;
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    this.winstonLogger.debug(message, { ...this.context, ...data });
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    this.winstonLogger.info(message, { ...this.context, ...data });
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    this.winstonLogger.warn(message, { ...this.context, ...data });
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, data?: any): void {
    this.winstonLogger.error(message, {
      ...this.context,
      ...data,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
    });
  }

  /**
   * Log tool call
   */
  logToolCall(toolName: string, args: any): void {
    this.info(`Tool called: ${toolName}`, {
      type: 'tool_call',
      toolName,
      arguments: args,
    });
  }

  /**
   * Log tool result
   */
  logToolResult(toolName: string, result: ToolResult): void {
    if (result.success) {
      this.info(`Tool completed: ${toolName}`, {
        type: 'tool_result',
        toolName,
        success: true,
        executionTime: result.metadata?.executionTime,
      });
    } else {
      this.error(`Tool failed: ${toolName}`, undefined, {
        type: 'tool_result',
        toolName,
        success: false,
        error: result.error,
      });
    }
  }

  /**
   * Log LLM request
   */
  logLLMRequest(request: LLMRequest): void {
    this.debug('LLM request', {
      type: 'llm_request',
      messageCount: request.messages.length,
      toolCount: request.tools?.length || 0,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }

  /**
   * Log LLM response
   */
  logLLMResponse(response: LLMResponse): void {
    this.info('LLM response', {
      type: 'llm_response',
      finishReason: response.finishReason,
      toolCalls: response.toolCalls?.length || 0,
      usage: response.usage,
    });
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): ILogger {
    const childLogger = new Logger({
      level: 'info',
      outputDir: 'logs',
      enableConsole: true,
      enableFile: true,
      maxFileSize: 10485760,
      maxFiles: 10,
      format: 'json',
    });
    childLogger.context = { ...this.context, ...context };
    childLogger.winstonLogger = this.winstonLogger;
    return childLogger;
  }
}
