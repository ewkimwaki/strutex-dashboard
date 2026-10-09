// auth.js - Comprehensive Strutex Authentication & Activity Tracking Engine

let currentAuthUser = null;

/**
 * Switch tabs within the Authentication Modal Hub
 */
function switchToAuthTab(tab) {
    const tabs = ['login', 'signup', 'forgot', 'otp'];
    tabs.forEach(t => {
        const el = document.getElementById(`authView_${t}`);
        if (el) el.style.display = (t === tab) ? 'block' : 'none';
        
        const tabBtn = document.getElementById(`authTabBtn_${t}`);
        if (tabBtn) {
            tabBtn.style.borderBottom = (t === tab) ? '3px solid var(--primary-color)' : 'none';
            tabBtn.style.fontWeight = (t === tab) ? '700' : '500';
            tabBtn.style.color = (t === tab) ? 'var(--primary-color)' : '#64748b';
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
            // Requirement #7: Logic flow if user account does not exist
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
        if (loginBtn) { loginBtn.disabled = false; loginBtn.innerText = "Sign In"; }
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
 * 3. SIGN UP PROCESS & 6. EMAIL VERIFICATION INITIATION
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
            options: {
                data: { full_name: fullName }
            }
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
        let { data, error } = await dbClient.auth.verifyOtp({
            email,
            token,
            type: 'signup'
        });

        if (error) {
            // Secondary attempt for magic link or email tokens
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

    if (!email) {
        showToast("Please enter your email address.", "warning");
        return;
    }

    if (!dbClient) {
        showToast("Database client not initialized.", "error");
        return;
    }

    const forgotBtn = document.getElementById('btnForgotSubmit');
    if (forgotBtn) { forgotBtn.disabled = true; forgotBtn.innerText = "Sending..."; }

    try {
        const { error } = await dbClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
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
 * 5. LANDING PAGE & AUTH STATE MANAGEMENT
 */
function updateAuthUI(user) {
    currentAuthUser = user;

    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const activityBtn = document.getElementById('activityLogBtn');
    const userEmailTag = document.getElementById('userEmailTag');
    const landingBanner = document.getElementById('landingHeroBanner');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (activityBtn) activityBtn.style.display = 'inline-flex';
        if (userEmailTag) userEmailTag.innerText = user.email;
        if (landingBanner) landingBanner.style.display = 'none';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (activityBtn) activityBtn.style.display = 'none';
        if (userEmailTag) userEmailTag.innerText = '';
        if (landingBanner) landingBanner.style.display = 'block';
    }
}

/**
 * 8. USER DIRECTORY & ACTIVITY TRACKING LOGIC
 */
async function logActivity(action, details) {
    const userEmail = currentAuthUser ? currentAuthUser.email : 'Guest / System';
    const timestamp = new Date().toISOString();
    
    const logEntry = {
        user_email: userEmail,
        action: action,
        details: details,
        timestamp: timestamp
    };

    // Store in local buffer
    let logs = JSON.parse(localStorage.getItem('strutex_activity_logs') || '[]');
    logs.unshift(logEntry);
    if (logs.length > 150) logs = logs.slice(0, 150);
    localStorage.setItem('strutex_activity_logs', JSON.stringify(logs));

    // Store in Supabase Cloud table if available
    if (dbClient) {
        try {
            await dbClient.from('strutex_activity_logs').insert([{
                user_email: userEmail,
                action: action,
                details: details,
                created_at: timestamp
            }]);
        } catch (err) {
            console.warn("Cloud activity log notice:", err.message);
        }
    }
}

/**
 * Opens and renders the User Directory & Activity Log Modal
 */
async function openActivityLogModal() {
    openModal('userActivityModal');
    await renderActivityLogs();
}

/**
 * Render list of activity logs and registered user badges
 */
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
                logs = data.map(d => ({
                    user_email: d.user_email,
                    action: d.action,
                    details: d.details,
                    timestamp: d.created_at
                }));
            }
        } catch (e) {
            console.warn("Using local activity log fallback.", e);
        }
    }

    if (userListContainer) {
        const uniqueUsers = Array.from(new Set(logs.map(l => l.user_email).filter(e => e && e !== 'Guest / System')));
        if (uniqueUsers.length === 0) {
            userListContainer.innerHTML = `<span style="font-size:0.8rem; color:#64748b;">No registered user sessions logged yet.</span>`;
        } else {
            userListContainer.innerHTML = uniqueUsers.map(u => `
                <div style="background:#e0f2fe; border:1px solid #bae6fd; color:#0369a1; padding:4px 10px; border-radius:15px; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                    👤 ${u}
                </div>
            `).join('');
        }
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No activity logged yet.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(l => {
        const dt = new Date(l.timestamp).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' });
        return `
            <tr>
                <td style="font-size:0.75rem; color:#64748b;">${dt}</td>
                <td><strong style="color:#0f172a; font-size:0.8rem;">${l.user_email}</strong></td>
                <td><span class="badge badge-active" style="font-size:0.7rem;">${l.action}</span></td>
                <td style="font-size:0.8rem; color:#334155;">${l.details}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Initialize Session and Listeners
 */
async function initAuth() {
    if (!dbClient) return;

    try {
        const { data: { session } } = await dbClient.auth.getSession();
        updateAuthUI(session ? session.user : null);

        dbClient.auth.onAuthStateChange((_event, session) => {
            updateAuthUI(session ? session.user : null);
        });
    } catch (e) {
        console.warn("Auth initialization error:", e);
    }
}
