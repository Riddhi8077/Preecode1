import * as vscode from 'vscode';
import { AuthManager } from '../auth/authManager';
import { getBackendUrl } from '../services/apiService';

export class LoginPanel {
  private static current: LoginPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static render(context: vscode.ExtensionContext, extensionUri: vscode.Uri, authManager: AuthManager): LoginPanel {
    if (LoginPanel.current) {
      LoginPanel.current.panel.reveal(vscode.ViewColumn.Active, true);
      return LoginPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      'preecode.loginPanel',
      'Preecode Login',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview')]
      }
    );

    LoginPanel.current = new LoginPanel(context, extensionUri, panel, authManager);
    LoginPanel.current.update();
    return LoginPanel.current;
  }

  static closeCurrent(): void {
    if (LoginPanel.current) {
      LoginPanel.current.close();
    }
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    panel: vscode.WebviewPanel,
    private readonly authManager: AuthManager
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(async (message: any) => {
      await this.handleMessage(message);
    }, null, this.disposables);
  }

  private async handleMessage(message: any): Promise<void> {
    const { type, payload } = message;

    if (type === 'loginWithEmail') {
      await this.handleEmailLogin(payload);
      return;
    }

    if (type === 'signupWithEmail') {
      await this.handleEmailSignup(payload);
      return;
    }

    if (type === 'googleLogin') {
      await this.handleGoogleLogin();
      return;
    }

    if (type === 'closePanel') {
      this.close();
      return;
    }

    if (type === 'forgotPassword') {
      await this.handleForgotPassword(payload);
      return;
    }

    if (type === 'verifyOtp') {
      await this.handleVerifyOtp(payload);
      return;
    }

    if (type === 'resetPassword') {
      await this.handleResetPassword(payload);
      return;
    }
  }

  private async handleEmailLogin(payload: any): Promise<void> {
    const { email, password } = payload;

    if (!email || !password) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Email and password are required.'
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'loading', loadingMessage: 'Signing in...' });

    try {
      const response = await this.apiCall('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        let errorMessage = 'Login failed. Please try again.';

        if (response.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (response.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        this.panel.webview.postMessage({
          type: 'error',
          error: errorMessage
        });
        return;
      }

      const data = (await response.json()) as any;
      const token = data.token;

      if (!token) {
        this.panel.webview.postMessage({
          type: 'error',
          error: 'Login failed: No token received from server.'
        });
        return;
      }

      // Use AuthManager to handle token storage and state update
      await this.authManager.loginWithToken(token);
      this.panel.webview.postMessage({ type: 'success' });
      setTimeout(() => this.close(), 500);
    } catch (error: any) {
      this.panel.webview.postMessage({
        type: 'error',
        error: `Network error: ${error?.message || 'Could not reach server.'}`
      });
    }
  }

  private async handleEmailSignup(payload: any): Promise<void> {
    const { email, password, username } = payload;

    if (!email || !password || !username) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Email, password, and username are required.'
      });
      return;
    }

    if (password.length < 6) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Password must be at least 6 characters.'
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'loading', loadingMessage: 'Creating account...' });

    try {
      const response = await this.apiCall('/api/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, username })
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        let errorMessage = 'Signup failed. Please try again.';

        if (response.status === 409) {
          errorMessage = errorData.message || 'Username or email already exists.';
        } else if (response.status === 400) {
          errorMessage = errorData.message || 'Invalid email or password format.';
        } else if (response.status === 429) {
          errorMessage = 'Too many signup attempts. Please try again later.';
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        this.panel.webview.postMessage({
          type: 'error',
          error: errorMessage
        });
        return;
      }

      const data = (await response.json()) as any;
      const token = data.token;

      if (!token) {
        this.panel.webview.postMessage({
          type: 'error',
          error: 'Signup failed: No token received from server.'
        });
        return;
      }

      // Use AuthManager to handle token storage and state update
      await this.authManager.loginWithToken(token);
      this.panel.webview.postMessage({ type: 'success' });
      setTimeout(() => this.close(), 500);
    } catch (error: any) {
      this.panel.webview.postMessage({
        type: 'error',
        error: `Network error: ${error?.message || 'Could not reach server.'}`
      });
    }
  }

  private async handleGoogleLogin(): Promise<void> {
    // Open browser to Google OAuth endpoint with redirect back to extension
    const extensionId = this.context.extension.id;
    const redirectUri = encodeURIComponent(`vscode://${extensionId}/auth`);
    const backendUrl = await getBackendUrl();
    const googleLoginUrl = `${backendUrl}/api/auth/google?redirect=${redirectUri}`;

    await vscode.env.openExternal(vscode.Uri.parse(googleLoginUrl));
  }

  private async handleForgotPassword(payload: any): Promise<void> {
    const { email } = payload;

    if (!email) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Email is required.'
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'loading', loadingMessage: 'Sending verification code...' });

    try {
      const response = await this.apiCall('/api/users/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        this.panel.webview.postMessage({
          type: 'error',
          error: data.message || 'Failed to send verification code.'
        });
        return;
      }

      this.panel.webview.postMessage({
        type: 'otpSent',
        message: data.message || 'Verification code sent to your email.'
      });
    } catch (error: any) {
      this.panel.webview.postMessage({
        type: 'error',
        error: `Network error: ${error?.message || 'Could not reach server.'}`
      });
    }
  }

  private async handleVerifyOtp(payload: any): Promise<void> {
    const { email, otp } = payload;

    if (!email || !otp) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Email and verification code are required.'
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'loading', loadingMessage: 'Verifying code...' });

    try {
      const response = await this.apiCall('/api/users/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        this.panel.webview.postMessage({
          type: 'error',
          error: data.message || 'Invalid or expired code.'
        });
        return;
      }

      this.panel.webview.postMessage({
        type: 'otpVerified',
        resetToken: data.resetToken,
        message: data.message || 'Code verified successfully.'
      });
    } catch (error: any) {
      this.panel.webview.postMessage({
        type: 'error',
        error: `Network error: ${error?.message || 'Could not reach server.'}`
      });
    }
  }

  private async handleResetPassword(payload: any): Promise<void> {
    const { email, resetToken, newPassword } = payload;

    if (!email || !resetToken || !newPassword) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'All fields are required.'
      });
      return;
    }

    if (newPassword.length < 6) {
      this.panel.webview.postMessage({
        type: 'error',
        error: 'Password must be at least 6 characters.'
      });
      return;
    }

    this.panel.webview.postMessage({ type: 'loading', loadingMessage: 'Resetting password...' });

    try {
      const response = await this.apiCall('/api/users/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, resetToken, newPassword })
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        this.panel.webview.postMessage({
          type: 'error',
          error: data.message || 'Failed to reset password.'
        });
        return;
      }

      this.panel.webview.postMessage({
        type: 'passwordReset',
        message: data.message || 'Password reset successfully. Please sign in.'
      });
    } catch (error: any) {
      this.panel.webview.postMessage({
        type: 'error',
        error: `Network error: ${error?.message || 'Could not reach server.'}`
      });
    }
  }

  private async apiCall(endpoint: string, options: any): Promise<Response> {
    const backendUrl = await getBackendUrl();
    const url = `${backendUrl}${endpoint}`;

    // Use fetch with error handling
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      return response;
    } catch (error: any) {
      throw error;
    }
  }

  private update(): void {
    this.panel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = String(Date.now());
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'login-panel.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'webview', 'login-panel.js'));

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} https: data:`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Preecode Login</title>
</head>
<body>
  <div class="login-container">
    <div class="login-panel">
      <div class="login-header">
        <h1>Preecode</h1>
        <button id="closeBtn" class="close-btn" aria-label="Close login panel">×</button>
      </div>

      <div class="tab-buttons">
        <button id="signInTab" class="tab-btn active" data-tab="signin">Sign In</button>
        <button id="signUpTab" class="tab-btn" data-tab="signup">Sign Up</button>
      </div>

      <!-- Sign In Form -->
      <form id="signInForm" class="auth-form active" data-form="signin">
        <div class="form-group">
          <label for="signInEmail">Email</label>
          <input
            id="signInEmail"
            type="email"
            placeholder="your@email.com"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="signInPassword">Password</label>
          <div class="password-wrapper">
            <input
              id="signInPassword"
              type="password"
              placeholder="••••••"
              required
              class="form-input"
            />
            <button
              id="signInPasswordToggle"
              class="password-toggle"
              type="button"
              aria-label="Toggle password visibility"
            >
              👁
            </button>
          </div>
        </div>

        <button id="signInSubmit" type="submit" class="form-submit">Sign In</button>

        <p class="forgot-link">
          <a href="#" id="forgotPasswordLink">Forgot your password?</a>
        </p>
      </form>

      <!-- Forgot Password Form - Step 1: Email -->
      <form id="forgotStep1" class="auth-form" data-form="forgot1">
        <div class="form-group">
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Enter your email address and we'll send you a verification code to reset your password.</p>
          <label for="forgotEmail">Email</label>
          <input
            id="forgotEmail"
            type="email"
            placeholder="your@email.com"
            required
            class="form-input"
          />
        </div>
        <button id="forgotStep1Submit" type="submit" class="form-submit">Send Code</button>
        <p class="form-helper" style="margin-top:12px;text-align:center;">
          <a href="#" id="backToSignIn1" style="color:var(--text-secondary);text-decoration:none;font-size:11px;">← Back to Sign In</a>
        </p>
      </form>

      <!-- Forgot Password Form - Step 2: OTP -->
      <form id="forgotStep2" class="auth-form" data-form="forgot2">
        <div class="form-group">
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Enter the 6-digit code sent to your email.</p>
          <label for="forgotOtp">Verification Code</label>
          <input
            id="forgotOtp"
            type="text"
            placeholder="000000"
            maxlength="6"
            required
            class="form-input"
            style="text-align:center;letter-spacing:8px;font-size:18px;font-family:monospace;"
          />
        </div>
        <button id="forgotStep2Submit" type="submit" class="form-submit">Verify Code</button>
        <p class="form-helper" style="margin-top:12px;text-align:center;">
          <a href="#" id="resendOtp" style="color:var(--accent);text-decoration:none;font-size:11px;">Resend code</a>
        </p>
      </form>

      <!-- Forgot Password Form - Step 3: New Password -->
      <form id="forgotStep3" class="auth-form" data-form="forgot3">
        <div class="form-group">
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">Create a new password for your account.</p>
          <label for="newPassword">New Password</label>
          <div class="password-wrapper">
            <input
              id="newPassword"
              type="password"
              placeholder="••••••"
              required
              class="form-input"
            />
            <button
              id="newPasswordToggle"
              class="password-toggle"
              type="button"
              aria-label="Toggle password visibility"
            >
              👁
            </button>
          </div>
          <p class="form-helper">Minimum 6 characters</p>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <div class="password-wrapper">
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••"
              required
              class="form-input"
            />
          </div>
        </div>
        <button id="forgotStep3Submit" type="submit" class="form-submit">Reset Password</button>
      </form>

      <!-- Sign Up Form -->
      <form id="signUpForm" class="auth-form" data-form="signup">
        <div class="form-group">
          <label for="signUpEmail">Email</label>
          <input
            id="signUpEmail"
            type="email"
            placeholder="your@email.com"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="signUpUsername">Username</label>
          <input
            id="signUpUsername"
            type="text"
            placeholder="username"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="signUpPassword">Password</label>
          <div class="password-wrapper">
            <input
              id="signUpPassword"
              type="password"
              placeholder="••••••"
              required
              class="form-input"
            />
            <button
              id="signUpPasswordToggle"
              class="password-toggle"
              type="button"
              aria-label="Toggle password visibility"
            >
              👁
            </button>
          </div>
          <p class="form-helper">Minimum 6 characters</p>
        </div>

        <button id="signUpSubmit" type="submit" class="form-submit">Create Account</button>
      </form>

      <div class="divider">
        <span>or</span>
      </div>

      <button id="googleBtn" class="google-btn" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.74h3.57c2.08-1.92 3.28-4.74 3.28-8.06z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.69l-3.57-2.74c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.82C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.57 1 10.24 1 12s.43 3.43 1.18 4.91l2.85-2.22.81-.6z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.82c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Sign in with Google</span>
      </button>

      <!-- Error/Success Messages -->
      <div id="errorContainer" class="message-container hidden" role="alert"></div>
      <div id="loadingContainer" class="message-container loading hidden" role="status"></div>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private close(): void {
    this.dispose();
  }

  dispose(): void {
    LoginPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}
