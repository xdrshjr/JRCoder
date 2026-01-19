/**
 * Display manager for CLI visualization
 */

import ora, { Ora } from 'ora';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { AgentPhase, AgentState, Plan } from '../types';

/**
 * Display manager for progress visualization
 */
export class DisplayManager {
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;

  // ============================================================================
  // Spinner (Loading Animation)
  // ============================================================================

  /**
   * Show loading spinner
   */
  showSpinner(message: string): void {
    this.spinner = ora({
      text: message,
      spinner: 'dots',
      color: 'cyan',
    }).start();
  }

  /**
   * Update spinner message
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop spinner with success
   */
  succeedSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with warning
   */
  warnSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.warn(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with info
   */
  infoSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.info(message);
      this.spinner = null;
    }
  }

  // ============================================================================
  // Progress Bar
  // ============================================================================

  /**
   * Show progress bar
   */
  showProgressBar(total: number, message: string): void {
    this.progressBar = new cliProgress.SingleBar({
      format: `${message} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });
    this.progressBar.start(total, 0);
  }

  /**
   * Update progress bar
   */
  updateProgressBar(current: number): void {
    if (this.progressBar) {
      this.progressBar.update(current);
    }
  }

  /**
   * Stop progress bar
   */
  stopProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }

  // ============================================================================
  // Phase Display
  // ============================================================================

  /**
   * Show agent phase
   */
  showPhase(phase: AgentPhase): void {
    const phaseIcons: Record<AgentPhase, string> = {
      planning: '📋',
      executing: '⚙️',
      reflecting: '🤔',
      confirming: '❓',
      completed: '✅',
      failed: '❌',
    };

    const phaseNames: Record<AgentPhase, string> = {
      planning: 'Planning',
      executing: 'Executing',
      reflecting: 'Reflecting',
      confirming: 'Confirming',
      completed: 'Completed',
      failed: 'Failed',
    };

    console.log(chalk.bold(`\n${phaseIcons[phase]} ${phaseNames[phase]}\n`));
  }

  // ============================================================================
  // Task Display
  // ============================================================================

  /**
   * Show task list
   */
  showTasks(plan: Plan): void {
    console.log(chalk.bold('\n📋 Tasks:\n'));

    plan.tasks.forEach((task, index) => {
      const statusIcon = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        blocked: '🚫',
      }[task.status];

      const statusColor = {
        pending: chalk.gray,
        in_progress: chalk.cyan,
        completed: chalk.green,
        failed: chalk.red,
        blocked: chalk.yellow,
      }[task.status];

      console.log(statusColor(`${index + 1}. ${statusIcon} ${task.title}`));

      if (task.description) {
        console.log(chalk.gray(`   ${task.description}`));
      }
    });

    console.log();
  }

  // ============================================================================
  // Summary Display
  // ============================================================================

  /**
   * Show execution summary
   */
  showSummary(state: AgentState): void {
    console.log(chalk.bold('\n📊 Execution Summary\n'));

    const completedTasks = state.plan?.tasks.filter((t) => t.status === 'completed').length || 0;
    const totalTasks = state.plan?.tasks.length || 0;

    console.log(chalk.cyan(`Tasks: ${completedTasks}/${totalTasks} completed`));
    console.log(chalk.cyan(`Iterations: ${state.currentIteration}/${state.maxIterations}`));
    console.log(chalk.cyan(`Total tokens: ${state.metadata.totalTokens}`));
    console.log(chalk.cyan(`Total cost: $${state.metadata.totalCost.toFixed(4)}`));
    console.log(chalk.cyan(`Tool calls: ${state.metadata.toolCallsCount}`));

    const duration = state.endTime ? state.endTime - state.startTime : Date.now() - state.startTime;
    console.log(chalk.cyan(`Duration: ${(duration / 1000).toFixed(2)}s`));

    console.log();
  }

  // ============================================================================
  // Error Display
  // ============================================================================

  /**
   * Show error
   */
  showError(error: Error): void {
    console.log(chalk.red('\n❌ Error:\n'));
    console.log(chalk.red(error.message));

    if (error.stack) {
      console.log(chalk.gray('\nStack trace:'));
      console.log(chalk.gray(error.stack));
    }

    console.log();
  }

  // ============================================================================
  // Info Display
  // ============================================================================

  /**
   * Show info message
   */
  showInfo(message: string): void {
    console.log(chalk.cyan(`ℹ️  ${message}`));
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  /**
   * Show warning message
   */
  showWarning(message: string): void {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  /**
   * Show error message
   */
  showErrorMessage(message: string): void {
    console.log(chalk.red(`❌ ${message}`));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear console
   */
  clear(): void {
    console.clear();
  }

  /**
   * Print separator
   */
  printSeparator(): void {
    console.log(chalk.gray('─'.repeat(80)));
  }

  /**
   * Print empty line
   */
  printNewLine(): void {
    console.log();
  }
}
