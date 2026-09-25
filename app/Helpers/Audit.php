<?php

declare(strict_types=1);

namespace SAMS\Helpers;

final class Audit
{
    public static function actionName(string $action): string
    {
        $action = trim($action);
        if ($action === '' || strlen($action) > 100 || !preg_match('/^[A-Za-z0-9_.:-]+$/', $action)) {
            throw new \InvalidArgumentException('Invalid audit action.');
        }
        return $action;
    }

    private function __construct() {}
}
