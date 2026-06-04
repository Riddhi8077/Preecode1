import * as vscode from 'vscode';

export type OnboardingStep =
  | 'none'
  | 'initial-popup'
  | 'click-sidebar-icon'
  | 'sidebar-open'
  | 'login'
  | 'start-practicing'
  | 'debug-code'
  | 'fix-code'
  | 'explain-selection'
  | 'review-code'
  | 'ai-chat'
  | 'dashboard'
  | 'profile'
  | 'completed';

export interface OnboardingState {
  isCompleted: boolean;
  currentStep: OnboardingStep;
  isActive: boolean;
  hasSeenInitialPopup: boolean;
}

const ONBOARDING_COMPLETED_KEY = 'preecode.onboarding.completed';
const ONBOARDING_STEP_KEY = 'preecode.onboarding.currentStep';
const ONBOARDING_ACTIVE_KEY = 'preecode.onboarding.active';

export class OnboardingService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Initialize onboarding on extension activation.
   * Shows the initial popup if this is the first activation.
   */
  async init(): Promise<void> {
    const isCompleted = this.context.globalState.get<boolean>(ONBOARDING_COMPLETED_KEY, false);

    if (isCompleted) {
      await this.context.globalState.update(ONBOARDING_ACTIVE_KEY, false);
      return;
    }

    // First activation - show the popup
    await this.showInitialPopup();
  }

  /**
   * Show the initial "Welcome to Preecode" popup.
   */
  private async showInitialPopup(): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      '👋 Welcome to Preecode! Take a quick tour to learn all features?',
      { modal: false },
      'Start Tour',
      'Skip'
    );

    if (choice === 'Start Tour') {
      await this.startTour();
    } else if (choice === 'Skip') {
      await this.completeTour();
    }
  }

  /**
   * Start the onboarding tour.
   */
  async startTour(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_ACTIVE_KEY, true);
    await this.setStep('click-sidebar-icon');

    // Show feedback message
    void vscode.window.showInformationMessage('🎉 Starting your Preecode tour...');

    // Auto-open the sidebar to show the tour immediately
    await vscode.commands.executeCommand('workbench.view.extension.preecode');
  }

  /**
   * Move to next step.
   */
  async nextStep(nextStep: OnboardingStep): Promise<void> {
    await this.setStep(nextStep);
  }

  /**
   * Mark tour as completed.
   */
  async completeTour(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_COMPLETED_KEY, true);
    await this.context.globalState.update(ONBOARDING_ACTIVE_KEY, false);
    await this.setStep('completed');
  }

  /**
   * Reset tour to allow restarting.
   */
  async resetTour(): Promise<void> {
    await this.context.globalState.update(ONBOARDING_COMPLETED_KEY, false);
    await this.context.globalState.update(ONBOARDING_ACTIVE_KEY, false);
    await this.context.globalState.update(ONBOARDING_STEP_KEY, '');
  }

  /**
   * Set current step.
   */
  private async setStep(step: OnboardingStep): Promise<void> {
    await this.context.globalState.update(ONBOARDING_STEP_KEY, step);
  }

  /**
   * Get current onboarding state.
   */
  getState(): OnboardingState {
    const isCompleted = this.context.globalState.get<boolean>(ONBOARDING_COMPLETED_KEY, false);
    const isActive = this.context.globalState.get<boolean>(ONBOARDING_ACTIVE_KEY, false);
    const currentStep = this.context.globalState.get<string>(ONBOARDING_STEP_KEY, 'none') as OnboardingStep;

    return {
      isCompleted,
      currentStep,
      isActive,
      hasSeenInitialPopup: true
    };
  }

  /**
   * Check if tour is active.
   */
  isActive(): boolean {
    return this.getState().isActive;
  }

  /**
   * Get current step.
   */
  getCurrentStep(): OnboardingStep {
    return this.getState().currentStep;
  }
}
