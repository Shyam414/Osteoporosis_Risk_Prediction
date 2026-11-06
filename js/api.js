//api.js
//python -m http.server 5500
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://osteoporosis-risk-prediction.onrender.com";

// const API_BASE = "http://localhost:5000";

function getToken() {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Session expired. Please login again.");
  return token;
}

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("role");
  window.location.href = "login.html";
}

let refreshPromise = null;
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("No refresh token");

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`
        }
      });

      if (!res.ok) throw new Error("Refresh token expired");

      const data = await res.json();

      if (!data.access_token) {
        throw new Error("New access token missing");
      }

      localStorage.setItem("access_token", data.access_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// COMMON AUTHENTICATED REQUEST

async function authFetch(url, options = {}) {
  const request = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

  let res = await request(getToken());

  if (res.status === 401) {
    try {
      await refreshAccessToken();
      res = await request(getToken());
    } catch (err) {
      clearSession();
      throw err;
    }

    if (res.status === 401) {
      clearSession();
      throw new Error("Session expired. Please login again.");
    }
  }

  return res;
}

// AUTH

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("role", data.role);
  }

  return { ok: res.ok, status: res.status, ...data };
}

async function register(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, ...data };
}

async function logout() {
  try {
    const token = localStorage.getItem("access_token");

    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  } finally {
    clearSession();
  }
}

async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  return { ok: res.ok, status: res.status, ...data };
}

async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password })
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, ...data };
}

// COMMON RESPONSE HANDLING

async function apiRequest(url, options = {}) {
  const res = await authFetch(url, options);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || "API request failed");
  }

  return res;
}

// DASHBOARD

async function getDashboard() {
  const res = await apiRequest(`${API_BASE}/dashboard`);
  return res.json();
}

// PREDICT / UPLOAD FILE

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiRequest(`${API_BASE}/predict/upload`, {
    method: "POST",
    body: formData
  });

  return res.json();
}

async function getPredictionResult(jobId) {
  const res = await apiRequest(
    `${API_BASE}/predict/result/${encodeURIComponent(jobId)}`
  );

  return res.json();
}

// ADMIN

async function getAdminStats() {
  const res = await apiRequest(`${API_BASE}/admin/stats`);
  return res.json();
}

async function getAllUsers() {
  const res = await apiRequest(`${API_BASE}/admin/users`);
  return res.json();
}

async function getAllRecords() {
  const res = await apiRequest(`${API_BASE}/admin/records`);
  return res.json();
}

async function apiDeleteUser(userId) {
  await apiRequest(`${API_BASE}/admin/users/${userId}`, {
    method: "DELETE"
  });
}

async function apiDeleteRecord(recordId) {
  await apiRequest(`${API_BASE}/admin/records/${recordId}`, {
    method: "DELETE"
  });
}

async function verifyUser(userId, email) {
  if (!confirm(`Verify ${email}?`)) return;

  await apiRequest(`${API_BASE}/admin/users/${userId}/verify`, {
    method: "POST"
  });

  alert(`${email} verified`);
  loadAdmin();
}

async function makeAdmin(userId, email) {
  if (!confirm(`Make ${email} admin?`)) return;

  await apiRequest(`${API_BASE}/admin/users/${userId}/promote`, {
    method: "POST"
  });

  alert(`${email} is admin now`);
  loadAdmin();
}

async function demoteAdmin(userId, email) {
  if (!confirm(`Remove admin role from ${email}?`)) return;

  await apiRequest(`${API_BASE}/admin/users/${userId}/demote`, {
    method: "POST"
  });

  alert(`${email} is normal user now`);
  loadAdmin();
}

// ADMIN IMAGE

async function fetchAdminImage(fileId) {
  try {
    const res = await authFetch(`${API_BASE}/predict/file/${fileId}`);

    if (!res.ok) return "placeholder.png";

    return URL.createObjectURL(await res.blob());
  } catch {
    return "placeholder.png";
  }
}
