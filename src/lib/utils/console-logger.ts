// ABOUTME: Console logger utility that captures recent errors and warnings
// ABOUTME: Maintains a rolling buffer of last 10 console messages for feedback context

interface ConsoleLog {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
}

const MAX_LOGS = 10;
const consoleBuffer: ConsoleLog[] = [];

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;

// Flag to prevent double initialization
let initialized = false;

export function initializeConsoleLogger() {
  if (initialized) return;
  initialized = true;

  // Override console.error
  console.error = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (err) {
          return '[Object (circular or non-serializable)]';
        }
      }
      return String(arg);
    }).join(' ');

    consoleBuffer.push({
      level: 'error',
      message,
      timestamp: Date.now(),
    });

    // Keep only last 10 entries
    if (consoleBuffer.length > MAX_LOGS) {
      consoleBuffer.shift();
    }

    // Call original console.error
    originalError(...args);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (err) {
          return '[Object (circular or non-serializable)]';
        }
      }
      return String(arg);
    }).join(' ');

    consoleBuffer.push({
      level: 'warn',
      message,
      timestamp: Date.now(),
    });

    // Keep only last 10 entries
    if (consoleBuffer.length > MAX_LOGS) {
      consoleBuffer.shift();
    }

    // Call original console.warn
    originalWarn(...args);
  };
}

export function getRecentConsoleLogs(): ConsoleLog[] {
  return consoleBuffer.slice();
}

export function clearConsoleLogs() {
  consoleBuffer.length = 0;
}
