<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/app/bootstrap.php';

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;

if (Auth::check()) {
    header('Location: index.php', true, 302);
    exit;
}

$csrf = Csrf::token();
?>
<!doctype html>
<html lang="fr" dir="ltr" data-page="login">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="theme-color" content="#0d1117">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
    <title>SAMS — Connexion</title>
    <link rel="stylesheet" href="assets/css/login.css">
</head>
<body>
<main class="login-shell">
    <section class="login-card">
        <div class="login-logo" aria-hidden="true">🏫</div>
        <div class="login-language" role="group" aria-label="Language"><button class="language-btn active" data-lang="fr" type="button">FR</button><button class="language-btn" data-lang="ar" type="button">العربية</button><button class="language-btn" data-lang="en" type="button">EN</button></div><p class="eyebrow">Student Attendance Management System</p>
        <h1>SAMS</h1>
        <p class="subtitle" data-i18n="login_subtitle">Système de gestion des absences</p>
        <div id="loginError" class="error" hidden role="alert"></div>
        <form id="loginForm" novalidate>
            <label><span data-i18n="username">Nom d'utilisateur</span><input id="username" name="username" maxlength="50" autocomplete="username" required></label>
            <label><span data-i18n="password">Mot de passe</span><input id="password" name="password" type="password" autocomplete="current-password" required></label>
            <button id="loginBtn" type="submit" data-i18n="login">Se connecter</button>
        </form>
        <p class="offline-note" data-i18n="local_server_note">Serveur local XAMPP · Réseau de l’établissement</p>
    </section>
</main>
<script type="module" src="assets/js/auth.js"></script>
</body>
</html>
