<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Response
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
        exit;
    }

    public static function success(mixed $data = null, int $status = 200): never
    {
        self::json(['success' => true, 'data' => $data], $status);
    }

    public static function error(string $message, int $status = 400, array $details = []): never
    {
        $payload = ['success' => false, 'error' => $message];
        if ($details !== []) {
            $payload['details'] = $details;
        }
        self::json($payload, $status);
    }
}
