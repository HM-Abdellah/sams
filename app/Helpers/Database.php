<?php

declare(strict_types=1);

namespace SAMS\Helpers;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $connection = null;

    /**
     * Return the shared PDO connection.
     *
     * The real config file is intentionally outside Git. This prevents
     * database credentials from being committed to the repository.
     */
    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $configPath = dirname(__DIR__, 2) . '/config/database.php';
        if (!is_file($configPath)) {
            throw new RuntimeException(
                'Missing config/database.php. Copy config/database.example.php to config/database.php and configure it.'
            );
        }

        $config = require $configPath;
        self::validateConfig($config);

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $config['host'],
            $config['port'],
            $config['database'],
            $config['charset']
        );

        try {
            self::$connection = new PDO(
                $dsn,
                $config['username'],
                $config['password'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_STRINGIFY_FETCHES   => false,
                ]
            );
        } catch (PDOException $exception) {
            throw new RuntimeException('Database connection failed.', 0, $exception);
        }

        return self::$connection;
    }

    private static function validateConfig(mixed $config): void
    {
        if (!is_array($config)) {
            throw new RuntimeException('Database configuration must return an array.');
        }

        foreach (['host', 'port', 'database', 'username', 'password', 'charset'] as $key) {
            if (!array_key_exists($key, $config)) {
                throw new RuntimeException("Missing database configuration key: {$key}");
            }
        }

        if (!is_int($config['port']) && !ctype_digit((string) $config['port'])) {
            throw new RuntimeException('Database port must be an integer.');
        }

        if (!preg_match('/^[a-zA-Z0-9_]+$/', (string) $config['database'])) {
            throw new RuntimeException('Invalid database name configuration.');
        }
    }

    private function __construct()
    {
    }

    private function __clone()
    {
    }
}
