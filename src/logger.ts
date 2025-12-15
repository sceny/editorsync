import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as vscode from 'vscode';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LoggerConfig {
    level: LogLevel;
    retentionDays: number;
}

function getLoggerConfig(): LoggerConfig {
    const config = vscode.workspace.getConfiguration('scenyAIEditorSync');
    return {
        level: config.get<LogLevel>('logLevel', 'info'),
        retentionDays: config.get<number>('logRetentionDays', 7)
    };
}

// Logger instances per workspace
const loggers: Map<string, winston.Logger> = new Map();

/**
 * Ensure .rulessync/.gitignore exists to ignore logs
 */
function ensureGitignore(rulessyncDir: string): void {
    const gitignorePath = path.join(rulessyncDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, 'logs/\n', 'utf8');
    }
}

/**
 * Get or create logger for a workspace
 */
export function getLogger(workspaceRoot: string): winston.Logger {
    let logger = loggers.get(workspaceRoot);
    if (logger) {
        return logger;
    }

    const config = getLoggerConfig();
    const rulessyncDir = path.join(workspaceRoot, '.rulessync');
    const logsDir = path.join(rulessyncDir, 'logs');

    // Ensure directories exist
    if (!fs.existsSync(rulessyncDir)) {
        fs.mkdirSync(rulessyncDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Ensure .gitignore
    ensureGitignore(rulessyncDir);

    // Create daily rotating file transport
    const dailyRotateTransport = new DailyRotateFile({
        dirname: logsDir,
        filename: 'sceny-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: `${config.retentionDays}d`,
        maxSize: '10m',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}`;
            })
        )
    });

    // Create logger
    logger = winston.createLogger({
        level: config.level,
        transports: [dailyRotateTransport]
    });

    loggers.set(workspaceRoot, logger);
    return logger;
}

/**
 * Log helper that auto-detects workspace from file path
 */
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        console.log(`[Sceny ${level}] ${message}`);
        return;
    }

    const logger = getLogger(folders[0].uri.fsPath);
    logger.log(level, message, meta);
}

/**
 * Convenience methods
 */
export const logger = {
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta)
};

/**
 * Update logger level when config changes
 */
export function updateLogLevel(): void {
    const config = getLoggerConfig();
    for (const [, winstonLogger] of loggers) {
        winstonLogger.level = config.level;
    }
}

/**
 * Close all loggers on deactivation
 */
export function closeLoggers(): void {
    for (const [, winstonLogger] of loggers) {
        winstonLogger.close();
    }
    loggers.clear();
}
