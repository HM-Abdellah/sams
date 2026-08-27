<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/../app/Helpers/Csrf.php';
use SAMS\Helpers\Csrf;
if (!empty($_SESSION['_auth_user'])) { header('Location: index.php'); exit; }
$csrf = Csrf::token();
?>
<!doctype html>
<html lang="fr" dir="rtl">
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
  <div class="login-logo">🏫</div>
  <p class="eyebrow">Student Attendance Management System</p>
  <h1>SAMS</h1>
  <p class="subtitle">Système de gestion des absences</p>
  <div id="loginError" class="error" hidden role="alert"></div>
  <form id="loginForm" novalidate>
    <label>Nom d'utilisateur<input id="username" name="username" maxlength="50" autocomplete="username" required></label>
    <label>Mot de passe<input id="password" name="password" type="password" autocomplete="current-password" required></label>
    <button id="loginBtn" type="submit">Se connecter</button>
  </form>
  <p class="offline-note">Serveur local XAMPP · Réseau de l'établissement</p>
</section>
</main>
<script type="module" src="assets/js/auth.js"></script>
</body>
</html>
