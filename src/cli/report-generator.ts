/**
 * Report generator for execution reports
 */

import fs from 'fs-extra';
import path from 'path';
import { AgentState } from '../types';

/**
 * Report generator for creating execution reports
 */
export class ReportGenerator {
  /**
   * Generate Markdown report
   */
  generateMarkdown(state: AgentState): string {
    const report: string[] = [];

    // Title
    report.push('# Agent Execution Report\n');
    report.push(`**Generated at**: ${new Date().toISOString()}\n`);

    // Overview
    report.push('## Overview\n');
    report.push(`- **Goal**: ${state.plan?.goal || 'N/A'}`);
    report.push(`- **Status**: ${state.phase}`);
    report.push(`- **Iterations**: ${state.currentIteration}/${state.maxIterations}`);
    if (state.endTime) {
      report.push(`- **Duration**: ${this.formatDuration(state.endTime - state.startTime)}`);
    }
    report.push('');

    // Statistics
    report.push('## Statistics\n');
    report.push(`- **Total tokens**: ${state.metadata.totalTokens}`);
    report.push(`- **Total cost**: $${state.metadata.totalCost.toFixed(4)}`);
    report.push(`- **Tool calls**: ${state.metadata.toolCallsCount}`);
    report.push('');

    // Tasks
    if (state.plan) {
      report.push('## Tasks\n');
      state.plan.tasks.forEach((task, index) => {
        const statusEmoji = {
          pending: '⏳',
          in_progress: '🔄',
          completed: '✅',
          failed: '❌',
          blocked: '🚫',
        }[task.status];

        report.push(`### ${index + 1}. ${statusEmoji} ${task.title}\n`);
        report.push(`**Status**: ${task.status}`);
        report.push(`**Description**: ${task.description}`);

        if (task.result) {
          report.push(`**Result**: ${task.result}`);
        }

        if (task.error) {
          report.push(`**Error**: ${task.error}`);
        }

        report.push('');
      });
    }

    // Conversation History
    report.push('## Conversation History\n');
    state.conversation.messages.forEach((msg, index) => {
      report.push(`### Message ${index + 1}\n`);
      report.push(`**Role**: ${msg.role}`);
      report.push(`**Timestamp**: ${new Date(msg.timestamp).toISOString()}`);
      report.push('```');
      report.push(msg.content);
      report.push('```');
      report.push('');
    });

    return report.join('\n');
  }

  /**
   * Generate JSON report
   */
  generateJSON(state: AgentState): string {
    return JSON.stringify(state, null, 2);
  }

  /**
   * Generate HTML report
   */
  generateHTML(state: AgentState): string {
    const markdown = this.generateMarkdown(state);

    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^- (.*$)/gim, '<li>$1</li>');

    html = '<p>' + html + '</p>';
    html = html.replace(/<\/li>\n<li>/g, '</li><li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Agent Execution Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
    }
    h2 {
      color: #34495e;
      border-bottom: 2px solid #95a5a6;
      padding-bottom: 8px;
      margin-top: 30px;
    }
    h3 {
      color: #7f8c8d;
      margin-top: 20px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border-left: 4px solid #3498db;
    }
    pre code {
      background: none;
      padding: 0;
    }
    ul {
      list-style-type: none;
      padding-left: 0;
    }
    li {
      padding: 5px 0;
      padding-left: 20px;
    }
    li:before {
      content: "▸ ";
      color: #3498db;
      font-weight: bold;
      margin-right: 5px;
    }
    strong {
      color: #2c3e50;
    }
    .status-completed { color: #27ae60; }
    .status-failed { color: #e74c3c; }
    .status-pending { color: #95a5a6; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();
  }

  /**
   * Save report to file
   */
  async save(
    state: AgentState,
    format: 'markdown' | 'json' | 'html',
    outputPath?: string
  ): Promise<string> {
    let content: string;
    let ext: string;

    switch (format) {
      case 'markdown':
        content = this.generateMarkdown(state);
        ext = 'md';
        break;
      case 'json':
        content = this.generateJSON(state);
        ext = 'json';
        break;
      case 'html':
        content = this.generateHTML(state);
        ext = 'html';
        break;
      default:
        throw new Error(`Unknown format: ${format}`);
    }

    const filepath = outputPath || path.join('logs', `report-${Date.now()}.${ext}`);

    // Ensure directory exists
    await fs.ensureDir(path.dirname(filepath));

    await fs.writeFile(filepath, content, 'utf8');

    return filepath;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
