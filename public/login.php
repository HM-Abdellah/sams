<?php
declare(strict_types=1);
session_start();
if (!empty($_SESSION['user'])) { header('Location: index.php'); exit; }
$error = $_SESSION['login_error'] ?? '';
unset($_SESSION['login_error']);
?><!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SAMS — تسجيل الدخول</title><link rel="stylesheet" href="assets/css/login.css"></head><body><main class="login-shell"><section class="login-card"><div class="login-logo">🏫</div><h1>SAMS</h1><p>نظام الغياب المدرسي</p><?php if ($error): ?><div class="error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?><form method="post" action="../api/auth.php?action=login"><input type="hidden" name="csrf" value="<?= htmlspecialchars((string)($_SESSION['csrf'] ??= bin2hex(random_bytes(32)), ENT_QUOTES, 'UTF-8') ?>"><label>اسم المستخدم<input name="username" autocomplete="username" maxlength="50" required></label><label>كلمة المرور<input type="password" name="password" autocomplete="current-password" required></label><button type="submit">تسجيل الدخول</button></form><small>Development account: admin / Admin@12345</small></section></main></body></html>
