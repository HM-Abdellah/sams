<?php
declare(strict_types=1); session_start(); require_once __DIR__.'/../Services/AuthService.php'; require_once __DIR__.'/../Helpers/Auth.php'; require_once __DIR__.'/../Helpers/Response.php';
// HTTP authentication is currently exposed through api/auth.php; this controller is the application-layer entry point reserved for routing/refactoring.
