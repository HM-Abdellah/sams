<?php

declare(strict_types=1);

namespace SAMS\Helpers;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) return self::$connection;

        $path = dirname(__DIR__, 2) . '/config/database.php';
        if (!is_file($path)) throw new RuntimeException('Missing config/database.php. Copy database.example.php first.');
        $config = require $path;
        if (!is_array($config)) throw new RuntimeException('Invalid database configuration.');
        foreach (['host','port','database','username','password','charset'] as $key) if (!array_key_exists($key, $config)) throw new RuntimeException("Missing database setting: {$key}");
        if (!preg_match('/^[A-Za-z0-9_]+$/', (string)$config['database'])) throw new RuntimeException('Invalid database name.');

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $config['host'], (int)$config['port'], $config['database'], $config['charset']);
        try {
            self::$connection = new PDO($dsn, (string)$config['username'], (string)$config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Database connection failed.', 0, $e);
        }
        return self::$connection;
    }

    private function __construct() {}
    private function __clone() {}
}
