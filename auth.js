// auth.js - Dedicated Strutex Authentication Module

/**
 * Handles user login via Supabase Auth
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

    try {
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        showToast(`Welcome back, ${data.user.email}!`, "success");
        closeModal('authModal');
        updateAuthUI(data.user);
    } catch (err) {
        showToast("Login failed: " + err.message, "error");
    }
}

/**
 * Handles user sign out
 */
async function handleLogout() {
    if (dbClient) {
        await dbClient.auth.signOut();
        showToast("Logged out successfully.", "info");
        updateAuthUI(null);
    }
}

/**
 * Updates UI buttons and email tags based on session state
 */
function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userEmailTag = document.getElementById('userEmailTag');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (userEmailTag) userEmailTag.innerText = user.email;
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userEmailTag) userEmailTag.innerText = '';
    }
}

/**
 * Checks existing session and registers auth state change listener
 */
async function initAuth() {
    if (!dbClient) return;

    const { data: { session } } = await dbClient.auth.getSession();
    updateAuthUI(session ? session.user : null);

    dbClient.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session ? session.user : null);
    });
}
