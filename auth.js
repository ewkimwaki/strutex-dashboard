// auth.js - Comprehensive Strutex Authentication & Activity Tracking Engine

let currentAuthUser = null;

/**
 * Switch tabs within the Authentication Modal Hub
 */
function switchToAuthTab(tab) {
    const tabs = ['login', 'signup', 'forgot', 'otp'];
    
    // Update Dynamic Title Text
    const titleEl = document.getElementById('authDynamicTitle');
    if (titleEl) {
        if (tab === 'login') titleEl.innerText = 'Sign in';
        if (tab === 'signup') titleEl.innerText = 'Create Account';
        if (tab === 'forgot') titleEl.innerText = 'Reset Password';
        if (tab === 'otp') titleEl.innerText = 'Verify Email';
    }

    tabs.forEach(t => {
        const el = document.getElementById(`authView_${t}`);
        if (el) el.style.display = (t === tab) ? 'block' : 'none';
        
        const tabBtn = document.getElementById(`authTabBtn_${t}`);
        if (tabBtn) {
            if (t === tab) {
                tabBtn.style.borderBottom = '3px solid #0284c7'; // BoQ Blue theme
                tabBtn.style.color = '#0284c7';
                tabBtn.style.fontWeight = '700';
            } else {
                tabBtn.style.borderBottom = '3px solid transparent';
                tabBtn.style.color = '#94a3b8';
                tabBtn.style.fontWeight = '600';
            }
        }
    });
}

/**
 * 1. LOG IN PROCESS & 7. NON-EXISTENT ACCOUNT HANDLING
 */
async function handleLogin() {
    const email = document.getElementById('authUserEmail').value.trim();
    const password = document.getElementById('authUserPassword').value;

    if (!email || !password) {
        showToast("Please provide both email and password.", "warning");
        return;
    }

    if (!dbClient) {
        showToast("Database client not initialized.", "error");
        return;
    }

    const loginBtn = document.getElementById('btnLoginSubmit');
    if (loginBtn) { loginBtn.disabled = true; loginBtn.innerText = "Signing in..."; }

    try {
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        
        if (error) {
            const errLower = error.message.toLowerCase();
            if (errLower.includes("invalid login credentials") || errLower.includes("user not found") || error.status === 400) {
                showToast("Account not found or password incorrect.", "error");
                
                if (confirm(`No active account found for "${email}". Would you like to create a new account now?`)) {
                    document.getElementById('authSignUpEmail').value = email;
                    switchToAuthTab('signup');
                }
                return;
            }
            throw error;
        }

        showToast(`Welcome back, ${data.user.email}!`, "success");
        closeModal('authModal');
        updateAuthUI(data.user);
        
        await logActivity("User Login", `Logged in as ${data.user.email}`);
    } catch (err) {
        showToast("Login failed: " + err.message, "error");
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.innerText = "Sign in"; }
    }
}

/**
 * 2. LOG OUT PROCESS
 */
async function handleLogout() {
    if (dbClient) {
        if (currentAuthUser) {
            await logActivity("User Logout", `User ${currentAuthUser.email} signed out`);
        }
        await dbClient.auth.signOut();
        showToast("Logged out successfully.", "info");
        updateAuthUI(null);
    }
}

/**
 * 3. SIGN UP PROCESS
 */
async function handleSignUp() {
    const fullName = document.getElementById('authSignUpName').value.trim();
    const email = document.getElementById('authSignUpEmail').value.trim();
    const password = document.getElementById('authSignUpPassword').value;
    const confirmPassword = document.getElementById('authSignUpPasswordConfirm').value;

    if (!fullName || !email || !password) {
        showToast("Please fill in all required fields.", "warning");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Passwords do not match.", "warning");
        return;
    }

    if (password.length < 6) {
        showToast("Password must be at least 6 characters long.", "warning");
        return;
    }

    if (!dbClient) {
        showToast("Database client not initialized.", "error");
        return;
    }

    const signupBtn = document.getElementById('btnSignUpSubmit');
    if (signupBtn) { signupBtn.disabled = true; signupBtn.innerText = "Registering..."; }

    try {
        const { data, error } = await dbClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });

        if (error) throw error;

        showToast("Verification code sent to your email!", "info");
        document.getElementById('otpVerifyEmailDisplay').innerText = email;
        document.getElementById('authOtpEmail').value = email;
        switchToAuthTab('otp');
    } catch (err) {
        showToast("Sign up failed: " + err.message, "error");
    } finally {
        if (signupBtn) { signupBtn.disabled = false; signupBtn.innerText = "Create Account"; }
    }
}

/**
 * 6. EMAIL VERIFICATION CODE (OTP) PROCESS
 */
async function handleVerifyOTP() {
    const email = document.getElementById('authOtpEmail').value.trim();
    const token = document.getElementById('authOtpCode').value.trim();

    if (!token || token.length < 6) {
        showToast("Please enter the 6-digit code sent to your email.", "warning");
        return;
    }

    if (!dbClient) {
        showToast("Database client not initialized.", "error");
        return;
    }

    const otpBtn = document.getElementById('btnOtpSubmit');
    if (otpBtn) { otpBtn.disabled = true; otpBtn.innerText = "Verifying..."; }

    try {
        let { data, error } = await dbClient.auth.verifyOtp({ email, token, type: 'signup' });
        if (error) {
            const altResult = await dbClient.auth.verifyOtp({ email, token, type: 'email' });
            if (altResult.error) throw error;
            data = altResult.data;
        }

        showToast("Email verified successfully! Welcome to Strutex.", "success");
        closeModal('authModal');
        updateAuthUI(data.user);
        await logActivity("Account Verified", `Registered & verified new user ${email}`);
    } catch (err) {
        showToast("Verification failed: " + err.message, "error");
    } finally {
        if (otpBtn) { otpBtn.disabled = false; otpBtn.innerText = "Verify & Complete"; }
    }
}

/**
 * 4. FORGOT PASSWORD PROCESS
 */
async function handleForgotPassword() {
    const email = document.getElementById('authForgotEmail').value.trim();
    if (!email) { showToast("Please enter your email address.", "warning"); return; }
    if (!dbClient) { showToast("Database client not initialized.", "error"); return; }

    const forgotBtn = document.getElementById('btnForgotSubmit');
    if (forgotBtn) { forgotBtn.disabled = true; forgotBtn.innerText = "Sending..."; }

    try {
        const { error } = await dbClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;

        showToast("Password reset link sent to your email!", "success");
        await logActivity("Password Reset Requested", `Reset link requested for ${email}`);
        switchToAuthTab('login');
    } catch (err) {
        showToast("Password reset failed: " + err.message, "error");
    } finally {
        if (forgotBtn) { forgotBtn.disabled = false; forgotBtn.innerText = "Send Reset Link"; }
    }
}

/**
 * 5. UPDATE PASSWORD PROCESS (Post-Recovery)
 */
async function handleUpdatePassword() {
    const newPassword = document.getElementById('newRecoveredPassword').value;
    
    if (!newPassword || newPassword.length < 6) {
        showToast("Password must be at least 6 characters.", "warning");
        return;
    }

    if (!dbClient) return;

    const updateBtn = document.getElementById('btnUpdatePassword');
    if (updateBtn) { updateBtn.disabled = true; updateBtn.innerText = "Updating..."; }

    try {
        const { error } = await dbClient.auth.updateUser({ password: newPassword });
        if (error) throw error;

        showToast("Password updated successfully! Welcome back.", "success");
        closeModal('updatePasswordModal');
        await logActivity("Password Updated", "User completed password recovery flow.");
        
        // Strip the recovery token from the URL for a clean state
        window.history.replaceState(null, document.title, window.location.pathname);
    } catch (err) {
        showToast("Failed to update password: " + err.message, "error");
    } finally {
        if (updateBtn) { updateBtn.disabled = false; updateBtn.innerText = "Update Password"; }
    }
}
/**
 * Global Guard to block actions for unauthenticated users
 */
function requireAuth(actionName = "make changes") {
    if (!currentAuthUser) {
        showToast(`🔒 Authentication required to ${actionName}. Please log in.`, "warning");
        switchToAuthTab('login');
        openModal('authModal');
        return false;
    }
    return true;
}

function updateAuthUI(user) {
    currentAuthUser = user;

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const activityBtn = document.getElementById('activityLogBtn');
    const userEmailTag = document.getElementById('userEmailTag');
    
    const landingBanner = document.getElementById('landingHeroBanner');
    const protectedActions = document.getElementById('protectedActions');
    const mainDashboardArea = document.getElementById('mainDashboardArea');
    const dashboardHeader = document.querySelector('header');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (activityBtn) activityBtn.style.display = 'inline-flex';
        if (userEmailTag) userEmailTag.innerText = user.email;
        
        if (landingBanner) landingBanner.style.display = 'none';
        if (dashboardHeader) dashboardHeader.style.display = 'flex';
        if (protectedActions) protectedActions.style.display = 'flex';
        if (mainDashboardArea) mainDashboardArea.style.display = 'block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (activityBtn) activityBtn.style.display = 'none';
        if (userEmailTag) userEmailTag.innerText = '';
        
        if (landingBanner) landingBanner.style.display = 'flex';
        if (dashboardHeader) dashboardHeader.style.display = 'none';
        if (protectedActions) protectedActions.style.display = 'none';
        if (mainDashboardArea) mainDashboardArea.style.display = 'none';
    }

    if (typeof renderTable === 'function') {
        renderTable();
    }
}

async function logActivity(action, details) {
    const userEmail = currentAuthUser ? currentAuthUser.email : 'Guest / System';
    const timestamp = new Date().toISOString();
    
    const logEntry = { user_email: userEmail, action: action, details: details, timestamp: timestamp };
    let logs = JSON.parse(localStorage.getItem('strutex_activity_logs') || '[]');
    logs.unshift(logEntry);
    if (logs.length > 150) logs = logs.slice(0, 150);
    localStorage.setItem('strutex_activity_logs', JSON.stringify(logs));

    if (dbClient) {
        try {
            await dbClient.from('strutex_activity_logs').insert([{
                user_email: userEmail, action: action, details: details, created_at: timestamp
            }]);
        } catch (err) {}
    }
}

async function openActivityLogModal() {
    openModal('userActivityModal');
    await renderActivityLogs();
}

async function renderActivityLogs() {
    const tbody = document.getElementById('activityLogsTableBody');
    const userListContainer = document.getElementById('registeredUsersContainer');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading activity logs...</td></tr>';
    let logs = JSON.parse(localStorage.getItem('strutex_activity_logs') || '[]');

    if (dbClient) {
        try {
            const { data, error } = await dbClient.from('strutex_activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
            if (!error && data && data.length > 0) {
                logs = data.map(d => ({ user_email: d.user_email, action: d.action, details: d.details, timestamp: d.created_at }));
            }
        } catch (e) {}
    }

    if (userListContainer) {
        const uniqueUsers = Array.from(new Set(logs.map(l => l.user_email).filter(e => e && e !== 'Guest / System')));
        userListContainer.innerHTML = uniqueUsers.length === 0 ? 
            `<span style="font-size:0.8rem; color:#64748b;">No registered user sessions logged yet.</span>` :
            uniqueUsers.map(u => `<div style="background:#e0f2fe; border:1px solid #bae6fd; color:#0369a1; padding:4px 10px; border-radius:15px; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:5px;">👤 ${u}</div>`).join('');
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No activity logged yet.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(l => {
        const dt = new Date(l.timestamp).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' });
        return `<tr><td style="font-size:0.75rem; color:#64748b;">${dt}</td><td><strong style="color:#0f172a; font-size:0.8rem;">${l.user_email}</strong></td><td><span class="badge badge-active" style="font-size:0.7rem;">${l.action}</span></td><td style="font-size:0.8rem; color:#334155;">${l.details}</td></tr>`;
    }).join('');
}

async function initAuth() {
    if (!dbClient) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        updateAuthUI(session ? session.user : null);

        dbClient.auth.onAuthStateChange((event, session) => {
            updateAuthUI(session ? session.user : null);
            if (event === 'PASSWORD_RECOVERY') {
                closeModal('authModal');
                openModal('updatePasswordModal');
            }
        });
        
        if (window.location.hash.includes('type=recovery')) {
            openModal('updatePasswordModal');
        }
    } catch (e) {}
}

function togglePasswordVisibility(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        iconElement.innerText = "🔒"; 
    } else {
        input.type = "password";
        iconElement.innerText = "👁️";
    }
}
