<?php

declare(strict_types=1);

namespace SAMS\Http;

use JsonException;

final class Response
{
    public function __construct(
        private readonly string $body,
        private readonly int $status = 200,
        private readonly array $headers = []
    ) {}

    public static function json(array $data, int $status = 200, array $headers = []): self
    {
        try {
            $body = json_encode(
                $data,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
        } catch (JsonException) {
            $body = '{"success":false,"error":"Response encoding failed."}';
            $status = 500;
        }

        return new self(
            $body,
            $status,
            array_merge(['Content-Type' => 'application/json; charset=UTF-8'], $headers)
        );
    }

    public function status(): int
    {
        return $this->status;
    }

    public function headers(): array
    {
        return $this->headers;
    }

    public function body(): string
    {
        return $this->body;
    }

    public function send(): never
    {
        http_response_code($this->status);

        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        header('X-Frame-Options: DENY');

        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        echo $this->body;
        exit;
    }
}
