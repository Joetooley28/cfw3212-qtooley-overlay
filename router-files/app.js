(function () {
  const form = document.getElementById("at-form");
  const input = document.getElementById("command");
  const sendButton = document.getElementById("send");
  const copyButtons = [
    document.getElementById("copy-top"),
    document.getElementById("copy-bottom")
  ];
  const clearButtons = [
    document.getElementById("clear-top"),
    document.getElementById("clear-bottom")
  ];
  const themeToggle = document.getElementById("theme-toggle");
  const history = document.getElementById("history");
  const status = document.getElementById("status");
  let requestInFlight = false;
  const THEME_KEY = "cfw3212-at-theme";

  function timestamp() {
    return new Date().toLocaleTimeString();
  }

  function setStatus(message, className) {
    status.textContent = message || "";
    status.className = "status " + (className || "status-ready");
  }

  function appendBlock(lines) {
    history.textContent += lines.join("\n") + "\n\n";
    history.scrollTop = history.scrollHeight;
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  async function copyHistory() {
    if (!history.textContent) {
      setStatus("Nothing to copy", "status-ready");
      return;
    }

    try {
      await navigator.clipboard.writeText(history.textContent);
      setStatus("Copied history", "status-ready");
    } catch (err) {
      setStatus("Error: copy_failed", "status-error");
    }
  }

  function appendResult(result, command) {
    const lines = [
      "[" + timestamp() + "]",
      "Command: " + command,
      "Backend: " + (result.backend || "unknown"),
      "Device: " + (result.device_path || "unknown")
    ];

    if (result.ok) {
      lines.push("Result: OK");
    } else {
      lines.push("Result: " + (result.error || "error"));
    }

    lines.push("Response:");
    lines.push(result.response || "");
    appendBlock(lines);
  }

  async function sendCommand(command) {
    const response = await fetch("/at", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ command: command })
    });

    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      payload = {
        ok: false,
        error: "invalid_json_response",
        response: ""
      };
    }

    if (!response.ok && !payload.error) {
      payload.error = "http_" + response.status;
    }

    return payload;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (requestInFlight) {
      return;
    }

    const command = input.value.trim();
    if (!command) {
      return;
    }

    requestInFlight = true;
    sendButton.disabled = true;
    input.disabled = true;
    setStatus("Sending...", "status-busy");

    try {
      const result = await sendCommand(command);
      appendResult(result, command);
      if (result.ok) {
        setStatus("Done", "status-ready");
      } else {
        setStatus("Error: " + (result.error || "request_failed"), "status-error");
      }
    } catch (err) {
      appendBlock([
        "[" + timestamp() + "]",
        "Command: " + command,
        "Backend: unknown",
        "Device: unknown",
        "Result: request_failed",
        "Response:",
        String(err)
      ]);
      setStatus("Error: request_failed", "status-error");
    } finally {
      requestInFlight = false;
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
      input.select();
    }
  });

  clearButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      history.textContent = "";
      setStatus("Ready", "status-ready");
      input.focus();
    });
  });

  copyButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      copyHistory();
    });
  });

  themeToggle.addEventListener("click", function () {
    const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch (err) {
      // Ignore storage errors and keep the current page theme.
    }
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && requestInFlight) {
      event.preventDefault();
    }
  });

  try {
    setTheme(window.localStorage.getItem(THEME_KEY) || "dark");
  } catch (err) {
    setTheme("dark");
  }

  input.focus();
})();
