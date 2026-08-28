<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Response
{
    public static function success(mixed $data = null, int $status = 200): never
    {
        self::send(['success' => true, 'data' => $data], $status);
    }

    public static function error(string $message, int $status = 400, array $details = []): never
    {
        $payload = ['success' => false, 'error' => $message];
        if ($details !== []) {
            $payload['details'] = $details;
        }
        self::send($payload, $status);
    }

    private static function send(array $payload, int $status): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store');
        try {
            echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            http_response_code(500);
            echo '{"success":false,"error":"Response encoding failed."}';
        }
        exit;
    }
}
