const loginForm = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginButton = document.querySelector("#login-button");
const message = document.querySelector("#message");
const dashboard = document.querySelector("#dashboard");
const welcome = document.querySelector("#welcome");
const adminButton = document.querySelector("#admin-button");
const adminResult = document.querySelector("#admin-result");
const logoutButton = document.querySelector("#logout-button");

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "La solicitud ha fallado.");
  }

  return data;
}

function showMessage(text, isError = true) {
  message.textContent = text;
  message.style.color = isError ? "#f87171" : "#5eead4";
}

function showDashboard(user) {
  loginForm.hidden = true;
  dashboard.hidden = false;

  welcome.textContent =
    `Usuario: ${user.username} | Rol: ${user.role}`;

  adminButton.hidden = user.role !== "admin";
  adminResult.hidden = true;
  message.textContent = "";
}

function showLogin() {
  loginForm.hidden = false;
  dashboard.hidden = true;
  adminButton.hidden = true;
  adminResult.hidden = true;
  passwordInput.value = "";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginButton.disabled = true;
  showMessage("");

  try {
    const data = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    showDashboard(data.user);
  } catch (error) {
    showMessage(error.message);
  } finally {
    loginButton.disabled = false;
  }
});

adminButton.addEventListener("click", async () => {
  adminButton.disabled = true;
  adminResult.hidden = false;
  adminResult.textContent = "Comprobando permisos...";

  try {
    const data = await request("/api/admin");
    adminResult.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    adminResult.textContent = error.message;
  } finally {
    adminButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await request("/api/logout", { method: "POST" });
    showLogin();
    showMessage("Sesión cerrada correctamente.", false);
  } catch (error) {
    showMessage(error.message);
  } finally {
    logoutButton.disabled = false;
  }
});

// Recupera la sesión al recargar la página.
async function restoreSession() {
  try {
    const data = await request("/api/me");
    showDashboard(data.user);
  } catch {
    showLogin();
  }
}

restoreSession();